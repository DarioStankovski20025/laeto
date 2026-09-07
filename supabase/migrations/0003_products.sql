-- products: LAETO's own Amazon listings being monitored.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asin text not null,
  title text not null,
  image_path text,
  notify_enabled boolean not null default true,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_asin_format check (asin ~ '^[A-Z0-9]{10}$'),
  constraint products_title_not_blank check (btrim(title) <> ''),
  constraint products_user_asin_key unique (user_id, asin),
  -- Required so competitors can carry a composite FK back to (id, user_id),
  -- which makes a competitor pointing at another user's product impossible
  -- at the schema level rather than relying solely on RLS.
  constraint products_id_user_id_key unique (id, user_id)
);

create index products_user_id_idx on public.products (user_id);
create index products_user_notify_idx on public.products (user_id, notify_enabled);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();
