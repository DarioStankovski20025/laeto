-- Reports can now go to up to 5 recipients. report_emails replaces the
-- single report_email; report_email is kept (mirrored to the first
-- recipient) so a deployment still running the previous code keeps working
-- until it is redeployed.

-- CHECK constraints cannot contain subqueries, so per-element validation
-- needs an IMMUTABLE helper.
create or replace function public.all_valid_emails(p_emails text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(bool_and(e ~* '^[^@\s,]+@[^@\s,]+\.[^@\s,]+$'), true)
  from unnest(p_emails) as e;
$$;

alter table public.report_settings
  add column report_emails text[] not null default '{}';

update public.report_settings
set report_emails = array[report_email]
where report_email is not null;

alter table public.report_settings
  add constraint report_settings_report_emails_max check (cardinality(report_emails) <= 5),
  add constraint report_settings_report_emails_format check (public.all_valid_emails(report_emails));
