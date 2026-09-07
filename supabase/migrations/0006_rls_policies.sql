-- Row Level Security for every client-owned table. All policies use
-- (select auth.uid()) rather than a bare auth.uid() so Postgres evaluates it
-- once per statement (an InitPlan) instead of once per row.

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.competitors enable row level security;
alter table public.report_runs enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert/delete policy: rows are created by the on_auth_user_created
-- trigger and removed only via cascade from auth.users. There is no
-- self-service signup path that needs to insert a profile directly.

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create policy products_select_own on public.products
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy products_insert_own on public.products
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy products_update_own on public.products
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy products_delete_own on public.products
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- competitors
--
-- The composite foreign key added in 0004 (product_id, user_id) ->
-- products(id, user_id) already makes it structurally impossible for a
-- competitor's user_id to reference a product owned by someone else. The
-- policies below are the second, independent lock: they check both the row's
-- own user_id AND, on writes, re-verify the parent product's owner directly,
-- so a competitor is never visible or writable through a forged user_id even
-- if the FK were ever relaxed in a future migration.
-- ---------------------------------------------------------------------------
create policy competitors_select_own on public.competitors
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy competitors_insert_own on public.competitors
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.products p
      where p.id = competitors.product_id
        and p.user_id = (select auth.uid())
    )
  );

create policy competitors_update_own on public.competitors
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.products p
      where p.id = competitors.product_id
        and p.user_id = (select auth.uid())
    )
  );

create policy competitors_delete_own on public.competitors
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- report_runs
--
-- Status is owned exclusively by the service role via the
-- apply_report_run_callback() RPC (see 0008). There is deliberately no
-- update/delete policy for `authenticated` — a user can create a manual run
-- request but can never rewrite its history or outcome.
-- ---------------------------------------------------------------------------
create policy report_runs_select_own on public.report_runs
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy report_runs_insert_manual on public.report_runs
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and trigger_type = 'manual'
    and status = 'queued'
    and product_id is not null
    and exists (
      select 1 from public.products p
      where p.id = report_runs.product_id
        and p.user_id = (select auth.uid())
    )
  );
