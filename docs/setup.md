# Development Setup

Step-by-step guide to run Voyr locally. For feature status, pending work, and a
full dependency matrix, see **[STATUS.md](./STATUS.md)**.

**Repository:** https://github.com/raioquantum-commits/Voyr

## Prerequisites

| Requirement                       | Notes                                                  |
| --------------------------------- | ------------------------------------------------------ |
| **Node.js** ≥ 20                  | LTS recommended                                        |
| **npm** ≥ 10                      | Monorepo workspaces                                    |
| **PostgreSQL**                    | Local Docker **or** Supabase project                   |
| **Redis**                         | Required at backend startup (`REDIS_URL`)              |
| **Git**                           | Clone from GitHub                                      |
| **DeepSeek API key**              | Default AI provider                                    |
| (Optional) **Travel API keys**    | Makcorps, Geoapify, Aviation Stack for live chat cards |
| (Optional) **Cloudflare account** | Gateway / Pages deploy                                 |
| (Optional) **Railway account**    | Production backend                                     |

## Quick start

```bash
git clone https://github.com/raioquantum-commits/Voyr.git
cd Voyr
npm install

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
cp gateway/.env.example gateway/.dev.vars
```

Edit `backend/.env` with at least:

```env
DATABASE_URL=postgresql://...
DB_SSL=true                    # Supabase only
JWT_SECRET=your-dev-secret     # must match gateway/.dev.vars
REDIS_URL=redis://localhost:6379
DEEPSEEK_API_KEY=sk-...
AI_PROVIDER=deepseek
ADMIN_EMAILS=you@example.com   # for /admin/* and /travel-visa/admin
```

Then migrate and seed:

```bash
cd backend
npm run migrate:up             # 19 migrations → 38 app tables
npx tsx src/db/run-seed.ts
npm run db:verify
cd ..
```

Run services (build shared types first):

```bash
npm run build --workspace=@voyr/shared
npm run dev:backend    # http://localhost:3001
npm run dev:frontend   # http://localhost:3000
```

Optional gateway (recommended if testing JWT flow end-to-end):

```bash
npm run dev:gateway    # http://127.0.0.1:8787
```

Set in `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8787
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Database setup

### Option A: Supabase (recommended)

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → Database → Connection string → URI** (direct
   connection).
3. Put the URI in `backend/.env` as `DATABASE_URL`.
   - Encode `@` in the password as `%40`.
4. Set `DB_SSL=true`.

**Schema:** 19 migrations create 38 application tables. `npm run db:verify`
reports 39 rows in `public` (includes `pgmigrations`).

### Option B: Local PostgreSQL (Docker)

From repo root:

```bash
docker-compose up postgres -d
```

Or standalone container:

```bash
docker run -d \
  --name voyr-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=voyr \
  -p 5432:5432 \
  postgres:16-alpine
```

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/voyr
DB_SSL=false
```

### Migrations and seed

From `backend/`:

| Command                                         | Purpose                              |
| ----------------------------------------------- | ------------------------------------ |
| `npm run migrate:up`                            | Apply all pending migrations         |
| `npm run migrate:down`                          | Roll back last migration             |
| `npm run migrate:create -- --name feature-name` | Scaffold new migration               |
| `npx tsx src/db/run-seed.ts`                    | Visa reference data + demo inventory |
| `npm run db:verify`                             | Print table list and migration count |

From repo root:

```bash
npm run db:migrate
npm run db:verify
```

---

## Supabase on Windows (pooler)

Direct Supabase host `db.<project>.supabase.co` is **IPv6-only**. On Windows,
`npm run migrate:up` often fails with `ENOTFOUND db.*.supabase.co`.

**Fix:** use the **session pooler** (port 6543). Two approaches:

### 1. Auto-detect pooler region (easiest)

```bash
cd backend
node scripts/detect-pooler-region.mjs
```

This probes Supabase pooler endpoints and prints suggested env vars. Add to
`backend/.env`:

```env
SUPABASE_POOLER_REGION=ap-southeast-2   # example — use your detected value
SUPABASE_POOLER_PREFIX=aws-1            # example — aws-0 or aws-1 per project
```

Keep your normal direct `DATABASE_URL`; `migrate-up.mjs` rewrites it to the
pooler automatically when `SUPABASE_POOLER_REGION` is set on Windows.

### 2. Paste pooler URI directly

From Supabase **Connect → Session pooler**, copy the full URI into
`DATABASE_URL` (port 6543, host `*.pooler.supabase.com`).

### 3. Explicit override

```env
DATABASE_POOLER_URL=postgresql://postgres.<ref>:...@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres
```

### How it works

