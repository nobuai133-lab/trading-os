# ITOS v1.0 — Deployment

## Environment

| Environment | URL | Branch | Purpose |
|---|---|---|---|
| Production | https://trading-os-production-6354.up.railway.app | main | Live paper trading |
| Local dev | http://localhost:3000 | any | Development + testing |

There is no staging environment in v1.0. Phase 3+ will add a staging Railway service on a `staging` branch.

## First-Time Deployment Checklist

### Prerequisites
- [ ] Railway account with project `celebrated-magic`
- [ ] GitHub repo `nobuai133-lab/trading-os` connected to Railway
- [ ] Railway PostgreSQL plugin attached to the service

### Step 1 — Set Environment Variables in Railway
Navigate to Railway → trading-os service → Variables tab. Set:
```
DATABASE_URL         = postgresql://postgres:<password>@postgres.railway.internal:5432/railway
WEBHOOK_SECRET       = <32+ char hex string>
CRON_SECRET          = <32+ char hex string>
TRADING_MODE         = PAPER_TRADING
KILL_SWITCH          = false
TELEGRAM_BOT_TOKEN   = <from BotFather>
TELEGRAM_CHAT_ID     = <your chat ID>
```

### Step 2 — Push to main
```
git push origin main
```
Railway auto-detects the push and starts the build pipeline.

### Step 3 — Verify Build Logs
Watch Railway build logs for:
- `npm ci` ✓
- `npm run build` ✓
- `npx prisma migrate deploy` ✓ (first run: applies 20260625050812_init)
- Server started on port

### Step 4 — Run Historical Scan
After first deployment, seed the database with structural history:
```
GET https://trading-os-production-6354.up.railway.app/api/cron/historical-scan
Headers: x-cron-secret: <CRON_SECRET>
```
This fetches 720 bars for BTCUSDT + ETHUSDT and seeds RangeMemory.

### Step 5 — Verify Dashboard
Open https://trading-os-production-6354.up.railway.app  
Confirm:
- Symbol shows BTCUSDT
- Live price updates
- Regime shows (not blank)
- Key levels populate
- No error banners

## Routine Deployment (code update)

1. Make changes locally, test with `npm run dev`
2. `git commit -m "description"`
3. `git push origin main`
4. Railway auto-deploys
5. Monitor Railway logs for build success
6. Check `/api/state` endpoint returns valid JSON
7. Verify dashboard reflects expected state

## Database Migrations

Migrations are applied automatically on every deploy via `npx prisma migrate deploy`.

To create a new migration locally:
```
npx prisma migrate dev --name <migration_name>
```
This generates a new SQL file in `prisma/migrations/`. Commit this file — it runs automatically on next deploy.

**Never** run `npx prisma migrate reset` in production — this drops all data.

## Known Deployment Issues and Fixes

| Issue | Cause | Fix |
|---|---|---|
| Docker mount error on `tsconfig.tsbuildinfo` | File tracked in git, Docker treats as directory | `git rm --cached tsconfig.tsbuildinfo`, add to `.gitignore` |
| Build cache stuck (same snapshot ID) | Railway cached an old Docker layer | Create/update `nixpacks.toml` to bust cache with new config hash |
| P1012 DATABASE_URL not found at build time | Prisma validates schema during `npm run build` | Add dummy `DATABASE_URL` in `nixpacks.toml [variables]` |
| DATABASE_URL empty at runtime | Railway PostgreSQL plugin doesn't auto-inject to app service | Set `DATABASE_URL` explicitly in Railway Variables with internal URL |
| Next.js CVE blocked deployment | Railway scans for known vulnerabilities | Upgrade `next` to `^14.2.35` or latest patch |

## Rollback Procedure

Railway does not support one-click rollback in free tier. To rollback:
1. `git revert HEAD` (creates a new commit reversing last change)
2. `git push origin main`
3. Railway deploys the reverted version

Or reset to a specific commit:
1. `git reset --hard <commit-sha>` (locally)
2. `git push --force origin main` (WARNING: destructive, confirm first)

Prefer `git revert` over force push.

## Health Check

Railway monitors `GET /api/state` every 30 seconds. If this returns non-200 for 3 consecutive checks, Railway restarts the service.

`/api/state` returns 200 with cached state even if Kraken is unreachable (falls back to DB snapshot).

## Logs Access

Railway CLI:
```
railway logs --service trading-os --tail
```

Or via Railway dashboard → Deployments → View Logs.

Filter for errors:
```
railway logs | grep -i "error\|failed\|unhandled"
```
