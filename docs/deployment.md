# Deployment Guide

Production layout:

```
Cloudflare Pages (frontend)
    → Cloudflare Worker (gateway, JWT)
        → Railway (Express backend, Docker)
            → Supabase PostgreSQL
            → Redis Cloud
            → Cloudflare R2 (PDF documents)
```

This document covers the full production deploy. For Railway-specific steps see
[railway-deploy.md](./railway-deploy.md). For mock-payment launch checklist see
[tier-c-deploy.md](./tier-c-deploy.md).

## Architecture

```
┌──────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│ Cloudflare Pages │────▶│ Cloudflare Worker   │────▶│ Railway (Docker)    │
│ voyr-frontend    │     │ voyr-travel-ops     │     │ voyr-backend        │
└──────────────────┘     └─────────────────────┘     └──────────┬──────────┘
                                                                   │
                          ┌────────────────────────────────────────┤
                          │                                        │
                   ┌──────▼──────┐  ┌─────────────┐  ┌────────────▼────────┐
                   │  Supabase   │  │ Redis Cloud │  │ Cloudflare R2       │
                   │  PostgreSQL │  │             │  │ (+ public r2.dev)   │
                   │  38 app tables  │  │             │  │                     │
                   └─────────────┘  └─────────────┘  └─────────────────────┘
```

**Production URLs (June 2026):**

| Service  | URL                                                 |
| -------- | --------------------------------------------------- |
| Frontend | https://voyr-frontend.pages.dev                     |
| Gateway  | https://voyr-travel-ops.aryansaxenaalig.workers.dev |
| Backend  | https://voyr-backend-production.up.railway.app      |

Consumer routes: `/`, `/chat`, `/bookings`, etc.

B2B partner routes: `/partner`, `/partner/chat`, `/partner/bookings`
(admin-granted access only).

Admin routes: `/admin/ops`, `/admin/listings`, `/admin/pricing`,
`/admin/partners`.

---

## Prerequisites

| Account / service      | Purpose                                           |
| ---------------------- | ------------------------------------------------- |
| Cloudflare             | Pages, Workers, R2                                |
| Railway                | Backend hosting (Docker)                          |
| Supabase               | Managed PostgreSQL                                |
| Redis Cloud            | OTP, caching, rate limits                         |
| DeepSeek               | Default AI provider                               |
| Resend                 | OTP and transactional email                       |
| Travel APIs (optional) | Makcorps, Geoapify, Aviation Stack for live cards |

Set `PAYMENT_MODE=mock` for Tier C (no live Razorpay yet).

---

## 1. Database (Supabase)

Run **once from your machine** (not on Railway):

```bash
cd backend
npm run migrate:up    # 19 migrations (includes B2B partners: 019)
npx tsx src/db/run-seed.ts
npm run db:verify
```

