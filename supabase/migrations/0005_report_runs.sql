-- report_runs: one row per dispatch to the external PHP scraper, whether
-- triggered by the daily cron or a manual "Check now" click.

create table public.report_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  trigger_type text not null,
  status text not null default 'queued',
  external_job_id text,
  products_count integer not null default 0,
  competitors_count integer not null default 0,
  result_data jsonb,
  report_file_url text,
  error_message text,
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_runs_trigger_type_check check (trigger_type in ('daily', 'manual')),
  constraint report_runs_status_check check (status in ('queued', 'sent', 'processing', 'completed', 'failed')),
  -- A daily run has no single product; a manual run always targets exactly one.
  constraint report_runs_product_matches_trigger check (
    (trigger_type = 'daily' and product_id is null)
    or (trigger_type = 'manual' and product_id is not null)
  )
);

create trigger report_runs_set_updated_at
  before update on public.report_runs
  for each row execute function public.touch_updated_at();

-- Status ordering, used to make callbacks idempotent (§4 of the design):
-- an update may only move a run to a status ranked strictly higher than its
-- current one. The lifecycle is chronological: a run is queued, we mark it
-- `sent` ourselves the moment the scraper acknowledges dispatch, the scraper
-- then calls back with `processing` once it starts, and `completed` once
-- scraping + email are done. `failed` carries the highest rank because a
-- failure can terminate the run from ANY prior state and is always final —
-- no status may ever follow it.
create or replace function public.report_run_status_rank(s text)
returns smallint
language sql
immutable
as $$
  select case s
    when 'queued' then 0
    when 'sent' then 1
    when 'processing' then 2
    when 'completed' then 3
    when 'failed' then 4
  end::smallint
$$;

alter table public.report_runs
  add column status_rank smallint
  generated always as (public.report_run_status_rank(status)) stored;

-- Local (per-account timezone) calendar date the run was requested on. Kept
-- as a trigger-maintained column rather than a generated column: some
-- Postgres builds classify timezone(text, timestamptz) as STABLE rather than
-- IMMUTABLE, which a generated column expression must be. A trigger has no
-- such restriction and gives the same guarantee.
alter table public.report_runs add column run_date date;

create or replace function public.report_runs_set_run_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
begin
  select timezone into v_tz from public.profiles where id = new.user_id;
  new.run_date := (timezone(coalesce(v_tz, 'UTC'), new.requested_at))::date;
  return new;
end;
$$;

create trigger report_runs_run_date
  before insert or update of requested_at, user_id on public.report_runs
  for each row execute function public.report_runs_set_run_date();

-- Idempotency guard: at most one non-failed daily run per user per LOCAL day.
-- A failed run does not consume the slot (it sent nothing), so a same-day
-- retry after a genuine failure is allowed; Postgres removes the index entry
-- the instant a row transitions to 'failed'.
create unique index report_runs_one_daily_per_user_per_day
  on public.report_runs (user_id, run_date)
  where trigger_type = 'daily' and status <> 'failed';

-- Prevents a double-clicked "Check now" from creating two concurrent runs
-- for the same product. Includes 'sent' since a run sits there briefly
-- between dispatch acknowledgement and the scraper's first callback.
create unique index report_runs_one_active_manual_per_product
  on public.report_runs (product_id)
  where trigger_type = 'manual' and status in ('queued', 'sent', 'processing');

create index report_runs_user_requested_idx on public.report_runs (user_id, requested_at desc);
create index report_runs_active_idx on public.report_runs (user_id, status)
  where status in ('queued', 'sent', 'processing');
create index report_runs_product_id_idx on public.report_runs (product_id);
