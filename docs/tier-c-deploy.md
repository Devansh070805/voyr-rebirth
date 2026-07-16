# Tier C deployment checklist (payments mocked)

Ship production travel ops **without live Razorpay**. Payments use mock
checkout; bookings still flow through quotes, payment sessions, and fulfillment.

## Production URLs (June 2026)

| Service  | URL                                                 |
| -------- | --------------------------------------------------- |
| Frontend | https://voyr-frontend.pages.dev                     |
| Gateway  | https://voyr-travel-ops.aryansaxenaalig.workers.dev |
| Backend  | https://voyr-backend-production.up.railway.app      |

---

## 1. Infrastructure

| Service            | Notes                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| **PostgreSQL**     | Supabase; run `cd backend && npm run migrate:up` (19 migrations)                                     |
| **Redis**          | Required in production                                                                               |
| **Backend**        | Railway — `docker/backend.Dockerfile` + `railway.toml`; see [railway-deploy.md](./railway-deploy.md) |
| **Gateway Worker** | Deploy from `gateway/` — name **`voyr-travel-ops`**                                                  |
| **Frontend**       | Cloudflare Pages static export                                                                       |

---

## 2. Required backend environment (Railway)

Set via `.\scripts\railway-sync-env.ps1` or Railway dashboard.

```bash
FRONTEND_URL=https://voyr-frontend.pages.dev
CORS_ORIGIN=https://voyr-frontend.pages.dev
DATABASE_URL=...          # @ in password → %40
DB_SSL=true
JWT_SECRET=...            # same as gateway
REDIS_URL=...
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=...
RESEND_API_KEY=...
EMAIL_FROM=Voyr <onboarding@resend.dev>
PAYMENT_MODE=mock
ADMIN_EMAILS=ops@yourcompany.com
NODE_ENV=production
```

Optional: `GEOAPIFY_API_KEY`, `MAKCORPS_API_KEY`, `AVIATION_STACK_API_KEY`, R2
vars for documents, `QUEUE_URL` for async PDF workers.

After deploy, confirm schema:

```bash
cd backend && npm run db:verify
# Expect: 19 migrations, 38 app tables (39 rows in db:verify incl. pgmigrations)
```

Key broker tables: `curated_listings`, `provider_margin_rules`,
`booking_fulfillments`, `user_travel_profiles`.

---

## 3. Gateway secrets

```bash
cd gateway
# Unset R2-only CLOUDFLARE_API_TOKEN; use `npx wrangler login` if needed
npx wrangler secret put JWT_SECRET   # same value as backend
npx wrangler deploy
```

`BACKEND_ORIGIN` is in `gateway/wrangler.toml` (Railway URL).

Public routes: `/auth/login`, `/auth/verify`, `/auth/refresh`, `/auth/google`,
`/auth/logout`, `/webhook/payment`, `/health`.

---

## 4. Frontend environment (Pages)

```bash
NEXT_PUBLIC_API_URL=https://voyr-travel-ops.aryansaxenaalig.workers.dev
NEXT_PUBLIC_APP_URL=https://voyr-frontend.pages.dev
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
# NEXT_PUBLIC_MAPBOX_TOKEN=...   # optional
```

OTP-only auth — no Google client ID required.

---

## 5. Database seed (first deploy)

```bash
cd backend
npm run migrate:up
npx tsx src/db/run-seed.ts
npm run db:verify
```

Seeds travel-visa reference data and demo inventory.

**Windows:** set `SUPABASE_POOLER_REGION` before migrate (see
[setup.md](./setup.md)).

---

## 6. Mock payment flow

1. User completes checkout in chat → `checkout_url` opens
   `/payment/mock?payment_id=...`
2. User clicks **Mark as paid** → `POST /payment/mock/complete`
3. User lands on `/payment/return` → polls `GET /payment/:id` (status `paid`)
4. Booking auto-confirms; fulfillments appear in `/admin/ops`

To enable live Razorpay later: set `PAYMENT_MODE=live`, implement Orders API in
`payment.service.ts`, configure webhook URL + `PAYMENT_WEBHOOK_SECRET`.

---

## 7. Admin access

- No client-side admin secret.
- Backend `ADMIN_EMAILS` / `ADMIN_USER_IDS` must include the signed-in user.
- UI calls `GET /admin/access` before showing admin shells.

Admin routes: `/admin/ops`, `/admin/listings`, `/admin/pricing`,
`/admin/partners`, `/travel-visa/admin`.

---

## 8. B2B partner smoke test

1. Log in as admin → `/admin/partners`
2. Create partner org (name + company code)
3. Grant access to a test email
4. Log in as that email → `/partner`
5. Confirm `GET /auth/me` returns `customer_segment: "b2b"`
6. Open `/partner/chat` — verify B2B margin rules apply (configure at
   `/admin/pricing`)
7. Revoke member → re-login → confirm segment resets to `b2c`

---

## 9. Single Worker URL

Use **one** production API URL in `NEXT_PUBLIC_API_URL`:

- GitHub Actions deploys `gateway/wrangler.toml` → `voyr-travel-ops`
- Cloudflare Workers Builds should use the same name

Do not mix `voyr-gateway` and `voyr-travel-ops` in different env vars.

---

## 10. Verify checklist

- [ ] `GET /health` on backend → `database: connected`
- [ ] OTP login through gateway (consumer `/login`)
- [ ] Chat stream after login
- [ ] Mock checkout → paid → booking in `/admin/ops` **Active bookings**
- [ ] Admin pages work only for allowlisted email
- [ ] B2B partner grant → `/partner/chat` accessible
- [ ] B2B revoke → partner routes blocked after re-login
- [ ] `npm run db:verify` shows 19 migrations and 38+ tables

---

## Related docs

- [deployment.md](./deployment.md) — full production guide
- [railway-deploy.md](./railway-deploy.md) — Railway troubleshooting
- [setup.md](./setup.md) — local development
