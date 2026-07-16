# Voyr — AI Travel Platform

Voyr is an AI-powered travel **broker**: customers plan trips in natural
language, select options from interactive cards, and checkout through Voyr. The
platform tracks cost, sell price, and margin on every line item — with separate
pricing for **consumers (B2C)** and **partners (B2B)**.

**Repository:** https://github.com/raioquantum-commits/Voyr

> **New contributors:** read **[docs/STATUS.md](./docs/STATUS.md)** first — it
> lists everything implemented, pending, broken, and required to run the
> project.

---

## At a glance

| Audience     | Surface                      | Pricing                                |
| ------------ | ---------------------------- | -------------------------------------- |
| Consumers    | `/`, `/chat`, trips, visa    | B2C margin rules                       |
| B2B partners | `/partner/*` (admin-granted) | B2B wholesale margins                  |
| Admins       | `/admin/*`, visa admin       | Configure inventory, margins, partners |

**Production:** [Frontend](https://voyr-frontend.pages.dev) ·
[Gateway](https://voyr-travel-ops.aryansaxenaalig.workers.dev) ·
[Backend](https://voyr-backend-production.up.railway.app)

For a full list of what is **implemented vs pending**, known issues, seeds, and
dependencies, see **[docs/STATUS.md](./docs/STATUS.md)**.

---

## Architecture

```
Browser → Cloudflare Pages (Next.js) → Cloudflare Worker (JWT) → Railway (Express)
                                              ↓
                         Supabase Postgres · Redis · Cloudflare R2
```

| Layer    | Technology                                                            |
| -------- | --------------------------------------------------------------------- |
| Frontend | Next.js 15, React 19, Tailwind — static export to Cloudflare Pages    |
| Gateway  | Cloudflare Worker `voyr-travel-ops`                                   |
| Backend  | Node.js 20, Express, TypeScript — Docker on Railway                   |
| Database | Supabase PostgreSQL — 19 migrations, 38 app tables (+ `pgmigrations`) |
| AI       | DeepSeek (default); also OpenAI, Anthropic, OpenRouter                |
| Payments | **Mock only** today (`PAYMENT_MODE=mock`); Razorpay scaffolded        |

Details: [docs/architecture.md](./docs/architecture.md)

---

## Quick start

### Prerequisites

- Node.js ≥ 20, npm ≥ 10
- PostgreSQL 16 (Docker or Supabase)
- Redis (recommended locally; **required** in production)
- [DeepSeek API key](https://platform.deepseek.com) (default AI provider)

Optional for live chat cards: Makcorps, Geoapify, Aviation Stack API keys.

### Install and run

```bash
git clone https://github.com/raioquantum-commits/Voyr.git
cd Voyr
npm install

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
cp gateway/.env.example gateway/.dev.vars
```

Edit `backend/.env` — minimum:

```env
DATABASE_URL=postgresql://...
DB_SSL=true              # Supabase only
JWT_SECRET=your-secret   # must match gateway/.dev.vars
REDIS_URL=redis://127.0.0.1:6379
DEEPSEEK_API_KEY=sk-...
ADMIN_EMAILS=you@example.com
```

**Windows + Supabase:** set `SUPABASE_POOLER_REGION` (see
[setup.md](./docs/setup.md)) or run
`node backend/scripts/detect-pooler-region.mjs`.

```bash
cd backend
npm run migrate:up
npx tsx src/db/run-seed.ts
cd ..

npm run dev:backend    # http://localhost:3001
npm run dev:frontend   # http://localhost:3000
```

Optional gateway (recommended for JWT flow):

```bash
npm run dev:gateway    # http://127.0.0.1:8787
# Set NEXT_PUBLIC_API_URL=http://127.0.0.1:8787 in frontend/.env.local
```

**Docker alternative** (Postgres + backend only):

```bash
docker-compose up postgres -d
# Set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/voyr, DB_SSL=false
```

Full instructions: **[docs/setup.md](./docs/setup.md)**

### Tests

```bash
npm run build --workspace=@voyr/shared   # build shared types first
npm test
```

---

## Features (summary)

### Shipped

- AI chat with SSE streaming, tool calling, and generative UI cards (hotels,
  flights, activities, tickets, visa, checkout)
- Full booking pipeline: package → immutable quote → mock checkout →
  auto-confirm
- Broker economics: curated listings, B2C/B2B margin rules, fulfillment ledger
- B2B partner portal with admin-managed email access
- Travel visa checker (9 passports × 40 destinations) with admin CRUD
- Admin ops dashboard, listings, pricing, partners
- Email OTP auth; conversation persistence and share links

### Not shipped yet

- Live Razorpay payments
- Live supplier booking (Riya Connect stub; API providers are discovery-only)
- Google OAuth UI (backend route exists)
- Public chat share links (UI exists; gateway blocks unauthenticated fetch — see
  STATUS)
- Async document queue workers (inline fallback works)

**Login required** for chat (to send), visa checker, bookings, and all
partner/admin features when using the production gateway.

See **[docs/STATUS.md](./docs/STATUS.md)** for the complete matrix, auth model,
schema, and known gaps.

---

## Routes

| Area     | Paths                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------- |
| Consumer | `/`, `/chat`, `/trips`, `/bookings`, `/saved`, `/notifications`, `/travel-visa`, `/login`, `/verify` |
| Partner  | `/partner`, `/partner/dashboard`, `/partner/chat`, `/partner/bookings`                               |
| Admin    | `/admin/ops`, `/admin/listings`, `/admin/pricing`, `/admin/partners`, `/travel-visa/admin`           |
| Payments | `/payment/mock`, `/payment/return`                                                                   |

---

## Project structure

```
Voyr/
├── frontend/     # Next.js app → static export (out/)
├── backend/      # Express API, migrations, seeds
├── gateway/      # Cloudflare Worker
├── shared/       # @voyr/shared types (build before backend/frontend)
├── scripts/      # deploy-cloudflare.ps1, railway-sync-env.ps1
├── docker/       # Railway Dockerfile
└── docs/         # Setup, architecture, API, status, deployment
```

---

## Documentation

| Document                                                               | Description                                              |
| ---------------------------------------------------------------------- | -------------------------------------------------------- |
| **[docs/STATUS.md](./docs/STATUS.md)**                                 | **Implemented / pending / limitations / dependencies**   |
| [docs/setup.md](./docs/setup.md)                                       | Local installation, env vars, B2B setup, troubleshooting |
| [docs/architecture.md](./docs/architecture.md)                         | System design, broker model, data flows                  |
| [docs/api.md](./docs/api.md)                                           | REST API reference                                       |
| [docs/deployment.md](./docs/deployment.md)                             | Production deployment                                    |
| [docs/railway-deploy.md](./docs/railway-deploy.md)                     | Railway backend                                          |
| [docs/tier-c-deploy.md](./docs/tier-c-deploy.md)                       | Mock-payment launch checklist                            |
| [docs/travel-visa/requirements.md](./docs/travel-visa/requirements.md) | Visa feature spec                                        |
| [docs/travel-visa/design.md](./docs/travel-visa/design.md)             | Visa technical design                                    |
| [docs/agents/domain.md](./docs/agents/domain.md)                       | Domain vocabulary                                        |

---

## Deployment

| Component          | Target     | Command / doc                                                |
| ------------------ | ---------- | ------------------------------------------------------------ |
| Backend            | Railway    | `railway up` — [railway-deploy.md](./docs/railway-deploy.md) |
| Gateway + Frontend | Cloudflare | `npm run deploy:cloudflare`                                  |
| Database           | Supabase   | `npm run db:migrate`                                         |

Full guide: [docs/deployment.md](./docs/deployment.md)

---

## License

**Proprietary — All Rights Reserved.** See [LICENSE](./LICENSE).

© 2026 RAIO Quantum Technologies Pvt. Ltd.

Licensing inquiries: https://github.com/raioquantum-commits/Voyr
