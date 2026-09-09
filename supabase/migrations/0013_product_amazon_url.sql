-- LAETO's own product listing needs a real Amazon URL now (previously only
-- competitors had one) — the pull feed and manual-check payloads are
-- link-only and need somewhere to get "our" link from.

alter table public.products add column amazon_url text;

alter table public.products add constraint products_amazon_url_https check (
  amazon_url is null or amazon_url ~* '^https://([a-z0-9-]+\.)*amazon\.[a-z.]{2,6}(/|$)'
);