**Windows:** if direct Supabase host fails, set `SUPABASE_POOLER_REGION` and
`SUPABASE_POOLER_PREFIX` in `backend/.env` before migrating (see
[setup.md](./setup.md#supabase-on-windows-pooler)).

Push connection vars to Railway:

```powershell
.\scripts\railway-sync-env.ps1
```

Required on Railway:

```env
DATABASE_URL=postgresql://...   # @ in password → %40
DB_SSL=true
```

Railway runtime uses the pooler automatically in production when configured via
`DATABASE_URL` or pooler env vars.

---

## 2. Backend (Railway)

See [railway-deploy.md](./railway-deploy.md) for CLI steps and troubleshooting.

```bash
railway login
railway link                    # project: voyr-backend
.\scripts\railway-sync-env.ps1
railway domain --service voyr-backend
railway up --service voyr-backend
```

**Docker:** `docker/backend.Dockerfile` (monorepo root build via
`railway.toml`).

### Required Railway variables

| Variable           | Notes                                           |
| ------------------ | ----------------------------------------------- |
| `DATABASE_URL`     | Supabase URI                                    |
| `DB_SSL`           | `true`                                          |
| `JWT_SECRET`       | **Must match gateway**                          |
| `REDIS_URL`        | Redis Cloud URL                                 |
| `NODE_ENV`         | `production`                                    |
| `FRONTEND_URL`     | `https://voyr-frontend.pages.dev`               |
| `CORS_ORIGIN`      | Same as `FRONTEND_URL`                          |
| `AI_PROVIDER`      | `deepseek`                                      |
| `DEEPSEEK_API_KEY` | …                                               |
| `RESEND_API_KEY`   | …                                               |
| `EMAIL_FROM`       | `Voyr <onboarding@resend.dev>`                  |
| `PAYMENT_MODE`     | `mock`                                          |
| `ADMIN_EMAILS`     | Comma-separated admin emails                    |
| R2 vars            | PDF uploads; `R2_PUBLIC_URL` = r2.dev subdomain |

Optional: `MAKCORPS_API_KEY`, `GEOAPIFY_API_KEY`, `AVIATION_STACK_API_KEY`,
`QUEUE_URL` for async document workers.

Verify:

```bash
curl https://voyr-backend-production.up.railway.app/health
```

Expected: `{ "status": "ok", "database": "connected", ... }`

---

## 3. Gateway (Cloudflare Worker)

```bash
cd gateway
# Prefer OAuth over R2-only API tokens:
Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
npx wrangler login

npx wrangler secret put JWT_SECRET    # same as backend
npx wrangler deploy
```

`BACKEND_ORIGIN` is set in `gateway/wrangler.toml`:

```toml
[vars]
BACKEND_ORIGIN = "https://voyr-backend-production.up.railway.app"
```

Local dev overrides via `gateway/.dev.vars` → `http://localhost:3001`.

**Do not** also define `BACKEND_ORIGIN` as a wrangler secret (binding name
conflict).

Public routes (no JWT): `/auth/login`, `/auth/verify`, `/auth/refresh`,
`/auth/google`, `/auth/logout`, `/webhook/payment`, `/health`.

---

## 4. Frontend (Cloudflare Pages)

Build environment (CI or local before deploy):

```bash
NEXT_PUBLIC_API_URL=https://voyr-travel-ops.aryansaxenaalig.workers.dev
NEXT_PUBLIC_APP_URL=https://voyr-frontend.pages.dev
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SENTRY_DSN=...   # optional
```

Deploy:

```bash
cd frontend
npm run build
npx wrangler pages deploy out --project-name voyr-frontend --branch main
```

Or from repo root: `npm run deploy:cloudflare`.

Static export writes to **`frontend/out/`** (not `.next/`).

---

## 5. B2B partners (post-deploy)

After migration 019 is applied:

1. Log in as an admin (`ADMIN_EMAILS`).
2. Open **https://voyr-frontend.pages.dev/admin/partners**.
3. Create a partner organization (name + company code).
4. **Grant access** by partner user email.
5. Partner signs in at **/partner** with that email.
6. Confirm B2B pricing via `/admin/pricing` margin rules with
   `customer_segment = b2b`.

Revoking a member resets them to B2C on next login.

---

## 6. Cloudflare R2 (documents)

Configure bucket + S3 credentials in Railway env. Set `R2_PUBLIC_URL` to your
public `pub-*.r2.dev` URL so PDF links work in the browser.

Reference: `infra/r2-config.toml`.

---

## 7. Queues (optional)

Without `QUEUE_URL`, document jobs run **inline** after payment (see
`document.service.ts`). For async workers, create queues per
`infra/queues-config.toml` and set `QUEUE_URL` on Railway.

---

## 8. CI/CD

`.github/workflows/ci.yml` on push to `main`:

1. Lint + test (backend, frontend, gateway)
2. Set gateway `JWT_SECRET` secret
3. Deploy gateway worker
4. Build frontend with production `NEXT_PUBLIC_*` vars
5. Deploy Pages (`out/`)

GitHub secrets / vars:

| Name                     | Purpose                           |
| ------------------------ | --------------------------------- |
| `CLOUDFLARE_API_TOKEN`   | Workers + Pages deploy            |
| `CLOUDFLARE_ACCOUNT_ID`  | Account ID                        |
| `JWT_SECRET`             | Gateway worker secret             |
| `NEXT_PUBLIC_API_URL`    | Repo variable (optional override) |
| `NEXT_PUBLIC_APP_URL`    | Repo variable                     |
| `NEXT_PUBLIC_SUPABASE_*` | Repo variables                    |

Backend deploy is **manual via Railway CLI** (or Railway GitHub integration).

---

## 9. Monitoring

| Endpoint / config   | Purpose                           |
| ------------------- | --------------------------------- |
| `GET /health`       | Database connectivity             |
| `GET /metrics`      | Request metrics                   |
| `SENTRY_DSN`        | Backend + frontend error tracking |
| `ALERT_WEBHOOK_URL` | Optional Slack alerts             |

---

## 10. Security checklist

- [ ] `JWT_SECRET` identical on backend (Railway) and gateway (wrangler secret)
- [ ] `CORS_ORIGIN` matches Pages URL only
- [ ] `ADMIN_EMAILS` set in production (no open admin)
- [ ] Resend sender verified before production email volume
- [ ] Never commit `.env` / `.dev.vars`
- [ ] Unset R2-only `CLOUDFLARE_API_TOKEN` when deploying Workers via OAuth
- [ ] B2B access granted only via `/admin/partners` (no public signup)
- [ ] Rotate keys if exposed in chat or logs

---

## Related docs

| Document                                 | Description                      |
| ---------------------------------------- | -------------------------------- |
| [STATUS.md](./STATUS.md)                 | Feature status and limitations   |
| [setup.md](./setup.md)                   | Local development                |
| [railway-deploy.md](./railway-deploy.md) | Railway-specific troubleshooting |
| [tier-c-deploy.md](./tier-c-deploy.md)   | Mock payment launch checklist    |
| [architecture.md](./architecture.md)     | System design and B2B flows      |
| [api.md](./api.md)                       | REST API reference               |
