-- Pivot from per-user data isolation to a single shared team workspace:
-- every authenticated user of this app now sees and edits the same LAETO
-- product catalog, competitors and report history. What changes:
--
--   - profiles: trimmed to per-person identity (id, email, full_name) so
--     other team members' names/emails can be shown as attribution.
--   - report_settings: a NEW singleton table replacing the report-related
--     columns that used to live per-profile (report_email,
--     daily_reports_enabled, preferred_report_time, timezone) — there is
--     now exactly one shared report configuration for the whole team.
--   - products / competitors: user_id (owner) is replaced by created_by /
--     updated_by (attribution only, not an access-control boundary).
--     ASIN uniqueness becomes global instead of per-user.
--   - report_runs: user_id is renamed to requested_by (nullable — daily/
--     cron-triggered runs have no human requester) and the one-daily-run
--     guard becomes "one per day" instead of "one per user per day".
--   - RLS across every shared table: "owned by me" policies are replaced
--     with "any authenticated user of this app" policies. created_by /
--     updated_by / requested_by are stamped server-side by triggers from
--     auth.uid() — never trusted from client input.
--   - Storage: the product-images path convention drops the {user_id}/
--     prefix (now {product_id}/{file}), and its policies open up the same
--     way.

-- ---------------------------------------------------------------------------
-- profiles: keep identity only; mirror auth.users.email for attribution
-- display (every team member can see every other team member's email).
-- ---------------------------------------------------------------------------
alter table public.profiles add column email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id;
alter table public.profiles alter column email set not null;

alter table public.profiles drop constraint if exists profiles_report_email_format;
alter table public.profiles drop constraint if exists profiles_timezone_valid;
alter table public.profiles drop column if exists company_name;
alter table public.profiles drop column if exists report_email;
alter table public.profiles drop column if exists daily_reports_enabled;
alter table public.profiles drop column if exists preferred_report_time;
alter table public.profiles drop column if exists timezone;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_any_team_member on public.profiles
  for select to authenticated
  using (true);
-- profiles_update_own is unchanged: you may only edit your own full_name.

-- ---------------------------------------------------------------------------
-- report_settings: singleton table (exactly one row, enforced by a boolean
-- primary key with a CHECK it is true) holding the team's shared report
-- configuration.
-- ---------------------------------------------------------------------------
create table public.report_settings (
  id boolean primary key default true,
  company_name text,
  report_email text,
  daily_reports_enabled boolean not null default true,
  preferred_report_time time not null default '08:00',
  timezone text not null default 'Europe/London',
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_settings_singleton check (id),
  constraint report_settings_timezone_valid check (public.is_valid_timezone(timezone)),
  constraint report_settings_report_email_format check (
    report_email is null or report_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);

insert into public.report_settings (id, report_email, timezone, preferred_report_time, daily_reports_enabled)
select true, p.email, 'Europe/London', time '08:00', true
from public.profiles p
order by p.created_at asc
limit 1
on conflict (id) do nothing;

insert into public.report_settings (id) values (true) on conflict (id) do nothing;

create trigger report_settings_set_updated_at
  before update on public.report_settings
  for each row execute function public.touch_updated_at();

alter table public.report_settings enable row level security;

create policy report_settings_select_any_team_member on public.report_settings
  for select to authenticated
  using (true);

create policy report_settings_update_any_team_member on public.report_settings
  for update to authenticated
  using (true)
  with check (true);

-- Stamp updated_by server-side; never trust a client-supplied value.
create or replace function public.stamp_updated_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger report_settings_stamp_updated_by
  before update on public.report_settings
  for each row execute function public.stamp_updated_by();

-- Simplify the new-user trigger now that profiles no longer carries report
-- settings, and mirror the email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- Keep profiles.email in sync if a user's auth email ever changes.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- products: user_id (owner) -> created_by / updated_by (attribution only).
-- ASIN uniqueness becomes global (one shared catalog, not one per user).
-- ---------------------------------------------------------------------------
alter table public.products add column created_by uuid references auth.users (id) on delete set null;
alter table public.products add column updated_by uuid references auth.users (id) on delete set null;
update public.products set created_by = user_id, updated_by = user_id;

drop policy if exists products_select_own on public.products;
drop policy if exists products_insert_own on public.products;
drop policy if exists products_update_own on public.products;
drop policy if exists products_delete_own on public.products;

-- Drop the composite FK from competitors before dropping the column it
-- depends on (products.id, products.user_id), and drop every OLD policy
-- that still references products.user_id (on competitors and report_runs)
-- before that column is dropped.
alter table public.competitors drop constraint if exists competitors_product_owner_fk;
drop policy if exists competitors_insert_own on public.competitors;
drop policy if exists competitors_update_own on public.competitors;
drop policy if exists report_runs_insert_manual on public.report_runs;

alter table public.products drop constraint if exists products_user_asin_key;
alter table public.products drop constraint if exists products_id_user_id_key;
drop index if exists public.products_user_id_idx;
drop index if exists public.products_user_notify_idx;
alter table public.products drop column if exists user_id;

alter table public.products add constraint products_asin_key unique (asin);
create index products_notify_idx on public.products (notify_enabled);
create index products_created_by_idx on public.products (created_by);

create or replace function public.stamp_created_by()
returns trigger
language plpgsql
as $$
begin
  new.created_by := auth.uid();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger products_stamp_created_by
  before insert on public.products
  for each row execute function public.stamp_created_by();

create trigger products_stamp_updated_by
  before update on public.products
  for each row execute function public.stamp_updated_by();

create policy products_select_any_team_member on public.products
  for select to authenticated
  using (true);

create policy products_insert_any_team_member on public.products
  for insert to authenticated
  with check (true);

create policy products_update_any_team_member on public.products
  for update to authenticated
  using (true)
  with check (true);

create policy products_delete_any_team_member on public.products
  for delete to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- competitors: same pivot as products. The product_id -> products FK no
-- longer needs to be composite (there is no per-user product ownership to
-- validate against anymore).
-- ---------------------------------------------------------------------------
alter table public.competitors add column created_by uuid references auth.users (id) on delete set null;
alter table public.competitors add column updated_by uuid references auth.users (id) on delete set null;
update public.competitors set created_by = user_id, updated_by = user_id;

drop policy if exists competitors_select_own on public.competitors;
drop policy if exists competitors_insert_own on public.competitors;
drop policy if exists competitors_update_own on public.competitors;
drop policy if exists competitors_delete_own on public.competitors;

drop index if exists public.competitors_user_id_idx;
alter table public.competitors drop column if exists user_id;

alter table public.competitors
  add constraint competitors_product_id_fkey
  foreign key (product_id) references public.products (id) on delete cascade;

create index competitors_created_by_idx on public.competitors (created_by);

create trigger competitors_stamp_created_by
  before insert on public.competitors
  for each row execute function public.stamp_created_by();

create trigger competitors_stamp_updated_by
  before update on public.competitors
  for each row execute function public.stamp_updated_by();

create policy competitors_select_any_team_member on public.competitors
  for select to authenticated
  using (true);

create policy competitors_insert_any_team_member on public.competitors
  for insert to authenticated
  with check (true);

create policy competitors_update_any_team_member on public.competitors
  for update to authenticated
  using (true)
  with check (true);

create policy competitors_delete_any_team_member on public.competitors
  for delete to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- report_runs: user_id (owner) -> requested_by (nullable attribution; NULL
-- for the daily cron, which has no human requester). The one-daily-run
-- guard becomes "one per day" for the whole team, not per user.
-- ---------------------------------------------------------------------------
drop index if exists public.report_runs_one_daily_per_user_per_day;
drop index if exists public.report_runs_user_requested_idx;
drop index if exists public.report_runs_active_idx;

alter table public.report_runs rename column user_id to requested_by;
alter table public.report_runs alter column requested_by drop not null;
alter table public.report_runs drop constraint if exists report_runs_user_id_fkey;
alter table public.report_runs
  add constraint report_runs_requested_by_fkey
  foreign key (requested_by) references auth.users (id) on delete set null;

create unique index report_runs_one_daily_per_day
  on public.report_runs (run_date)
  where trigger_type = 'daily' and status <> 'failed';

create index report_runs_requested_idx on public.report_runs (requested_at desc);
create index report_runs_active_idx on public.report_runs (status)
  where status in ('queued', 'sent', 'processing');

drop policy if exists report_runs_select_own on public.report_runs;
drop policy if exists report_runs_insert_manual on public.report_runs;

create policy report_runs_select_any_team_member on public.report_runs
  for select to authenticated
  using (true);

create policy report_runs_insert_manual on public.report_runs
  for insert to authenticated
  with check (
    trigger_type = 'manual'
    and status = 'queued'
    and product_id is not null
    and exists (select 1 from public.products p where p.id = report_runs.product_id)
  );

create or replace function public.stamp_requested_by()
returns trigger
language plpgsql
as $$
begin
  new.requested_by := auth.uid();
  return new;
end;
$$;

create trigger report_runs_stamp_requested_by
  before insert on public.report_runs
  for each row execute function public.stamp_requested_by();

-- run_date now derives the local calendar date from the shared
-- report_settings timezone instead of a per-user profile.
create or replace function public.report_runs_set_run_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
begin
  select timezone into v_tz from public.report_settings where id = true;
  new.run_date := (timezone(coalesce(v_tz, 'UTC'), new.requested_at))::date;
  return new;
end;
$$;

-- apply_report_run_callback: a completed run now refreshes last_checked_at
-- on every monitored product (daily) or the one targeted product (manual),
-- with no per-user filter — the whole catalog is shared.
create or replace function public.apply_report_run_callback(
  p_run_id uuid,
  p_external_job_id text,
  p_status text,
  p_started_at timestamptz default null,
  p_completed_at timestamptz default null,
  p_sent_at timestamptz default null,
  p_error_message text default null,
  p_report_file_url text default null,
  p_result_data jsonb default null
)
returns table (applied boolean, previous_status text, current_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_status text;
  v_prev_rank smallint;
  v_new_rank smallint;
  v_product_id uuid;
  v_existing_job_id text;
begin
  select r.status, r.status_rank, r.product_id, r.external_job_id
    into v_prev_status, v_prev_rank, v_product_id, v_existing_job_id
  from public.report_runs r
  where r.id = p_run_id
  for update;

  if not found then
    raise exception 'run_not_found' using errcode = 'P0002';
  end if;

  if v_existing_job_id is not null and p_external_job_id is not null
     and v_existing_job_id <> p_external_job_id then
    raise exception 'job_id_mismatch' using errcode = 'P0001';
  end if;

  v_new_rank := public.report_run_status_rank(p_status);
  if v_new_rank is null then
    raise exception 'unknown_status: %', p_status using errcode = '22023';
  end if;

  if v_new_rank <= v_prev_rank then
    return query select false, v_prev_status, v_prev_status;
    return;
  end if;

  update public.report_runs set
    status = p_status,
    external_job_id = coalesce(external_job_id, p_external_job_id),
    started_at = case when p_status = 'processing' then coalesce(started_at, coalesce(p_started_at, now())) else started_at end,
    completed_at = case when p_status in ('completed', 'failed') then coalesce(completed_at, coalesce(p_completed_at, now())) else completed_at end,
    sent_at = case when p_status = 'sent' then coalesce(sent_at, coalesce(p_sent_at, now())) else sent_at end,
    error_message = coalesce(p_error_message, error_message),
    report_file_url = coalesce(p_report_file_url, report_file_url),
    result_data = coalesce(p_result_data, result_data)
  where id = p_run_id;

  if p_status = 'completed' then
    update public.products
    set last_checked_at = now()
    where (v_product_id is null or id = v_product_id)
      and (v_product_id is not null or notify_enabled = true);
  end if;

  return query select true, v_prev_status, p_status;
end;
$$;

-- select_daily_report_candidates: there is now exactly one team, so this
-- returns at most one row (or none, if not due / already run today).
-- Return type (OUT columns) changed, so the old function must be dropped
-- first — CREATE OR REPLACE cannot change a function's return row shape.
drop function if exists public.select_daily_report_candidates(text);

create function public.select_daily_report_candidates(p_mode text default 'hourly')
returns table (report_email text, company_name text, timezone text)
language sql
stable
security definer
set search_path = public
as $$
  select s.report_email, s.company_name, s.timezone
  from public.report_settings s
  where s.id = true
    and s.daily_reports_enabled
    and s.report_email is not null
    and (
      p_mode <> 'hourly'
      or date_part('hour', timezone(s.timezone, now())) = date_part('hour', s.preferred_report_time)
    )
    and not exists (
      select 1 from public.report_runs r
      where r.trigger_type = 'daily'
        and r.run_date = (timezone(s.timezone, now()))::date
        and r.status <> 'failed'
    );
$$;

-- ---------------------------------------------------------------------------
-- Storage: drop the {user_id}/ path prefix requirement. Path convention is
-- now {product_id}/{filename} — one folder level, no per-user partition.
-- ---------------------------------------------------------------------------
drop policy if exists "product_images_select_own" on storage.objects;
drop policy if exists "product_images_insert_own" on storage.objects;
drop policy if exists "product_images_update_own" on storage.objects;
drop policy if exists "product_images_delete_own" on storage.objects;

create policy "product_images_select_any_team_member"
on storage.objects for select to authenticated
using (bucket_id = 'product-images');

create policy "product_images_insert_any_team_member"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and array_length(storage.foldername(name), 1) = 1
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

create policy "product_images_update_any_team_member"
on storage.objects for update to authenticated
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');

create policy "product_images_delete_any_team_member"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images');
