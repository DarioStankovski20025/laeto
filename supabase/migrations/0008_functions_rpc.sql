-- Privileged RPC functions used by the service-role client only (cron,
-- scraper callback, image lifecycle). Each revokes execute from anon/
-- authenticated so it can only be reached through server-side code that
-- holds the service-role key.

-- ---------------------------------------------------------------------------
-- apply_report_run_callback: the single write path for advancing a report
-- run's status. Idempotent by construction — a repeated or out-of-order
-- callback delivery is a documented no-op, never a corruption. Runs the
-- whole thing in one transaction with a row lock so two concurrent callbacks
-- for the same run cannot both "win".
-- ---------------------------------------------------------------------------
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
  v_user_id uuid;
  v_product_id uuid;
  v_existing_job_id text;
begin
  select r.status, r.status_rank, r.user_id, r.product_id, r.external_job_id
    into v_prev_status, v_prev_rank, v_user_id, v_product_id, v_existing_job_id
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
    -- Idempotent replay or an out-of-order/stale delivery: report it, but do
    -- not touch the row.
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

  -- A completed run means the products it covered were freshly checked.
  if p_status = 'completed' then
    update public.products
    set last_checked_at = now()
    where user_id = v_user_id
      and (v_product_id is null or id = v_product_id)
      and (v_product_id is not null or notify_enabled = true);
  end if;

  return query select true, v_prev_status, p_status;
end;
$$;

revoke all on function public.apply_report_run_callback(uuid, text, text, timestamptz, timestamptz, timestamptz, text, text, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- select_daily_report_candidates: accounts eligible for a daily send right
-- now. In 'hourly' mode (the default), only accounts whose LOCAL hour
-- matches their preferred_report_time are returned, so the stored
-- preference genuinely drives delivery. 'daily' mode ignores the hour match
-- entirely, for deployments limited to a single once-a-day invocation.
-- ---------------------------------------------------------------------------
create or replace function public.select_daily_report_candidates(p_mode text default 'hourly')
returns table (user_id uuid, report_email text, company_name text, timezone text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.report_email, p.company_name, p.timezone
  from public.profiles p
  where p.daily_reports_enabled
    and p.report_email is not null
    and (
      p_mode <> 'hourly'
      or date_part('hour', timezone(p.timezone, now())) = date_part('hour', p.preferred_report_time)
    )
    and not exists (
      select 1 from public.report_runs r
      where r.user_id = p.id
        and r.trigger_type = 'daily'
        and r.run_date = (timezone(p.timezone, now()))::date
        and r.status <> 'failed'
    );
$$;

revoke all on function public.select_daily_report_candidates(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- expire_stale_report_runs: a run stuck in queued/sent/processing because
-- the PHP worker crashed before calling back would otherwise hold the daily
-- idempotency slot open forever. Called at the start of every cron
-- invocation and opportunistically from the run-status polling endpoint.
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_report_runs(p_max_age interval default interval '30 minutes')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  with expired as (
    update public.report_runs
    set status = 'failed',
        error_message = coalesce(error_message, 'No response from the report service (timed out).'),
        completed_at = now()
    where status in ('queued', 'sent', 'processing')
      and requested_at < now() - p_max_age
    returning 1
  )
  select count(*) into n from expired;
  return n;
end;
$$;

revoke all on function public.expire_stale_report_runs(interval) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- set_product_image: atomically swap a product's image_path and return the
-- previous one so the caller can delete the old storage object last (upload
-- new -> update row -> delete old). SECURITY INVOKER so RLS still applies —
-- a user cannot use this to repoint someone else's product.
-- ---------------------------------------------------------------------------
create or replace function public.set_product_image(p_product_id uuid, p_path text)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old_path text;
begin
  select image_path into v_old_path from public.products where id = p_product_id for update;

  if not found then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  update public.products set image_path = p_path where id = p_product_id;

  return v_old_path;
end;
$$;
