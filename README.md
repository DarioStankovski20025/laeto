# LAETO LTD — Amazon Competitor Price Tracker

A private B2B dashboard for the LAETO LTD team to manage its shared Amazon
product catalogue, track competitors, and trigger price-monitoring reports.
Every team member with a login sees and edits the same catalogue — there is
no per-user data isolation, only per-record attribution (who added or last
edited each product, competitor, or report run).

This application **does not scrape Amazon itself**, and has no cron or
scheduler of its own. It owns the data (products, competitors, report
settings) and exposes it two ways to a separate report service running on a
VPS, which performs the actual scraping, Excel generation and email
delivery:

- **Pull** (the full catalogue): the report service calls
  `GET /api/reports/feed` on its own schedule and gets back a link-only JSON
  array of every eligible product.
- **Push** (a single product): clicking "Check now" on one product POSTs a
  link-only payload to a report-service URL configured via env.

Both sides call back to `POST /api/reports/callback` with status updates.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Supabase
(Auth, Postgres, Storage), Motion, React Hook Form and Zod.

---

## Table of contents

1. [Architecture at a glance](#architecture-at-a-glance)
2. [Environment variables](#environment-variables)
3. [Supabase project setup](#supabase-project-setup)
4. [Running the SQL migrations](#running-the-sql-migrations)
5. [Creating the private Storage bucket](#creating-the-private-storage-bucket)
6. [Password recovery email template](#password-recovery-email-template)
7. [Creating the first LAETO LTD user](#creating-the-first-laeto-ltd-user)
8. [Running locally](#running-locally)
9. [Deploying to Vercel](#deploying-to-vercel)
10. [Report service integration contract](#report-service-integration-contract)
11. [Mock mode](#mock-mode)
12. [Verification performed](#verification-performed)
13. [Known limitations / remaining setup](#known-limitations--remaining-setup)

---

## Architecture at a glance

```
src/
  proxy.ts                # Next 16's replacement for middleware.ts — session
                           # refresh + auth redirects
  app/
    (auth)/                # /login, /forgot-password, /reset-password
    (dashboard)/           # /dashboard, /products/*, /settings (auth-guarded)
    auth/confirm/          # password-recovery link landing (sets session)
    api/
      reports/feed/        # GET, Bearer REPORTS_FEED_SECRET — the ONE pull endpoint
      products/[id]/check-now/  # POST, per-user session — pushes one product
      reports/callback/    # POST, Bearer SCRAPER_CALLBACK_SECRET
      runs/status/         # GET, polled by the UI while a run is active
  lib/
    supabase/              # 4 client constructors — see below
    data/                  # every DB query, written once, used everywhere
    scraper/                # the manual-check push contract lives here
    validation/schemas.ts  # Zod schemas shared by client forms + server actions
    actions/                # Server Actions (product/competitor/settings/auth CRUD, team)
    domain/                 # pure business rules (report-run status ordering)
supabase/migrations/       # ordered SQL: schema, RLS, storage, RPC functions
```

**Supabase client layering** (`src/lib/supabase/`):

| File | Used from | Notes |
|---|---|---|
| `client.ts` | Client Components | Browser client, safe to memoize per-tab |
| `server.ts` | Server Components, Server Actions | Cookie writes wrapped in try/catch (illegal during RSC render — expected) |
| `route.ts` | Route Handlers | Cookie writes always legal here; also applies Supabase's `Cache-Control: no-store` headers |
| `admin.ts` | **Only** the feed and callback routes, and team-account creation | Service-role key, **bypasses RLS entirely** — never import elsewhere |

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in every value. Summary:

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-role key — **server-only**, never exposed to the browser |
| `NEXT_PUBLIC_APP_URL` | Yes | Absolute base URL of this deployment (used to build the mock-mode callback URL) |
| `REPORTS_FEED_SECRET` | Yes | **Inbound** — the report service presents this as `Authorization: Bearer <value>` to `GET /api/reports/feed` |
| `MANUAL_CHECK_URL` | For real dispatch | Where a single-product "Check now" push is sent |
| `MANUAL_CHECK_SECRET` | For real dispatch | **Outbound** — this app sends this as `Authorization: Bearer <value>` to `MANUAL_CHECK_URL` |
| `SCRAPER_CALLBACK_SECRET` | Yes | Bearer secret the report service must send back to `/api/reports/callback` |
| `SCRAPER_TIMEOUT_MS` | No (default 15000) | Outbound request timeout for the manual-check push |
| `SCRAPER_MOCK_MODE` | No | `true` to fully bypass the real manual-check push (see [Mock mode](#mock-mode)) — has no effect on the feed endpoint, which always just answers from the database |
| `NEXT_PUBLIC_ALLOW_SIGNUP` | No | Reserved for a future self-service signup flag; unused today (there is no signup route — new accounts are created from Settings → Team) |

---

## Supabase project setup

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. Under **Project Settings → API**, copy the **Project URL**, **anon public
   key**, and **service_role key** into `.env.local`.
3. Under **Authentication → URL Configuration**, set the **Site URL** to your
   deployment's `NEXT_PUBLIC_APP_URL` and add it (plus `http://localhost:3000`
   for local dev) to **Redirect URLs**.
4. Disable public signups: **Authentication → Providers → Email**, leave sign-up
   enabled at the Supabase level if you want to create users via the API (step
   7), but this application itself never renders a signup form.

## Running the SQL migrations

Migrations live in `supabase/migrations/`, numbered and meant to run in
order:

```
0001_extensions.sql        pgcrypto
0002_profiles.sql          profiles table + auto-create-on-signup trigger
0003_products.sql          products table
0004_competitors.sql       competitors table + 20-per-product limit trigger
0005_report_runs.sql       report_runs table + status ranking + idempotency indexes
0006_rls_policies.sql      Row Level Security for all four tables
0007_storage.sql           private product-images bucket + storage policies
0008_functions_rpc.sql     apply_report_run_callback, select_daily_report_candidates,
                           expire_stale_report_runs, set_product_image
0009_storage_gc.sql        orphaned-image cleanup queue + trigger
0010_report_runs_retention.sql  keep only the 25 most recent report_runs
0011_shared_workspace.sql  pivot to one shared team workspace: report_settings
                           singleton, created_by/updated_by/requested_by
                           attribution columns, RLS opened to any
                           authenticated user
0012_attribution_fk_to_profiles.sql  repoint attribution FKs at profiles for
                                     PostgREST embedding
0013_product_amazon_url.sql  products.amazon_url — LAETO's own product link
0014_remove_cron.sql       drop select_daily_report_candidates and the
                           one-per-day guard; rename trigger_type 'daily' -> 'feed'
0015_fix_retention_shared_workspace.sql  fix 0010's trigger to match the
                                         0011 column rename; retention is
                                         now global, not per-user
```

**Using the Supabase CLI (recommended):**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

**Or manually:** open the Supabase Dashboard's **SQL Editor** and run each
file in `supabase/migrations/` in numeric order, once each.

After migrating, regenerate the TypeScript types to match the live schema
(a hand-authored version matching these migrations already ships in
`src/lib/types/database.ts` — regenerate to be sure they stay in sync after
any future migration):

```bash
npx supabase gen types typescript --project-id <your-project-ref> --schema public > src/lib/types/database.ts
```

## Creating the private Storage bucket

Migration `0007_storage.sql` creates the `product-images` bucket and its
policies automatically (`insert into storage.buckets ... on conflict do
update`), so no manual dashboard step is required — running the migrations
is sufficient. To verify: **Storage** in the dashboard should show a
`product-images` bucket marked **Private**, 5 MB file-size limit, restricted
to `image/jpeg`, `image/png`, `image/webp`.

## Password recovery email template

Supabase's **default** recovery email links to `/auth/v1/verify`, which
redirects with the token in a URL **fragment** — a server route can never
read that. This app's `/auth/confirm` route expects a `token_hash` **query
parameter** instead. Update the template:

**Authentication → Email Templates → Reset Password**, set the link to:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
```

## Creating the first LAETO LTD user

There is no public signup route by design. Create the first (and any
subsequent) user directly:

**Option A — Dashboard:** Authentication → Users → **Add user** → set email
and password, and check **Auto Confirm User**. A `profiles` row is created
automatically by the `on_auth_user_created` trigger.

**Option B — CLI / API**, using the service-role key (never do this from the
browser):

```bash
curl -X POST 'https://<project-ref>.supabase.co/auth/v1/admin/users' \
  -H "apikey: <service-role-key>" \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@laeto.example","password":"a-strong-password","email_confirm":true}'
```

Then sign in at `/login`, and fill in the report recipient email and
timezone under **Settings** (a default `report_settings` row — one shared
row for the whole team — is seeded automatically with
`timezone = 'Europe/London'`, daily reports enabled). Every team member sees
and edits the same product catalogue; add colleagues from **Settings → Team
→ Add team member** rather than repeating steps A/B above for each one.

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With
`SCRAPER_MOCK_MODE=true` in `.env.local`, the full "Check now" flow works
end-to-end without a real report service — see [Mock mode](#mock-mode).
`GET /api/reports/feed` always works locally regardless of mock mode (there's
nothing to mock on a pull — it just answers from your database), as long as
`REPORTS_FEED_SECRET` is set.

Other useful commands:

```bash
npm run lint        # ESLint (flat config)
npm run typecheck   # tsc --noEmit
npm run test        # Vitest — unit tests for validation, payload building,
                     # the report-run status machine, and scraper dispatch
npm run build       # production build
```

## Deploying to Vercel

1. Push this repository to GitHub/GitLab/Bitbucket and import it in Vercel.
2. Add every variable from `.env.example` under **Project Settings →
   Environment Variables** (Production and Preview).
3. Set `SCRAPER_MOCK_MODE=false` in Production once the real report service's
   `MANUAL_CHECK_URL`/`MANUAL_CHECK_SECRET` are configured — mock mode also
   self-disables in production unless
   `SCRAPER_MOCK_MODE_FORCE_PRODUCTION=true` is explicitly set (don't set
   that in a real deployment).
4. Deploy. There is no cron to register — the report service pulls
   `GET /api/reports/feed` on its own schedule, entirely outside this app's
   control.

## Report service integration contract

### Authentication

- **Feed** (report service → this app): `Authorization: Bearer <REPORTS_FEED_SECRET>`
- **Manual-check push** (this app → report service): `Authorization: Bearer <MANUAL_CHECK_SECRET>`
- **Callback** (report service → this app): `Authorization: Bearer <SCRAPER_CALLBACK_SECRET>`

Three different secrets. Every one is compared with a constant-time check
(`crypto.timingSafeEqual`) on this app's side.

### `GET /api/reports/feed` — pull the full catalogue

Call this whenever you want (there is no schedule on this app's side — that
is now entirely the report service's responsibility). Every call:

1. Verifies the bearer secret (401 if missing/wrong).
2. If `report_settings.daily_reports_enabled` is off, or there are no
   eligible products, logs a `completed` run and returns `[]`.
3. Otherwise loads every product with `notify_enabled = true`, a non-null
   `amazon_url`, and at least one competitor; logs one `report_runs` row
   (`trigger_type = 'feed'`, `status = 'sent'` immediately — there is no
   separate dispatch step to await on a pull); and returns the link-only
   JSON.

Response — a flat array, one self-contained object per product (the
recipient email is repeated in each entry so you never need to look outside
the item you're processing):

```json
[
  {
    "our_product": "https://www.amazon.co.uk/dp/B0ABC1234X",
    "competitors": [
      "https://www.amazon.co.uk/dp/B0XYZ0000A",
      "https://www.amazon.co.uk/dp/B0XYZ0000B"
    ],
    "email": "reports@laeto.example"
  }
]
```

The run id is deliberately **not** inside the JSON body (kept link-only) —
it travels as the `X-Report-Run-Id` response header. Pass it back on any
callback you send for this run.

### `POST <MANUAL_CHECK_URL>` — push a single "Check now"

Sent when a user clicks "Check now" on one product. Same link-only shape as
one feed entry, but as a bare object (not wrapped in an array), and the run
id travels as the **request** header `X-Report-Run-Id` this time:

```json
{
  "our_product": "https://www.amazon.co.uk/dp/B0ABC1234X",
  "competitors": ["https://www.amazon.co.uk/dp/B0XYZ0000A"],
  "email": "reports@laeto.example"
}
```

### Expected acknowledgement (synchronous response to the manual-check push)

Must acknowledge **quickly** — accept the job and process it asynchronously,
not block on the actual scraping.

```json
{
  "accepted": true,
  "jobId": "external-job-id",
  "queuedAt": "2026-01-15T08:00:01.000Z",
  "estimatedSeconds": 45,
  "message": "optional human-readable note"
}
```

`accepted` must be the literal `true`; `jobId` is required (≤128 chars).
Any other 2xx body, a non-2xx status, a timeout, or a network failure is
recorded as a `failed` report run with a specific, safely-generic error
message — the real cause is only ever logged server-side (redacted of all
secrets), never shown to the browser. (`GET /api/reports/feed` has no
synchronous ack of this kind — its JSON response body **is** the
acknowledgement.)

### Callback payload (asynchronous status updates)

`POST /api/reports/callback` — send as many of these as needed; repeated or
out-of-order deliveries are **idempotent no-ops**, never a corruption.

**Processing started:**

```json
{
  "reportRunId": "b6b6c2b0-...-uuid",
  "externalJobId": "external-job-id",
  "status": "processing",
  "startedAt": "2026-01-15T08:00:05.000Z"
}
```

**Completed:**

```json
{
  "reportRunId": "b6b6c2b0-...-uuid",
  "externalJobId": "external-job-id",
  "status": "completed",
  "completedAt": "2026-01-15T08:02:30.000Z",
  "reportFileUrl": "https://your-storage/report.xlsx",
  "resultData": {
    "productsProcessed": 20,
    "competitorsProcessed": 240,
    "failedCompetitors": 3,
    "emailSent": true,
    "emailSentAt": "2026-01-15T08:02:45.000Z"
  }
}
```

**Failed:**

```json
{
  "reportRunId": "b6b6c2b0-...-uuid",
  "externalJobId": "external-job-id",
  "status": "failed",
  "errorMessage": "human-readable failure reason"
}
```

Allowed `status` values from the report service are **only** `processing`,
`completed`, `failed` (the app itself sets `sent` — immediately, for a feed
run; on acknowledgement, for a manual push — the report service never sends
`queued` or `sent`). Status can only move strictly forward
(`processing → completed → failed` is fine, e.g. scraping succeeded but the
email send failed; `completed → processing` or any repeat is rejected as a
no-op, not an error). Responses:

| Situation | HTTP status |
|---|---|
| Bad or missing bearer secret | 401 |
| Malformed JSON / fails Zod validation | 400 |
| Unknown `reportRunId` | 404 |
| `externalJobId` doesn't match the run's stored job id | 409 |
| Valid but status doesn't advance (replay) | 200, `{ "applied": false }` |
| Applied successfully | 200, `{ "applied": true }` |

## Mock mode

Set `SCRAPER_MOCK_MODE=true` to fully exercise the manual-check "Check now"
flow without a real report service (this has **no effect** on
`GET /api/reports/feed` — a pull has nothing to mock, it always just answers
from your database):

- No outbound HTTP call is made to `MANUAL_CHECK_URL`.
- A realistic acknowledgement is returned immediately with a fake
  `mock_<uuid>` job id.
- A few seconds later, a `processing` then `completed` callback fires
  automatically **against the real `/api/reports/callback` route**, signed
  with your real `SCRAPER_CALLBACK_SECRET` — so the callback's auth and
  validation logic, and the dashboard's polling UI, are genuinely exercised.
- All mock logic lives in `src/lib/scraper/mock.ts`, isolated behind a single
  `isMockMode()` check in `src/lib/scraper/client.ts` — removing mock mode
  entirely means deleting that one file and the one call site.
- **Cannot silently activate in production**: if `NODE_ENV === "production"`,
  mock mode is ignored unless `SCRAPER_MOCK_MODE_FORCE_PRODUCTION=true` is
  also explicitly set. Never set that in a real deployment.

## Verification performed

Run before every deploy:

```bash
npm run lint       # clean
npm run typecheck  # clean
npm run build      # production build succeeds (Turbopack)
npm run test       # 63 unit tests, all passing
```

**What the automated tests cover:** ASIN and Amazon-URL validation
(including edge cases like domains that merely contain "amazon" as a
substring), the report-run status transition rules (forward-only, `failed`
strictly terminal, replays rejected), scraper callback payload validation
(rejecting `queued`/`sent` from the report service, malformed UUIDs, unknown
statuses), the manual-check payload builder's shape against the documented
contract, the dispatch client's full error taxonomy (timeout vs. network vs.
rejected vs. bad response — including that a fetch `TimeoutError` is
correctly distinguished from a generic `AbortError`), and the constant-time
bearer-token comparison used by the feed and callback routes.

**Verified live against a real Supabase project** (not just built and
assumed): sign-in and auth redirects in both directions; the full product
create → image upload → edit → replace image → delete lifecycle; competitor
CRUD including the 20-item cap and duplicate-ASIN rejection; the notify
toggle; settings save; `GET /api/reports/feed` returning the exact
link-only contract shape with the `X-Report-Run-Id` header, and rejecting
missing/wrong secrets; `POST /api/reports/callback` correlating back to a
feed-issued run id and advancing its status idempotently; the manual
"Check now" push in mock mode through its full sent → processing →
completed cycle; report-run log retention capping at 25 rows; and **RLS
verified adversarially** — a second real test account was created and
confirmed unable to read or write another account's private Storage
objects before the shared-workspace migration, and confirmed able to see
and edit the same shared catalogue after it, with per-record
`created_by`/`updated_by`/`requested_by` attribution intact throughout.

## Known limitations / remaining setup

- **The real report service is out of scope for this repository.** Both
  integration points — the feed's response shape and the manual-check push
  — are implemented and tested; the report service itself must be built
  separately against the contract documented above.
- **`GET /api/reports/feed` has no built-in rate limiting or caching** — it
  queries fresh on every call. Fine for a report service polling on a
  sensible interval; if it were ever called far more often than that, add
  caching at that point rather than pre-emptively now.
- **A product with no `amazon_url` is silently excluded** from both the feed
  and manual-check (with a clear in-app error for the latter) rather than
  causing a partial or malformed payload. Products created before this field
  existed will need one added via **Edit product** before they're eligible.
