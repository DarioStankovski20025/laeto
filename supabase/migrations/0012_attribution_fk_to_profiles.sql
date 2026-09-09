-- Repoint the created_by/updated_by/requested_by/updated_by attribution
-- columns from auth.users to public.profiles. profiles.id already has a 1:1
-- relationship with auth.users.id (via its own FK + cascade), so this loses
-- no integrity guarantee — and it lets PostgREST embed the profile (and
-- thus the email) directly in a single query instead of a separate lookup.

alter table public.products drop constraint if exists products_created_by_fkey;
alter table public.products drop constraint if exists products_updated_by_fkey;
alter table public.products
  add constraint products_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null,
  add constraint products_updated_by_fkey foreign key (updated_by) references public.profiles (id) on delete set null;

alter table public.competitors drop constraint if exists competitors_created_by_fkey;
alter table public.competitors drop constraint if exists competitors_updated_by_fkey;
alter table public.competitors
  add constraint competitors_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null,
  add constraint competitors_updated_by_fkey foreign key (updated_by) references public.profiles (id) on delete set null;

alter table public.report_runs drop constraint if exists report_runs_requested_by_fkey;
alter table public.report_runs
  add constraint report_runs_requested_by_fkey foreign key (requested_by) references public.profiles (id) on delete set null;

alter table public.report_settings drop constraint if exists report_settings_updated_by_fkey;
alter table public.report_settings
  add constraint report_settings_updated_by_fkey foreign key (updated_by) references public.profiles (id) on delete set null;
