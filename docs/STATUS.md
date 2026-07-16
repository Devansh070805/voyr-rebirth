# Project status

Last updated: June 2026. **Start here** after [README.md](../README.md) to
understand what is built, what is not, and how to run or extend Voyr without
extra context.

**Repository:** https://github.com/raioquantum-commits/Voyr

---

## Summary

Voyr is an AI travel **broker**: users plan trips in chat, pick options from
cards, receive priced quotes with margin tracking, and complete checkout. Admins
manage curated inventory, B2C/B2B margin rules, partner access, and ops queues.
Payments are **mocked** in production (Tier C); live Razorpay is scaffolded but
not integrated.

| Layer                                    | Status                               |
| ---------------------------------------- | ------------------------------------ |
| Consumer app (`/`, `/chat`, trips, visa) | **Shipped** (login required for API) |
| B2B partner portal (`/partner/*`)        | **Shipped**                          |
| Admin (`/admin/*`, `/travel-visa/admin`) | **Shipped**                          |
| Mock booking + documents + email         | **Shipped**                          |
| Live payments (Razorpay)                 | **Not implemented**                  |
| Live supplier booking (Riya / GDS)       | **Stub only**                        |

---

## Authentication model (read this first)

Production traffic flows **Frontend → Gateway (JWT) → Backend (`x-user-id`)**.

### Gateway public routes (no JWT)

Defined in `gateway/src/index.ts`:

- `POST /auth/login`, `/auth/verify`, `/auth/refresh`, `/auth/google`,
  `/auth/logout`
- `POST /webhook/payment`
- `/landing` (legacy passthrough)

**Everything else requires a valid JWT**, including `/ai/stream`,
`/travel-visa/*`, `/conversations/*`, `/package`, `/quote`, `/payment/session`,
`/partner/*`, `/admin/*`.

### Backend public routes (no `x-user-id`)

Defined in `backend/src/infra/auth.middleware.ts`:

- `GET /health`, `GET /metrics`
- `POST /auth/login`, `/auth/verify`, `/auth/refresh`, `/auth/google`,
  `/auth/logout`
- `POST /webhook/*`

### What requires login in the UI

| Feature                   | Login required?        | Notes                                                          |
| ------------------------- | ---------------------- | -------------------------------------------------------------- |
| Landing `/`               | No                     | Static page                                                    |
| Chat `/chat`              | **Yes to send**        | Guest banner shown; `sendMessage` opens login modal            |
| Visa checker              | **Yes**                | Uses `apiFetch` → JWT required via gateway                     |
| Bookings, trips, saved    | **Yes**                | Protected routes                                               |
| Partner portal            | **Yes + B2B grant**    | `PartnerGate`                                                  |
| Admin                     | **Yes + allowlist**    | `AdminGate` + `GET /admin/access`                              |
| Share link `/chat/shared` | **Broken via gateway** | Frontend fetches without JWT; gateway blocks — see limitations |

### Local dev without gateway

You may set `NEXT_PUBLIC_API_URL=http://localhost:3001` and send
`Authorization: Bearer <token>` + `x-user-id` manually. The frontend still
expects login for protected features.

---

## Features implemented

### Authentication and users

| Feature                  | Notes                                                            |
| ------------------------ | ---------------------------------------------------------------- |
| Email OTP login          | `POST /auth/login`, `/auth/verify`; Resend or `DEV_LOG_OTP=true` |
| JWT access + refresh     | 15m access, 7d refresh; stored in `localStorage`                 |
| Profile + segment        | `GET /auth/me` — B2C/B2B segment and partner info                |
| Google sign-in (backend) | `POST /auth/google`; **no login button in UI**                   |
| Admin allowlist          | `ADMIN_EMAILS` / `ADMIN_USER_IDS`; `GET /admin/access`           |
| OAuth user columns       | `users.google_id`, `auth_provider`, `display_name`, `avatar_url` |

### AI chat and planning

| Feature                  | Notes                                                           |
| ------------------------ | --------------------------------------------------------------- |
| SSE streaming            | `POST /ai/stream`; rate limit 20 req/hour/user                  |
| Broker flow router       | `broker-flow.router.ts` — cards before LLM when possible        |
| Live supply fetch        | Makcorps / Geoapify / Aviation + curated listings               |
| Generative UI cards      | Hotels, activities, flights, tickets, itinerary, visa, checkout |
| Conversation persistence | `conversations`, `conversation_messages`, `plan_data` JSON      |
| Rolling summary          | Compaction after long threads                                   |
| Card selections          | `POST /conversations/:id/plan/select`                           |
| Share token generation   | `POST /conversations/:id/share`                                 |
| Booking tools            | `create_package`, `generate_quote`, `start_checkout`            |
| AI providers             | DeepSeek (default), OpenAI, Anthropic, OpenRouter               |

