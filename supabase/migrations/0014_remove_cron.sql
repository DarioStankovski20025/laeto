-- The daily report is no longer triggered by a cron this app runs — the
-- external report service now PULLS from GET /api/reports/feed on its own
-- schedule. There is nothing left to be "due", so the candidate-selection
-- RPC and the one-per-day guard (which only made sense when this app
-- decided timing) are removed. Renaming trigger_type 'daily' -> 'feed'
-- because a pulled feed can legitimately be requested many times a day —
-- "daily" would now be actively misleading in the Logs UI.

drop function if exists public.select_daily_report_candidates(text);

drop index if exists public.report_runs_one_daily_per_day;

drop trigger if exists report_runs_run_date on public.report_runs;
drop function if exists public.report_runs_set_run_date();

alter table public.report_runs drop column if exists run_date;

update public.report_runs set trigger_type = 'feed' where trigger_type = 'daily';

alter table public.report_runs drop constraint if exists report_runs_trigger_type_check;
alter table public.report_runs add constraint report_runs_trigger_type_check
  check (trigger_type in ('feed', 'manual'));

alter table public.report_runs drop constraint if exists report_runs_product_matches_trigger;
alter table public.report_runs add constraint report_runs_product_matches_trigger check (
  (trigger_type = 'feed' and product_id is null)
  or (trigger_type = 'manual' and product_id is not null)
);
