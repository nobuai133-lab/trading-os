# ITOS v1.0 — Cloud-Native Architecture

## Core Principle

No production function depends on a local desktop process. All market data, signal processing, state management, and notifications run on Railway without any dependency on TradingView Desktop, local Node servers, or developer machines.

## Infrastructure Stack

| Layer | Technology | Why |
|---|---|---|
| PaaS host | Railway | Zero-config deployment, PostgreSQL plugin, auto-deploy from GitHub |
| Database | Railway PostgreSQL | Managed, Railway-internal networking, no external DB setup |
| Builder | NIXPACKS | Dockerfile-free, auto-detects Next.js |
| CI/CD | GitHub → Railway auto-deploy | Push to main = deploy |
| DNS/TLS | Railway managed | Automatic HTTPS |
| Secrets | Railway Environment Variables | Not in code, not in .env committed |

## Service Layer Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     API Routes (Next.js)                        │
│  /api/webhook/tradingview   /api/v1/webhook/tradingview        │
│  /api/state                 /api/v1/state                      │
│  /api/cron/*                /api/v1/health/{live,ready,providers}│
└──────────────────────┬─────────────────────────────────────────┘
                       │
         ┌─────────────┼──────────────────────────┐
         ▼             ▼                          ▼
   LifecycleService  DashboardService        HealthService
         │             │  (event-driven)         │
         │             ▼                         │
         │        eventBus                       │
         │      (TypedEventBus)                  │
         │             │                         │
    ┌────┴──────────── ┼───────────┐             │
    ▼         ▼        ▼           ▼             ▼
 RiskService MemoryService MarketService    DB ping
    │             │           │
    ▼             ▼           ▼
 riskEngine  memoryEngine  marketDataEngine
                               │
                     ProviderManager
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
          CoinbaseProvider  KrakenProvider  (others)
```

### Key Decoupling: DashboardService

The critical architectural improvement in Phase 3 is that `DashboardService` subscribes to domain events via the event bus — it no longer blocks the webhook handler. Before Phase 3, `tradeLifecycle.ts` called `buildDashboardState()` synchronously on every webhook signal, which fetched live Kraken data and added 200–500ms latency to the webhook response. Now:

1. Webhook handler calls `lifecycleService.process()` → returns immediately
2. `lifecycleService` emits a domain event (`signal.created`, etc.)
3. `dashboardService` picks up the event and rebuilds state asynchronously in the background

## 10 Service Modules

| Service | Module | Responsibility |
|---------|--------|---------------|
| MarketService | `src/services/market/MarketService.ts` | Wraps marketDataEngine, emits market.updated |
| StrategyService | `src/services/strategy/StrategyService.ts` | Wraps runStrategyAnalysis |
| MemoryService | `src/services/memory/MemoryService.ts` | Wraps memoryEngine, emits memory events |
| RiskService | `src/services/risk/RiskService.ts` | Wraps evaluateRisk, emits risk.rejected |
| LifecycleService | `src/services/lifecycle/LifecycleService.ts` | Orchestrates signal processing + event emission |
| NotificationService | `src/services/notification/NotificationService.ts` | Wraps Telegram notify |
| DashboardService | `src/services/dashboard/DashboardService.ts` | Event-driven async state rebuild |
| AuditService | `src/services/audit/AuditService.ts` | Append-only AuditLog writes |
| HealthService | `src/services/health/HealthService.ts` | DB ping + provider health aggregation |

## Event Bus

`src/core/eventBus.ts` — singleton `TypedEventBus` extending Node.js EventEmitter.

16 typed events with compile-time payload safety:

| Event | Trigger |
|-------|---------|
| `market.updated` | New price from any provider |
| `provider.changed` | Provider failover |
| `signal.created` | Valid signal processed |
| `signal.rejected` | Signal blocked by risk/memory |
| `trade.opened` | ENTRY_TRIGGERED processed |
| `trade.closed` | TP3/SL/manual close |
| `tp1.hit` / `tp2.hit` / `tp3.hit` | TP level reached |
| `trade.expired` | Trade expired before entry |
| `cooldown.started` / `cooldown.finished` | Cooldown lifecycle |
| `bias.reset` | Bias direction reset |
| `memory.updated` | Range/fingerprint/cooldown changed |
| `evidence.changed` | Confidence grade updated |
| `risk.rejected` | Risk gate triggered |

## Deployment Flow

```
Developer pushes to main branch (GitHub)
        │
        │ webhook trigger
        ▼
Railway pulls latest commit
        │
        ▼
NIXPACKS build:
  1. npm ci
  2. npm run build (Next.js)
        │
        ▼
Start command:
  npx prisma migrate deploy && npm start
        │
        ├── prisma migrate deploy → runs pending migrations
        └── npm start → starts Next.js production server
```

## Railway Service Configuration

```toml
# railway.toml
[build]
builder = "NIXPACKS"
nixpacksConfigPath = "nixpacks.toml"

[deploy]
startCommand = "npx prisma migrate deploy && npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3

[[services]]
name = "trading-os"
[services.healthcheck]
path = "/api/v1/health/ready"
intervalSeconds = 30
timeoutSeconds = 10
```

**Note:** Health check path updated to `/api/v1/health/ready` (real DB ping). The old `/api/state` path still works but does not perform a DB liveness check.

## nixpacks.toml

```toml
[phases.setup]
nixPkgs = ["nodejs_20", "openssl"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npx prisma migrate deploy && npm start"

[variables]
DATABASE_URL = "postgresql://placeholder:placeholder@placeholder:5432/placeholder"
```

The `DATABASE_URL` dummy value in nixpacks.toml is required for Prisma schema validation during the build phase. The real value is injected at runtime from Railway Environment Variables.

## Networking

- App ↔ PostgreSQL: `postgres.railway.internal:5432` (Railway private network)
- App ↔ Kraken API: `api.kraken.com` (outbound HTTPS, guaranteed available)
- App ↔ Coinbase API: `api.exchange.coinbase.com` (outbound HTTPS, P5 provider)
- App ↔ Binance API: `api.binance.com` (geo-blocked from Railway US, P1 unavailable)
- App ↔ TradingView: inbound webhook from TradingView alert IPs
- App ↔ Telegram: `api.telegram.org` (outbound HTTPS)
- Dashboard ↔ App: polled every 10s by browser client

## Secrets Management

All secrets are Railway Environment Variables:
- `WEBHOOK_SECRET` — HMAC webhook validation
- `CRON_SECRET` — cron endpoint auth
- `JWT_SECRET` — JWT token signing (v1 API)
- `DATABASE_URL` — PostgreSQL connection string (internal URL)
- `TELEGRAM_BOT_TOKEN` — notification bot
- `TELEGRAM_CHAT_ID` — notification target
- `TRADING_MODE` — PAPER_TRADING / ALERT_ONLY / LIVE (default: PAPER_TRADING)
- `KILL_SWITCH` — emergency stop (default: false)
- `DEFAULT_RISK_PCT` — default position size (default: 1%)
- `MAX_RISK_PCT` — maximum position size (default: 2%)
- `MIN_RR` — minimum risk/reward ratio (default: 1.5)
- `MIN_CONFIDENCE` — minimum confidence to pass risk gate (default: 30)

**Never in code. Never in .gitignore-bypassed .env files. Never logged.**

## API Versioning

ITOS maintains two API surfaces:
- `/api/` — existing routes, unchanged (zero breaking changes)
- `/api/v1/` — new versioned routes using the service layer

New features are built in `/api/v1/`. Existing callers continue to use `/api/`. Routes will be migrated incrementally.

| Route | v0 | v1 |
|-------|----|----|
| Dashboard state | `GET /api/state` | `GET /api/v1/state` |
| Webhook | `POST /api/webhook/tradingview` | `POST /api/v1/webhook/tradingview` |
| Liveness | `GET /api/state` (indirect) | `GET /api/v1/health/live` |
| Readiness | — | `GET /api/v1/health/ready` (real DB ping) |
| Provider health | — | `GET /api/v1/health/providers` |

## Correlation IDs

Every request is assigned a `cid_${timestamp}_${hex}` correlation ID at the entry point. It threads through log lines, error objects, and the `X-Correlation-Id` response header. Use it to trace a signal from webhook arrival through risk gates, memory checks, lifecycle state change, and notification delivery.

## Zero-Desktop-Dependency Rule

Production path never calls:
- TradingView Desktop CDP
- Local `localhost:3001` proxy
- Any process running on the developer's machine
- Any browser automation

TradingView Desktop + MCP is a local analysis tool only. It feeds into TradingView Pine Script alert setup — the alerts themselves fire via HTTPS webhook to Railway.

## Outage Recovery

If Railway service crashes:
1. Restart policy retries up to 3 times automatically
2. Trade state is preserved in PostgreSQL (not in-memory)
3. On restart, `prisma migrate deploy` re-applies any pending migrations
4. `DashboardService` rebuilds state on first event or `/api/v1/state` GET
5. No data loss — all events are persisted before processing
6. Market data engine re-initializes provider health checks on startup

## Scaling Considerations (current: not needed)

ITOS processes ~4 webhook signals per day in paper mode. Railway's smallest plan is more than sufficient. If volume increases:
- Add Railway replicas for horizontal scaling
- Add Redis for SystemState cache (replace PostgreSQL upsert)
- Migrate rate limiting from in-memory Map to Redis (current in-memory resets per pod)

These are future concerns, not current constraints.