### Supply and pricing

| Feature             | Notes                                                          |
| ------------------- | -------------------------------------------------------------- |
| Makcorps hotels     | `GET /hotels/*` when `MAKCORPS_API_KEY` set                    |
| Geoapify places     | `GET /places/*` when `GEOAPIFY_API_KEY` set                    |
| Aviation Stack      | `GET /flights/*` when `AVIATION_STACK_API_KEY` set             |
| Tinyfish web search | `POST /search` for AI research tool                            |
| Curated listings    | Admin CRUD; **Voyr Pick** badges in chat                       |
| Margin rules        | `provider_margin_rules` — B2C/B2B by provider/destination/type |
| Quote snapshots     | Immutable `quote_items` with cost, sell, margin, segment       |

### Booking and payments

| Feature                    | Notes                                                |
| -------------------------- | ---------------------------------------------------- |
| Package → quote → checkout | Full pipeline via AI tools                           |
| Mock payments              | `PAYMENT_MODE=mock`; `/payment/mock` UI              |
| Auto booking confirm       | After mock complete or webhook; no manual admin step |
| Booking state machine      | 17 states in `state-machine.engine.ts`               |
| Idempotency                | `idempotency_keys` table                             |
| Fulfillment ledger         | `booking_fulfillments` per quote line                |
| PDF documents              | `pdfkit` → R2 when configured                        |
| Email notifications        | Resend                                               |

### B2B partner portal

| Feature            | Notes                                                      |
| ------------------ | ---------------------------------------------------------- |
| Partner orgs       | `b2b_partners`, `b2b_partner_members`                      |
| Admin grant/revoke | `/admin/partners`                                          |
| Segment sync       | On OTP verify — `syncUserSegment()`                        |
| Partner routes     | `/partner/dashboard`, `/partner/chat`, `/partner/bookings` |

### Travel visa

| Feature              | Notes                                                                |
| -------------------- | -------------------------------------------------------------------- |
| Checker UI           | `/travel-visa`, `/travel-visa/compare`, `/travel-visa/[destination]` |
| Data                 | 9 passports × 40 destinations; 331 requirements (after seed)         |
| Admin CRUD           | `/travel-visa/admin`                                                 |
| Corrections workflow | User submit → admin approve/reject                                   |
| AI tool              | `show_visa_info` in chat                                             |
| CSV refresh          | `refresh-from-passport-index.ts`                                     |

### Consumer UI pages (all static-exported)

| Route                                             | Backend deps                    |
| ------------------------------------------------- | ------------------------------- |
| `/`                                               | None (Unsplash images external) |
| `/chat`, `/chat/shared`                           | Conversations, AI               |
| `/login`, `/verify`                               | Auth                            |
| `/trips`, `/bookings`, `/saved`, `/notifications` | User APIs                       |
| `/travel-visa/*`                                  | Visa APIs                       |
| `/payment/mock`, `/payment/return`                | Payment APIs                    |
| `/partner/*`                                      | Partner + chat APIs             |
| `/admin/*`                                        | Admin APIs                      |

### Infrastructure

| Component      | Technology                                                    |
| -------------- | ------------------------------------------------------------- |
| Frontend       | Next.js 15 static export → Cloudflare Pages                   |
| Gateway        | Cloudflare Worker `voyr-travel-ops`                           |
| Backend        | Express on Railway (Docker)                                   |
| Database       | Supabase PostgreSQL                                           |
| Cache          | Redis (strict in production)                                  |
| Storage        | Cloudflare R2 (PDFs)                                          |
| CI/CD          | GitHub Actions — lint, test, deploy gateway + Pages on `main` |
| Backend deploy | **Manual** Railway CLI (`railway up`)                         |

---

## Features not implemented / pending

