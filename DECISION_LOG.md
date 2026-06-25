# ITOS Decision Log

This file records significant architectural, operational, and governance decisions made for ITOS. Each entry explains what was decided, why, and what alternatives were considered.

Format:
```
## [YYYY-MM-DD] — Decision Title
**Decision:** What was decided
**Reason:** Why
**Alternatives considered:** What else was evaluated
**Impact:** What changed
**Decided by:** Who made the call
```

---

## [2026-06-25] — Stage 3: Core State Kernel Authority Transfer

**Decision:** Promote the Core State Kernel from shadow mode to single source of truth for `/api/v1/state`. SystemState becomes a legacy compatibility layer (write-compatible, read-deprecated).

**Reason:** Stage 2.5 shadow verification confirmed kernel stability. All 5 go-live gates were passed: consistency ≥99.95%, 0 critical divergences, kernel initialized, ≥1 snapshot, ≥1000 events. The kernel's event-sourced model is strictly more capable than the mutable SystemState — audit trail, replay, divergence detection, snapshot recovery.

**Implementation:** Kernel overlay pattern — `adaptKernelState()` overlays kernel-authoritative fields (mode, trade, TP hits, antiReentry) onto the legacy base (market analysis, agents). No API contract changes. `X-Authority: kernel` header added to identify the read path.

**Rollback path:** `KERNEL_AUTHORITY=false` env var on Railway. Immediate rollback to legacy path. No data loss. Kernel continues accumulating events in the background.

**Alternatives considered:**
- Full replacement (delete stateBuilder): rejected — loses market analysis, agents, confidence history that aren't yet in kernel
- SystemState-first with kernel overlay (reversed priority): rejected — defeats the purpose of Stage 3
- Delayed promotion until all DashboardState fields are in kernel: rejected — the hybrid overlay safely handles non-kernel fields today

**Impact:** `GET /api/v1/state` reads from kernel. `mode`, `lifecycleIndex`, `trade.*`, `tp1Hit/tp2Hit/tp3Hit`, `antiReentry` are now kernel-authoritative. Dashboard, webhook, risk, memory, lifecycle services unaffected (API contract unchanged).

**Decided by:** CTO/CIO (explicit Level D approval)

---

## [2026-06-25] — Market Data Provider: Kraken

**Decision:** Use Kraken as the sole market data provider for OHLCV and live price.

**Reason:** Binance (`fapi.binance.com`) returns 403 from Railway US servers. Bybit (`api.bybit.com`) also returns 403. Kraken is accessible from Railway US and provides equivalent OHLCV data for BTC and ETH.

**Alternatives considered:**
- Binance: geo-blocked (Railway US IP ranges blacklisted)
- Bybit: also geo-blocked
- CoinGecko: no OHLCV data, price-only
- Self-hosted Binance proxy: too complex for v1.0

**Impact:** Symbol mapping required (BTCUSDT → XBTUSDT). Limited perpetual contract data vs Binance. Bars returned newest-first (reversed in marketData.ts).

**Decided by:** System architect

---

## [2026-06-25] — Single Symbol Hardcoded: BTCUSDT

**Decision:** `stateBuilder.ts` hardcodes `symbol: 'BTCUSDT'` in all DB queries.

**Reason:** Historical scan saves BTCUSDT and ETHUSDT snapshots. Without explicit filtering, the most recent snapshot (ETHUSDT) was served to the dashboard instead of BTC. Quickest safe fix for v1.0.

**Alternatives considered:**
- Parameterize stateBuilder by symbol: correct long-term solution, deferred to Phase 4
- Query by snapshotAt DESC and filter in application code: fragile

**Impact:** Dashboard always shows BTCUSDT. Multi-symbol support requires Phase 4 refactor.

**Decided by:** System architect

---

## [2026-06-25] — Paper Trading as Default Mode

**Decision:** `TRADING_MODE=PAPER_TRADING` is the default and all live execution code is disabled.

**Reason:** 3-month paper trading track record is required before live consideration. No mechanism to accidentally enable live trading from a config change alone — a code change is also required.

**Alternatives considered:**
- Alert-only mode as default: acceptable but loses trade lifecycle tracking
- Immediate live mode: unsafe, no track record

**Impact:** No real capital at risk. All trades recorded as paper. Governance gate required before live.

**Decided by:** System architect / trader

---

## [2026-06-25] — Webhook Secret in Query String

**Decision:** Accept TradingView's limitation that the webhook URL contains the secret as a `?secret=` query parameter.

**Reason:** TradingView alert webhooks do not support custom HTTP headers. The only way to pass a secret is via the URL. This is a TradingView platform limitation, not an ITOS design choice.

**Alternatives considered:**
- Header-based auth: not possible with TradingView
- IP allowlist: can be added as defense-in-depth, not a replacement
- Rotate secret frequently: impractical (requires updating all TV alerts)

