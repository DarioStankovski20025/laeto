-- trim_report_runs_history() (migration 0010) still referenced report_runs
-- .user_id, which migration 0011 renamed to requested_by when the app
-- became a shared team workspace — every report_runs insert has been
-- failing with "column user_id does not exist" since. Retention is also
-- updated to keep the 25 most recent runs GLOBALLY rather than per-user,
-- matching the shared-workspace model everything else was already moved to.

create or replace function public.trim_report_runs_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.report_runs
  where id not in (
    select id from public.report_runs
    order by requested_at desc
    limit 25
  );
  return null;
end;
$$;