| Area                       | Current state                                           | What’s needed                                                                  |
| -------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Live Razorpay**          | Mock only                                               | Razorpay Orders API in `payment.service.ts`; `PAYMENT_MODE=live`; webhook HMAC |
| **Riya Connect**           | Stub adapter — empty search, `book()` throws            | `travel-supply.adapters.ts`                                                    |
| **Provider API booking**   | Discovery only                                          | Automated `pending_provider` fulfillment                                       |
| **Google OAuth UI**        | Backend + `loginWithGoogle()` in context                | Button on `/login`                                                             |
| **Public share links**     | UI exists; API blocked by gateway/auth                  | Add public route for `GET /conversations/shared/:token`                        |
| **Async queues**           | Inline document jobs when `QUEUE_URL` unset             | `infra/queues-config.toml` workers                                             |
| **Railway autodeploy**     | Manual                                                  | Optional GitHub integration                                                    |
| **Custom email domain**    | `onboarding@resend.dev` test sender                     | Verify domain in Resend                                                        |
| **Fulfillment automation** | Manual ops queue                                        | Supplier confirm integrations                                                  |
| **Inventory API booking**  | Legacy `inventory` module; not used in chat broker path | Consolidate or document as legacy                                              |
| **Sentry Next.js**         | Warnings on build                                       | Migrate to `instrumentation.ts` per Sentry docs                                |

---

## Known limitations and issues

### Critical gaps

| Issue                    | Impact                                        | Workaround                                             |
| ------------------------ | --------------------------------------------- | ------------------------------------------------------ |
| **Share links need JWT** | `/chat/shared?token=` returns 401 via gateway | Fix: whitelist route in gateway + `auth.middleware.ts` |
| **Visa requires login**  | Cannot check visas anonymously in production  | Expected for now; login first                          |
| **Chat guest mode**      | UI visible but cannot send messages           | Login modal on send                                    |

### Platform

- **Static export** — no Next.js API routes; all data via gateway/backend.
- **Quote immutability** — 48h expiry; regenerate quote for new pricing.
- **Monolithic backend** — one Postgres DB, one deploy unit.
- **Proprietary license** — no OSS redistribution; see [LICENSE](../LICENSE).

### Development

| Issue                | Detail                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Windows + Supabase   | Direct host IPv6-only — use pooler ([setup.md](./setup.md))                                |
| Redis in dev         | Optional unless `REDIS_REQUIRED=true`; backend starts without Redis but OTP/cache degraded |
| `docker-compose.yml` | Postgres + backend only — **no Redis service**; run Redis separately                       |
| CI lint              | `continue-on-error: true` — lint warnings do not fail CI                                   |
| Frontend ESLint      | Skipped in production build                                                                |
| Shared package       | Must `npm run build --workspace=@voyr/shared` before backend `tsc`                         |
| Backend CI           | No Redis service — tests mock Redis where needed                                           |

### Data

- Visa data from passport-index CSV — **not legal advice**; verify officially.
- Unsplash URLs on landing — require network at runtime.
- `DEV_LOG_OTP=true` — logs OTP to console when Resend unset (local only).

### Security

- Admin = email allowlist only; no RBAC roles.
- Partner access = email grant; re-login after revoke for segment sync.
- `GET /metrics` — Bearer `METRICS_TOKEN` required in production.

---

## Dependencies and services

### Minimum local dev

| Dependency             | Required?   | Notes                                                       |
| ---------------------- | ----------- | ----------------------------------------------------------- |
| Node.js ≥ 20, npm ≥ 10 | Yes         |                                                             |
| PostgreSQL 16          | Yes         | Docker or Supabase                                          |
| Redis                  | Recommended | `redis://127.0.0.1:6379`; required in production            |
| `DEEPSEEK_API_KEY`     | Yes         | Default AI                                                  |
| `JWT_SECRET`           | Yes         | Match gateway                                               |
| `RESEND_API_KEY`       | No          | Use `DEV_LOG_OTP=true` instead                              |
| Travel API keys        | No          | Chat works with curated listings only; live cards need keys |

### Production backend (enforced)

From `backend/src/infra/env-validation.ts` when `NODE_ENV=production`:

`JWT_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`, `CORS_ORIGIN`, `FRONTEND_URL`,
`METRICS_TOKEN`, `MAKCORPS_API_KEY`, `GEOAPIFY_API_KEY`,
`AVIATION_STACK_API_KEY`

Also required at runtime: `REDIS_URL` (startup fails in production if Redis
unreachable).

### Full env reference

Copy from examples — never commit real values:

| File                    | Purpose                               |
| ----------------------- | ------------------------------------- |
| `backend/.env.example`  | All backend vars with comments        |
| `frontend/.env.example` | `NEXT_PUBLIC_*` vars                  |
| `gateway/.env.example`  | Worker dev vars → `gateway/.dev.vars` |