`backend/scripts/resolve-database-url.mjs` mirrors runtime logic in
`src/db/database-url.ts`:

- On Windows, if `SUPABASE_POOLER_REGION` is set, direct `db.*.supabase.co` URLs
  are rewritten to the session pooler.
- In production (`NODE_ENV=production`), pooler is used by default unless
  `DB_USE_SUPABASE_POOLER=false`.

---

## Environment variables

### Backend (`backend/.env`)

| Variable                 | Required      | Description                                        |
| ------------------------ | ------------- | -------------------------------------------------- |
| `DATABASE_URL`           | Yes           | Postgres connection string                         |
| `DB_SSL`                 | Supabase      | `true` for Supabase                                |
| `SUPABASE_POOLER_REGION` | Windows dev   | Pooler region from Supabase dashboard              |
| `SUPABASE_POOLER_PREFIX` | Sometimes     | `aws-0` or `aws-1` (see detect script)             |
| `JWT_SECRET`             | Yes           | Must match gateway                                 |
| `REDIS_URL`              | Recommended   | Required in production; OTP/cache degraded without |
| `DEV_LOG_OTP`            | Local OTP     | `true` — log OTP to console when Resend unset      |
| `METRICS_TOKEN`          | Production    | Bearer token for `GET /metrics`                    |
| `AI_PROVIDER`            | No            | Default `deepseek`                                 |
| `DEEPSEEK_API_KEY`       | Yes (default) | DeepSeek API key                                   |
| `RESEND_API_KEY`         | OTP email     | Resend API key                                     |
| `EMAIL_FROM`             | Email         | e.g. `Voyr <onboarding@resend.dev>`                |
| `PAYMENT_MODE`           | No            | Default `mock`                                     |
| `MAKCORPS_API_KEY`       | Live hotels   | Makcorps hotel search                              |
| `GEOAPIFY_API_KEY`       | Live places   | Geoapify activities / geocoding                    |
| `AVIATION_STACK_API_KEY` | Live flights  | Aviation Stack routes                              |
| `ADMIN_EMAILS`           | Admin UI      | Comma-separated allowlist                          |
| `ADMIN_USER_IDS`         | Admin UI      | Optional UUID allowlist                            |
| `FRONTEND_URL`           | Prod          | Payment return URL base                            |
| `CORS_ORIGIN`            | Prod          | Must match frontend origin                         |

Full list: `backend/.env.example`.

### Frontend (`frontend/.env.local`)

| Variable                               | Required | Description                        |
| -------------------------------------- | -------- | ---------------------------------- |
| `NEXT_PUBLIC_API_URL`                  | Yes      | Gateway `:8787` or backend `:3001` |
| `NEXT_PUBLIC_APP_URL`                  | Yes      | `http://localhost:3000` locally    |
| `NEXT_PUBLIC_SUPABASE_URL`             | Optional | Supabase project URL               |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional | Supabase publishable key           |
| `NEXT_PUBLIC_MAPBOX_TOKEN`             | Optional | Trip map; placeholder if unset     |

Auth is **email OTP only** — no Google client ID required in the frontend.

### Gateway (`gateway/.dev.vars`)

| Variable         | Description                           |
| ---------------- | ------------------------------------- |
| `JWT_SECRET`     | Same value as `backend/.env`          |
| `BACKEND_ORIGIN` | `http://localhost:3001` for local dev |

Production `BACKEND_ORIGIN` is in `gateway/wrangler.toml` (Railway URL).

### Docker Compose

`docker-compose.yml` at repo root starts **Postgres only** (or Postgres +
backend image). It does **not** include Redis — run Redis separately or use
Redis Cloud.

---

## Admin UI (local)

1. Set `ADMIN_EMAILS=your@email.com` in `backend/.env`.
2. Log in via OTP at `/login`.
3. Visit:

| Route                | Purpose                                |
| -------------------- | -------------------------------------- |
| `/admin/ops`         | Booking/payment queues + fulfillments  |
| `/admin/listings`    | Curated inventory CRUD                 |
| `/admin/pricing`     | B2C and B2B margin rules               |
| `/admin/partners`    | B2B partner orgs + grant/revoke access |
| `/travel-visa/admin` | Visa data admin                        |

The frontend calls `GET /admin/access` before rendering admin shells.

---

## B2B partner portal (local)

The partner portal is a **separate surface** from the consumer site. Access is
**never self-service** — admins grant it per email.

### 1. Create a partner (admin)

1. Log in as an admin user.
2. Open `/admin/partners`.
3. **Create partner** — name, company code, optional contact email.
4. **Grant access** — add the partner user's email to the org.

### 2. Partner signs in

1. Partner visits `/partner` and signs in with the **same email** that was
   granted.
