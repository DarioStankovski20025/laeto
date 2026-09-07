-- Orphaned storage object cleanup queue.
--
-- Postgres cascades DELETE a product row but never touches its Storage
-- object, and an image replacement (image_path changed on UPDATE) leaves the
-- previous object behind. This trigger enqueues both cases so a server-side
-- sweep (run at the end of every cron invocation) can remove the underlying
-- file. RLS has no policies defined here, so only the service role can read
-- or write this table.

create table public.deleted_storage_objects (
  id bigserial primary key,
  bucket_id text not null,
  path text not null,
  enqueued_at timestamptz not null default now(),
  attempts smallint not null default 0
);

alter table public.deleted_storage_objects enable row level security;

create or replace function public.enqueue_product_image_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.image_path is not null then
    insert into public.deleted_storage_objects (bucket_id, path) values ('product-images', old.image_path);
  elsif tg_op = 'UPDATE'
        and old.image_path is distinct from new.image_path
        and old.image_path is not null then
    insert into public.deleted_storage_objects (bucket_id, path) values ('product-images', old.image_path);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger products_image_gc
  after update or delete on public.products
  for each row execute function public.enqueue_product_image_delete();
