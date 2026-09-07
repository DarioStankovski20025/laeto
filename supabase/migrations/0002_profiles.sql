-- profiles: one row per auth user, holding company/report settings.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Used in a CHECK constraint, so must be IMMUTABLE. Pins a fixed timestamp
-- rather than now() to validate the timezone string is recognized at all.
create or replace function public.is_valid_timezone(tz text)
returns boolean
language plpgsql
immutable
as $$
begin
  perform timezone(tz, timestamptz '2000-01-01 00:00:00+00');
  return true;
exception when others then
  return false;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  company_name text,
  full_name text,
  report_email text,
  daily_reports_enabled boolean not null default true,
  preferred_report_time time not null default '08:00',
  timezone text not null default 'Europe/London',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_timezone_valid check (public.is_valid_timezone(timezone)),
  constraint profiles_report_email_format check (
    report_email is null or report_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, report_email, timezone, preferred_report_time, daily_reports_enabled)
  values (new.id, new.email, 'Europe/London', time '08:00', true)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