### npm workspaces

```bash
npm install
npm run build --workspace=@voyr/shared   # always before backend tsc / frontend build
```

| Package          | Path                                                          |
| ---------------- | ------------------------------------------------------------- |
| `@voyr/frontend` | `frontend/`                                                   |
| `@voyr/backend`  | `backend/`                                                    |
| `@voyr/gateway`  | `gateway/`                                                    |
| `@voyr/shared`   | `shared/` — exports visa, pricing, stream, conversation types |

### External services (production)

Supabase, Railway, Cloudflare (Pages, Workers, R2), Redis Cloud, Resend,
DeepSeek, Makcorps, Geoapify, Aviation Stack.

---

## Database schema

### Migrations (19)

| #       | File                             | Adds                                             |
| ------- | -------------------------------- | ------------------------------------------------ |
| 001     | `initial-schema`                 | Core booking, inventory, payments, quotes, audit |
| 002     | `otp-codes`                      | `otp_codes`                                      |
| 003–006 | fixes                            | Constraints, quote trigger, booking status       |
| 004     | `packages-trip-details`          | Package trip metadata columns                    |
| 007     | `conversations`                  | `conversations`, `conversation_messages`         |
| 008     | `travel_visa_requirements`       | Visa tables (4)                                  |
| 009     | `visa_corrections`               | `visa_corrections`                               |
| 010     | `saved_trips`                    | `saved_trips`                                    |
| 011     | `oauth_and_refresh_tokens`       | `refresh_tokens`, user OAuth columns             |
| 012     | `settle_legacy_pending_bookings` | Data migration                                   |
| 013     | `conversation_plan_data`         | `plan_data`, `rolling_summary`                   |
| 014     | `curated_listings`               | `curated_listings`                               |
| 015     | `provider_margin_rules`          | `provider_margin_rules`                          |
| 016     | `booking_fulfillments`           | `booking_fulfillments`                           |
| 017     | `user_travel_profiles`           | `user_travel_profiles`                           |
| 018     | `package_item_broker_snapshot`   | Broker columns on package items                  |
| 019     | `b2b_partners`                   | `b2b_partners`, `b2b_partner_members`            |

### Tables (38 application + `pgmigrations`)

`npm run db:verify` lists **39** rows in `public` schema: 38 application tables
plus `pgmigrations` (node-pg-migrate).

**Core booking:** `users`, `packages`, `package_items`, `quotes`, `quote_items`,
`quote_events`, `payments`, `payment_events`, `bookings`, `booking_items`,
`booking_events`, `documents`, `document_jobs`, `idempotency_keys`, `audit_logs`

**Inventory (legacy/demo):** `suppliers`, `locations`, `services`,
`service_options`, `service_prices`, `service_availability`, `service_policies`

**Broker:** `curated_listings`, `provider_margin_rules`, `booking_fulfillments`,
`user_travel_profiles`

**Chat:** `conversations`, `conversation_messages`

**Auth:** `otp_codes`, `refresh_tokens`

**B2B:** `b2b_partners`, `b2b_partner_members`

**Visa:** `travel_countries`, `travel_visa_requirements`, `visa_documents`,
`visa_fees`, `visa_corrections`

**Other:** `saved_trips`

---

## Backend modules

Mounted in `backend/src/index.ts`:

| Module           | Route prefix                  | Purpose                         |
| ---------------- | ----------------------------- | ------------------------------- |
| auth             | `/auth`                       | OTP, JWT, Google, `/me`         |
| ai-gateway       | `/ai`                         | Streaming chat                  |
| conversation     | `/conversations`              | Persistence, share, plan select |
| trip-plan        | `/conversations/:id/plan`     | Selections (nested)             |
| package          | `/package`                    | Trip packages                   |
| quote            | `/quote`                      | Immutable quotes                |
| payment          | `/payment`                    | Sessions, mock complete         |
| webhook          | `/webhook`                    | Payment webhooks                |
| booking          | `/booking`                    | Booking read                    |
| documents        | `/documents`                  | PDF jobs                        |
| notifications    | `/notifications`              | User notifications              |
| admin-ops        | `/admin`                      | Ops queues                      |
| curated-listings | `/admin/listings`             | Inventory CRUD                  |
| pricing          | `/admin/pricing`              | Margin rules                    |
| partner          | `/partner`, `/admin/partners` | B2B                             |
| travel-visa      | `/travel-visa`                | Visa API                        |
| geoapify         | `/places`                     | Places proxy                    |
| makcorps         | `/hotels`                     | Hotels proxy                    |
| aviation-stack   | `/flights`                    | Flights proxy                   |
| tinyfish         | `/search`                     | Web search                      |
| inventory        | `/inventory`                  | Legacy supplier CRUD            |
| saved-trips      | `/saved-trips`                | Wishlist                        |