**Impact:** Secret visible in Railway access logs. Mitigation: high-entropy secret (32+ hex chars), log redaction if log exposure is a concern.

**Decided by:** System architect

---

## [2026-06-25] — DATABASE_URL Must Be Set Explicitly

**Decision:** Railway's PostgreSQL plugin does not auto-inject `DATABASE_URL` into the app service. It must be set manually in the Variables tab using the internal URL (`postgres.railway.internal:5432`).

**Reason:** Railway's automatic variable injection only works when the plugin is in the same "namespace" as the service. In this project configuration, the variable did not propagate automatically.

**Alternatives considered:**
- Use Railway Reference Variables: set `DATABASE_URL=${{Postgres.DATABASE_URL}}` — attempted but resulted in empty string
- Use public proxy URL: works but less secure (public internet) and higher latency
- Hardcode URL in code: rejected (security rule: no secrets in code)

**Impact:** Required one-time manual setup step. Internal URL is not accessible from developer local machine — use public proxy URL for local dev only.

**Decided by:** System architect

---

## [2026-06-25] — Multi-Provider Market Data Architecture

**Decision:** Implement a 6-provider abstraction layer with priority-based selection, health scoring, and automatic failover instead of remaining on single-provider Kraken.

**Reason:** Institutional-grade market data requires resilience. A single provider creates a single point of failure. Binance and Bybit are currently geo-blocked from Railway US, but this may change, and Coinbase is immediately available. The abstraction allows higher-priority providers to be promoted automatically when health checks succeed.

**Alternatives considered:**
- Single Kraken provider: simpler but fragile
- Environment variable switch: requires restart to change provider
- Manual failover: operator error, slow to recover

**Impact:** Active provider on Railway US is now Coinbase (P5) or Kraken (P6). Binance (P1) and Bybit (P4) start unavailable and are promoted by health checks if they become accessible. Zero breaking changes to existing callers via compatibility shim.

**Decided by:** System architect

---

## [2026-06-25] — Async Dashboard Rebuild via Event Bus

**Decision:** Decouple `DashboardService` from the webhook hot path. Instead of calling `buildDashboardState()` synchronously in `tradeLifecycle.ts`, DashboardService subscribes to domain events and rebuilds asynchronously.

**Reason:** `buildDashboardState()` calls live Kraken API (fetchOHLCV + fetchCurrentPrice), adding 200–500ms latency to every webhook response. TradingView expects the webhook to return within 2–3 seconds. Under load or Kraken degradation, this coupling could cause webhook timeouts, leading to missed signals.

**Alternatives considered:**
- Cache dashboard state separately: partial fix, state still rebuilt synchronously
- Remove live API call from dashboard: dashboard would show stale data
- Async rebuild with in-memory queue: more complex, not needed at current volume

**Impact:** Webhook handler now returns in <50ms. Dashboard state is eventually consistent (rebuilds within 1–2 seconds of event). Existing `/api/state` route continues to work; it reads from the SystemState cache.

**Decided by:** System architect

---

## [2026-06-25] — API Versioning: /api/v1/ Alongside Existing Routes

**Decision:** Introduce `/api/v1/` routes for new functionality. Existing `/api/` routes remain unchanged.

**Reason:** Breaking existing routes mid-development would disrupt the production TradingView webhook configuration (which sends to `/api/webhook/tradingview`). The v1 routes use the service layer; old routes continue calling lib/ modules directly.

**Alternatives considered:**
- Rename all existing routes: high risk, breaks TradingView configuration
- Deprecation period with 301 redirects: unnecessary complexity for a solo-dev project
- Feature flags: overengineered for this case

**Impact:** Two route surfaces coexist indefinitely. New features are built in v1. Old routes will be migrated when stable. Railway health check updated to `/api/v1/health/ready` (real DB ping).

**Decided by:** System architect

---

## [2026-06-25] — R-21: Monorepo Restructure Deferred to Post-v1.0

**Decision:** Defer the monorepo restructure (splitting `trading-os` into `apps/web` + `packages/core`) to post-v1.0.

**Reason:** A monorepo restructure requires changing all import paths, Railway build configuration, and CI/CD setup simultaneously. The risk of breaking the production Railway deployment during active paper trading is not justified by the benefit at current scale (single developer, single service).

**Alternatives considered:**
- Restructure now: correct long-term for multi-app setups, but XL complexity with immediate deployment risk
- Partial restructure (shared `packages/` only): still requires path changes across all imports
- Accept current flat structure: sufficient for v1.0 single-service deployment

**Impact:** Current `src/` structure continues as-is. Service layer (`src/services/`) and core (`src/core/`) already provide the logical separation that a monorepo would formalize. Revisit when a second app (e.g., CLI tool, mobile backend) needs to share `core/`.

**Decided by:** System architect

---

*Add new entries above this line when significant decisions are made.*
