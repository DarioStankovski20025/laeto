-- Folders: a flat (never nested) grouping for products, purely to make the
-- dashboard easier to navigate. Deliberately invisible to the report service:
-- GET /api/reports/feed and the manual-check payload are unchanged and say
-- nothing about folders.
--
-- products.folder_id is ON DELETE SET NULL — deleting a folder returns its
-- products to the root of the dashboard, it never deletes a product.

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint folders_name_not_blank check (btrim(name) <> '')
);

-- Case-insensitive: "Garden" and "garden" would be indistinguishable in a
-- flat list, so treat them as the same name.
create unique index folders_name_unique on public.folders (lower(name));

create trigger folders_set_updated_at
  before update on public.folders
  for each row execute function public.touch_updated_at();

create trigger folders_stamp_created_by
  before insert on public.folders
  for each row execute function public.stamp_created_by();

create trigger folders_stamp_updated_by
  before update on public.folders
  for each row execute function public.stamp_updated_by();

alter table public.folders enable row level security;

create policy folders_select_any_team_member on public.folders
  for select to authenticated
  using (true);

create policy folders_insert_any_team_member on public.folders
  for insert to authenticated
  with check (true);

create policy folders_update_any_team_member on public.folders
  for update to authenticated
  using (true)
  with check (true);

create policy folders_delete_any_team_member on public.folders
  for delete to authenticated
  using (true);

alter table public.products
  add column folder_id uuid references public.folders (id) on delete set null;

create index products_folder_id_idx on public.products (folder_id);