---

## Datasets, seeds, and assets

### Seeds

```bash
cd backend && npx tsx src/db/run-seed.ts
```

| Seed           | File                  | Contents                                     |
| -------------- | --------------------- | -------------------------------------------- |
| Travel visa    | `seed-travel-visa.ts` | Countries, requirements, docs, fees          |
| Demo inventory | `seed-inventory.ts`   | Bali demo hotel — skipped if suppliers exist |

Visa refresh: `npx tsx src/db/refresh-from-passport-index.ts` (downloads CSV
from GitHub).

### Frontend assets (in repo)

| Path                                                              | Description          |
| ----------------------------------------------------------------- | -------------------- |
| `frontend/public/images/Voyr-logo.png`                            | Logo                 |
| `frontend/public/images/hero-section-background.jpg`              | Hero background      |
| `frontend/public/images/hero-section-floater-left-side-plane.png` | Hero decoration      |
| `frontend/public/images/hero-section-bg.jpg`                      | Alternate hero       |
| `frontend/public/images/illustration.png`                         | Landing illustration |
| `frontend/src/data/globe.json`                                    | Globe GeoJSON        |

External: Unsplash URLs in `page.tsx` and `lib/utils.ts`.

---

## How to continue development

### Read order

1. This file (`STATUS.md`)
2. [architecture.md](./architecture.md)
3. [api.md](./api.md)
4. [agents/domain.md](./agents/domain.md)
5. [setup.md](./setup.md) — run locally
6. [deployment.md](./deployment.md) — ship changes

### Extension points

| Task               | Location                                                               |
| ------------------ | ---------------------------------------------------------------------- |
| New AI tool / card | `backend/src/modules/ai-gateway/`, `frontend/src/app/chat/components/` |
| New admin page     | `frontend/src/app/admin/`, matching `backend/src/modules/*/routes`     |
| Live payments      | `backend/src/modules/payment/payment.service.ts`                       |
| Supplier booking   | `backend/src/modules/travel-supply/travel-supply.adapters.ts`          |
| Fix share links    | `gateway/src/index.ts`, `auth.middleware.ts`, `conversation.routes.ts` |
| New migration      | `cd backend && npm run migrate:create -- --name feature`               |

### Tests

```bash
npm run build --workspace=@voyr/shared
npm run test --workspace=backend    # needs Postgres + migrate + seed
npm run test --workspace=frontend
npm run test --workspace=gateway
```

### Deploy after changes

| Component       | Command                                               |
| --------------- | ----------------------------------------------------- |
| Gateway + Pages | `npm run deploy:cloudflare` or push to `main` (CI)    |
| Backend         | `railway up --service voyr-backend`                   |
| Migrations      | `npm run db:migrate` (from your machine, not Railway) |

---

## Production URLs

| Service  | URL                                                 |
| -------- | --------------------------------------------------- |
| Frontend | https://voyr-frontend.pages.dev                     |
| Gateway  | https://voyr-travel-ops.aryansaxenaalig.workers.dev |
| Backend  | https://voyr-backend-production.up.railway.app      |

---

## Documentation index

| Document                                                     | Purpose                                 |
| ------------------------------------------------------------ | --------------------------------------- |
| [setup.md](./setup.md)                                       | Installation, env vars, troubleshooting |
| [architecture.md](./architecture.md)                         | System design, flows                    |
| [api.md](./api.md)                                           | REST reference                          |
| [deployment.md](./deployment.md)                             | Production deploy                       |
| [tier-c-deploy.md](./tier-c-deploy.md)                       | Mock-payment checklist                  |
| [railway-deploy.md](./railway-deploy.md)                     | Railway specifics                       |
| [travel-visa/requirements.md](./travel-visa/requirements.md) | Visa spec                               |
| [travel-visa/design.md](./travel-visa/design.md)             | Visa technical design                   |
| [agents/domain.md](./agents/domain.md)                       | Domain vocabulary                       |
| [agents/issue-tracker.md](./agents/issue-tracker.md)         | GitHub Issues workflow                  |
