# LAETO LTD — Amazon Competitor Price Tracker

A private, single-tenant B2B dashboard for LAETO LTD to manage its Amazon
product catalogue, track competitors, and trigger price-monitoring reports.

This application **does not scrape Amazon itself**. It owns the data
(products, competitors, report settings), builds a JSON payload, and
dispatches it to a separate PHP service running on a VPS, which performs the
actual scraping, Excel generation and email delivery, then calls back with
status updates.

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
10. [Configuring the daily cron](#configuring-the-daily-cron)
11. [PHP scraper integration contract](#php-scraper-integration-contract)
12. [Mock mode](#mock-mode)
13. [Verification performed](#verification-performed)
14. [Known limitations / remaining setup](#known-limitations--remaining-setup)

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
      cron/daily-report/   # GET, Bearer CRON_SECRET
      products/[id]/check-now/  # POST, per-user session
      reports/callback/    # POST, Bearer SCRAPER_CALLBACK_SECRET
      runs/status/         # GET, polled by the UI while a run is active
  lib/
    supabase/              # 4 client constructors — see below
    data/                  # every DB query, written once, used everywhere
    scraper/                # the entire external PHP contract lives here
    validation/schemas.ts  # Zod schemas shared by client forms + server actions
    actions/                # Server Actions (product/competitor/settings/auth CRUD)
    domain/                 # pure business rules (report-run status ordering)
supabase/migrations/       # ordered SQL: schema, RLS, storage, RPC functions
```

**Supabase client layering** (`src/lib/supabase/`):

| File | Used from | Notes |
|---|---|---|
| `client.ts` | Client Components | Browser client, safe to memoize per-tab |
| `server.ts` | Server Components, Server Actions | Cookie writes wrapped in try/catch (illegal during RSC render — expected) |
| `route.ts` | Route Handlers | Cookie writes always legal here; also applies Supabase's `Cache-Control: no-store` headers |
| `admin.ts` | **Only** the cron and callback routes | Service-role key, **bypasses RLS entirely** — never import elsewhere |

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in every value. Summary:

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-role key — **server-only**, never exposed to the browser |
| `NEXT_PUBLIC_APP_URL` | Yes | Absolute base URL of this deployment (builds the scraper callback URL) |
| `SCRAPER_API_URL` | For real dispatch | PHP scraper's job endpoint |
| `SCRAPER_API_SECRET` | For real dispatch | Bearer secret this app sends to the scraper |
| `SCRAPER_CALLBACK_SECRET` | Yes | Bearer secret the scraper must send back to `/api/reports/callback` |
| `SCRAPER_TIMEOUT_MS` | No (default 15000) | Outbound request timeout to the scraper |
| `SCRAPER_MOCK_MODE` | No | `true` to fully bypass the real scraper (see [Mock mode](#mock-mode)) |
| `CRON_SECRET` | Yes | Bearer secret authorizing `/api/cron/daily-report` |
| `CRON_MODE` | No (default `hourly`) | `hourly` honors each account's preferred report hour; `daily` sends everyone once a day regardless |
| `NEXT_PUBLIC_CRON_MODE` | No | Mirror of `CRON_MODE`, read client-side to disable the hour picker in Settings when it wouldn't be honored |
| `NEXT_PUBLIC_ALLOW_SIGNUP` | No | Reserved for a future self-service signup flag; unused today (there is no signup route) |

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
timezone under **Settings** (a default profile row is created automatically
with `timezone = 'Europe/London'`, daily reports enabled at 08:00).

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With
`SCRAPER_MOCK_MODE=true` in `.env.local`, the full "Check now" and daily-cron
flow works end-to-end without a real PHP service — see [Mock
mode](#mock-mode).

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
3. Set `SCRAPER_MOCK_MODE=false` in Production once the real PHP scraper URL
   and secrets are configured — mock mode also self-disables in production
   unless `SCRAPER_MOCK_MODE_FORCE_PRODUCTION=true` is explicitly set (don't
   set that in a real deployment).
4. Deploy. `vercel.json` registers the daily-report cron automatically.

## Configuring the daily cron

`vercel.json` schedules `GET /api/cron/daily-report` **hourly**
(`0 * * * *`). Each invocation:

1. Verifies `Authorization: Bearer CRON_SECRET`.
2. Selects accounts with daily reports enabled whose **local hour** (computed
   from their stored IANA timezone) matches their `preferred_report_time` —
   this is what makes a per-account preferred time meaningful with a single
   shared cron schedule.
3. Loads only `notify_enabled = true` products that have at least one
   competitor.
4. Creates one `report_runs` row, dispatches the payload, and records the
   scraper's acknowledgement.

**Vercel plan note:** an hourly cron requires a plan that allows more than
one invocation per day (Vercel Hobby limits cron jobs to once daily). If you
are on Hobby, either upgrade, or set `CRON_MODE=daily` and
`NEXT_PUBLIC_CRON_MODE=daily` and change the `vercel.json` schedule to a
single fixed UTC hour (e.g. `"0 6 * * *"`). In `daily` mode every enabled
account is sent at that one fixed hour regardless of their
`preferred_report_time`, and the Settings page disables the hour picker with
an explanation, so the UI never promises something the schedule can't
deliver.

**Duplicate protection:** a unique partial index on
`report_runs(user_id, run_date)` (the account's **local** calendar date, not
UTC — computed by a trigger) blocks a second non-failed daily run for the
same account on the same local day, even under concurrent cron invocations.
A run stuck in `queued`/`sent`/`processing` for more than 30 minutes is
automatically marked `failed` at the top of every cron invocation, so a
crashed PHP worker cannot permanently block that day's slot.

## PHP scraper integration contract

### Authentication

- **Outbound** (this app → PHP): `Authorization: Bearer <SCRAPER_API_SECRET>`
- **Inbound callback** (PHP → this app): `Authorization: Bearer <SCRAPER_CALLBACK_SECRET>`

These are two different secrets. Compared with a constant-time check
(`crypto.timingSafeEqual`) on both ends of this app.

### Outbound request

`POST <SCRAPER_API_URL>`

```json
{
  "schemaVersion": 1,
  "reportRunId": "b6b6c2b0-...-uuid",
  "triggerType": "daily",
  "requestedAt": "2026-01-15T08:00:00.000Z",
  "callbackUrl": "https://tracker.laeto.example/api/reports/callback",
  "reportSettings": {
    "recipientEmail": "reports@laeto.example",
    "timezone": "Europe/London"
  },
  "products": [
    {
      "id": "8f1e...-uuid",
      "asin": "B000000000",
      "title": "LAETO product title",
      "imageUrl": "https://<project>.supabase.co/storage/v1/object/sign/...(24h signed URL, or null)",
      "competitors": [
        {
          "id": "1a2b...-uuid",
          "asin": "B111111111",
          "title": "Competitor title",
          "amazonUrl": "https://www.amazon.co.uk/dp/B111111111"
        }
      ]
    }
  ]
}
```

For a **daily** run, `products` only includes products with
`notifyEnabled = true` that have at least one competitor, for an account
with daily reports enabled. For a **manual** ("Check now") run, `products`
contains exactly the one product checked, and validation before dispatch
already guarantees it has at least one competitor.

### Expected acknowledgement (synchronous response)

The scraper must acknowledge **quickly** — it should accept the job and
process it asynchronously, not block on the actual scraping.

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
secrets), never shown to the browser.

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

Allowed `status` values from the scraper are **only** `processing`,
`completed`, `failed` (the app itself sets `queued` on creation and `sent`
the instant the outbound POST is acknowledged — the scraper never sends
either of those). Status can only move strictly forward
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

Set `SCRAPER_MOCK_MODE=true` to fully exercise the UI without a real PHP
service:

- No outbound HTTP call is made to `SCRAPER_API_URL`.
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
npm run test       # 65 unit tests, all passing
```

**What the 65 automated tests cover:** ASIN and Amazon-URL validation
(including edge cases like domains that merely contain "amazon" as a
substring), the report-run status transition rules (forward-only, `failed`
strictly terminal, replays rejected), scraper callback payload validation
(rejecting `queued`/`sent` from the scraper, malformed UUIDs, unknown
statuses), the outbound payload builder's shape against the documented
contract, the scraper dispatch client's full error taxonomy (timeout vs.
network vs. rejected vs. bad response — including that a fetch
`TimeoutError` is correctly distinguished from a generic `AbortError`), and
the constant-time bearer-token comparison used by the cron and callback
routes.

**Manually verified during development** (see the assumptions below for
what still needs a live project to confirm end-to-end): auth redirects in
both directions via `src/proxy.ts`; the full product create → image upload →
edit → replace image → remove image → delete lifecycle; competitor CRUD
including the 20-item cap and duplicate-ASIN rejection at both the Zod and
database layers; the notify toggle; global product search; settings save;
cron and callback bearer-auth rejection; mock mode's full round trip
including the auto-fired callback sequence; responsive layout at 375 / 768 /
1024 / 1440 widths with no horizontal overflow; keyboard-only navigation
through login, a dialog, and the top nav.

## Known limitations / remaining setup

- **A live Supabase project's credentials are required** to run the
  migrations and verify auth, CRUD, uploads and RLS end-to-end. Everything
  in this codebase that doesn't require a live database (schema design, RLS
  policy logic, validation, the scraper contract, the status-transition
  logic, mock mode, the full UI) has been built and is covered by the
  automated test suite above; the remaining items in this list need that
  live project connected once to confirm.
- **RLS is designed to be adversarially safe** (a competitor's ownership is
  enforced by a composite foreign key `(product_id, user_id) →
  products(id, user_id)` in addition to its own RLS policies, so a second
  user genuinely cannot read or write another account's data) but has not
  yet been exercised against a second real test user on a live project.
- **The real PHP scraper is out of scope for this repository.** Everything
  up to and including the outbound request and the callback contract is
  implemented and tested; the PHP side must be built separately against the
  contract documented above.
- **Vercel Hobby's once-daily cron limit** means the default `hourly`
  `CRON_MODE` needs a paid plan to actually run hourly; see [Configuring the
  daily cron](#configuring-the-daily-cron) for the `daily`-mode fallback.
- **Sub-hour report-time precision is not supported.** `preferred_report_time`
  is chosen from a 24-option hour picker, not a free time input, because no
  cron schedule cheaper than "run every minute" could honor finer precision.