2. On OTP verify, backend runs `syncUserSegment()`:
   - Active membership → `user_travel_profiles.customer_segment = 'b2b'`
   - No membership → `'b2c'`
3. `GET /auth/me` returns `has_b2b_access`, `customer_segment`, and `partner`.

### 3. Partner uses the portal

| Route                | Purpose                          |
| -------------------- | -------------------------------- |
| `/partner/dashboard` | Partner home                     |
| `/partner/chat`      | AI planner with B2B margin rules |
| `/partner/bookings`  | Booking pipeline                 |

`PartnerGate` blocks routes if `has_b2b_access` is false.

### 4. Revoke access

From `/admin/partners`, revoke a member. On their next login, segment resets to
`b2c` and partner routes return 403.

### Pricing

B2B vs B2C rates come from `provider_margin_rules` (configured at
`/admin/pricing`). The pricing engine reads `customer_segment` from the user's
travel profile when applying margins to API and curated offers.

---

## API client (frontend)

Use `useApi()` from `frontend/src/app/auth/context.tsx`:

- `apiFetch(path, options)` — authenticated consumer/partner requests
- `adminFetch(path, options)` — admin routes
- Token refresh on `401` is handled in `AuthProvider`
- Profile fields: `customerSegment`, `hasB2BAccess`, `partner`,
  `refreshProfile()`

---

## Running the project

```bash
# Terminal 1 — Backend (:3001)
npm run dev:backend

# Terminal 2 — Frontend (:3000)
npm run dev:frontend

# Terminal 3 — Gateway (:8787, optional)
npm run dev:gateway
```

With gateway, set `NEXT_PUBLIC_API_URL=http://127.0.0.1:8787`.

---

## Production build (local check)

```bash
npm run build --workspace=frontend   # → frontend/out/
npm run build --workspace=backend    # → backend/dist/
npm run build --workspace=gateway    # wrangler dry-run
```

---

## Tests

```bash
npm test
npm run test --workspace=backend
npm run test --workspace=frontend
npm run test --workspace=gateway
```

Backend integration tests need PostgreSQL with migrated schema. Travel-visa
tests expect seeded data.

---

## Common issues

### `ENOTFOUND db.*.supabase.co` (Windows)

Set `SUPABASE_POOLER_REGION` (and optionally `SUPABASE_POOLER_PREFIX`), or run
`node scripts/detect-pooler-region.mjs`. Then retry `npm run migrate:up`.

### `SUPABASE_POOLER_REGION` required error

The migrate script detected a direct Supabase URL on Windows. Add pooler env
vars as above.

### `SELF_SIGNED_CERT_IN_CHAIN`

`npm run migrate:up` sets TLS for Supabase. Do not disable TLS in production.

### PostgreSQL connection refused (local)

Ensure Postgres is running and `DATABASE_URL` matches host/port/database.

### AI stream not responding

Check `DEEPSEEK_API_KEY` and `AI_PROVIDER=deepseek`.

### CORS errors

Set `CORS_ORIGIN=http://localhost:3000` in `backend/.env`.

### Gateway auth fails

`JWT_SECRET` in `gateway/.dev.vars` must exactly match `backend/.env`.

### Partner portal shows "access required"

Confirm the user's email is granted on an **active** partner at
`/admin/partners`, then log out and sign in again so segment sync runs.

### Visa or chat returns 401

Most API routes require login when using the gateway. Sign in at `/login` first.
See [STATUS.md](./STATUS.md#authentication-model-read-this-first).

### OTP email not received

Set `DEV_LOG_OTP=true` in `backend/.env` and check the backend console, or
configure `RESEND_API_KEY`. Resend test sender only delivers to your Resend
account email.

### Redis connection errors

Install and start local Redis, or set `REDIS_URL` to Redis Cloud. In development
Redis is optional unless `REDIS_REQUIRED=true`; in production it is mandatory.

### `Cannot find module '@voyr/shared'`

```bash
npm run build --workspace=@voyr/shared
```

Run before `npx tsc` in backend or `next build` in frontend.

### Share link shows error

`GET /conversations/shared/:token` is blocked without JWT — known gap documented
in [STATUS.md](./STATUS.md). Fix requires gateway + auth middleware whitelist.

### Wrangler deploy auth error

If `CLOUDFLARE_API_TOKEN` is R2-only, unset it and run `npx wrangler login`.

---

## Useful commands

```bash
cd backend
npm run migrate:create -- --name add-new-feature
npm run migrate:down
npm run db:verify

# From repo root
npm run deploy:cloudflare      # gateway + Pages
npm run deploy:railway:env     # sync backend/.env → Railway
```
