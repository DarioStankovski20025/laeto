-- competitors: Amazon competitor listings tracked against one LAETO product.
--
-- competitors.user_id is intentionally denormalized (not derived purely via
-- product_id) for fast, non-correlated RLS policies and payload queries. Its
-- consistency with the parent product's owner is enforced structurally by
-- the composite foreign key below (product_id, user_id) -> products(id,
-- user_id) — not by a trigger — so a mismatched user_id is a constraint
-- violation on INSERT/UPDATE, not something that can silently drift.

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  user_id uuid not null,
  asin text not null,
  title text not null,
  amazon_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competitors_asin_format check (asin ~ '^[A-Z0-9]{10}$'),
  constraint competitors_title_not_blank check (btrim(title) <> ''),
  constraint competitors_url_https check (
    amazon_url ~* '^https://([a-z0-9-]+\.)*amazon\.[a-z.]{2,6}(/.*)?$'
  ),
  constraint competitors_product_asin_key unique (product_id, asin),
  constraint competitors_product_owner_fk
    foreign key (product_id, user_id)
    references public.products (id, user_id)
    on update cascade
    on delete cascade
);

create index competitors_product_id_idx on public.competitors (product_id);
create index competitors_user_id_idx on public.competitors (user_id);

create trigger competitors_set_updated_at
  before update on public.competitors
  for each row execute function public.touch_updated_at();

-- Enforce the 20-competitors-per-product cap at the database layer (RLS
-- cannot express cardinality constraints). An advisory lock scoped to the
-- product serializes concurrent inserts so two racing requests cannot both
-- observe count = 19 and both succeed.
create or replace function public.enforce_competitor_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.product_id::text, 0));
  select count(*) into current_count from public.competitors where product_id = new.product_id;
  if current_count >= 20 then
    raise exception 'competitor_limit_reached'
      using errcode = '23514', hint = 'A product can track at most 20 competitors.';
  end if;
  return new;
end;
$$;

create trigger competitors_limit_check
  before insert on public.competitors
  for each row execute function public.enforce_competitor_limit();
