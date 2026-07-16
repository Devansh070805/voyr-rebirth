# Backend on Railway

Express backend runs on [Railway](https://railway.com) via Docker
(`docker/backend.Dockerfile` + root `railway.toml`).

## One-time setup

1. Install CLI and log in:
   ```bash
   npm i -g @railway/cli
   railway login
   ```
2. Link project (already done if `railway status` shows `voyr-backend`):
   ```bash
   railway link
   ```
3. Push env from `backend/.env`:
   ```powershell
   .\scripts\railway-sync-env.ps1
   ```
4. Generate public URL:
   ```bash
   railway domain --service voyr-backend
   ```
   Example: `https://voyr-backend-production.up.railway.app`

## Database (Supabase)

Run **once from your machine** (not on Railway):

```powershell
cd backend
npm run migrate:up          # 19 migrations → 38 app tables
npx tsx src/db/run-seed.ts
npm run db:verify
```

### Windows / pooler

Direct Supabase host (`db.*.supabase.co`) is IPv6-only and often fails on
Windows with `ENOTFOUND`.

**Before migrating**, add to `backend/.env`:

```env
SUPABASE_POOLER_REGION=ap-southeast-2   # from Supabase Connect → Session pooler
SUPABASE_POOLER_PREFIX=aws-1            # aws-0 or aws-1 — run detect script
```

Auto-detect:

```bash
node scripts/detect-pooler-region.mjs
```

`npm run migrate:up` uses `resolve-database-url.mjs` to rewrite the direct URL
to the session pooler when appropriate.

On Railway (production), the runtime pooler logic applies when
`NODE_ENV=production` unless `DB_USE_SUPABASE_POOLER=false`.

## Deploy backend

When Railway is healthy:

```bash
railway up --service voyr-backend
```

Verify:

```bash
curl https://voyr-backend-production.up.railway.app/health
```

Expected: `"database": "connected"`.

## Wire Cloudflare gateway

Unset `CLOUDFLARE_API_TOKEN` if it is R2-only (use `npx wrangler login`
instead):

```powershell
cd gateway
Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
npx wrangler secret put JWT_SECRET    # must match Railway JWT_SECRET
npx wrangler deploy
```

`BACKEND_ORIGIN` is set in `gateway/wrangler.toml` (Railway URL). Local dev uses
`gateway/.dev.vars` → `http://localhost:3001`.

Update Railway vars after Pages is live:

```bash
railway variable set FRONTEND_URL=https://voyr-frontend.pages.dev --service voyr-backend
railway variable set CORS_ORIGIN=https://voyr-frontend.pages.dev --service voyr-backend
```

## Required production variables

| Variable           | Notes                                 |
| ------------------ | ------------------------------------- |
| `DATABASE_URL`     | Supabase URI; `@` in password → `%40` |
| `DB_SSL`           | `true`                                |
| `JWT_SECRET`       | Same as gateway wrangler secret       |
| `REDIS_URL`        | Redis Cloud                           |
| `NODE_ENV`         | `production`                          |
| `FRONTEND_URL`     | Pages URL                             |
| `CORS_ORIGIN`      | Same as `FRONTEND_URL`                |
| `ADMIN_EMAILS`     | Admin UI allowlist                    |
| `PAYMENT_MODE`     | `mock` for Tier C                     |
| `DEEPSEEK_API_KEY` | AI provider                           |
| `RESEND_API_KEY`   | OTP email                             |

See [deployment.md](./deployment.md) for the full list including R2 and travel
APIs.

## Troubleshooting

| Issue                            | Fix                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `ENOTFOUND db.*.supabase.co`     | Set `SUPABASE_POOLER_REGION` + prefix; run `detect-pooler-region.mjs`; retry migrate |
| Migration count mismatch         | Run `npm run db:verify` — expect 19 migrations, 38 app tables                        |
| Railway upload 500               | Retry later; use GitHub autodeploy: `railway service source connect`                 |
| Next.js CVE blocks build         | Keep `next@15.1.11+` in `frontend/package.json`                                      |
| Gateway auth error with token    | `Remove-Item Env:CLOUDFLARE_API_TOKEN` then `wrangler login`                         |
| `BACKEND_ORIGIN` secret conflict | Use `[vars]` in `gateway/wrangler.toml`; `.dev.vars` for local only                  |
| B2B partner 403 in prod          | Grant email at `/admin/partners`; user must re-login for segment sync                |

## Related docs

- [deployment.md](./deployment.md) — full production guide
- [setup.md](./setup.md) — local development and pooler details
- [tier-c-deploy.md](./tier-c-deploy.md) — mock payment launch checklist
