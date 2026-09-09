-- Retention: keep only the 25 most recent report_runs per user. Whenever a
-- new run is inserted, delete the oldest rows for that user beyond the 25
-- most recent (ordered by requested_at). Runs after INSERT (not BEFORE) so
-- the newly inserted row is already counted among the 25 kept.

create or replace function public.trim_report_runs_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.report_runs
  where user_id = new.user_id
    and id not in (
      select id from public.report_runs
      where user_id = new.user_id
      order by requested_at desc
      limit 25
    );
  return null;
end;
$$;

create trigger report_runs_trim_history
  after insert on public.report_runs
  for each row execute function public.trim_report_runs_history();
