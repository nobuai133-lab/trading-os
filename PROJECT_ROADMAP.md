# ITOS v1.0 — Project Roadmap

## Phase 0 — Audit and Architecture Discovery ✅

**Status:** Complete  
**Completed:** 2026-06-25

Deliverables:
- [x] 26-item codebase audit
- [x] Architecture diagram and layer definitions
- [x] Phase 0 report (current state, weaknesses, blockers, roadmap)

---

## Phase 1 — Master Constitution Documentation ✅

**Status:** Complete  
**Completed:** 2026-06-25

Deliverables:
- [x] `constitution/00-Vision.md` through `constitution/14-Backtest.md` (15 files)
- [x] `MASTER_PROMPT.md`
- [x] `PROJECT_ROADMAP.md`
- [x] `CHANGELOG.md`
- [x] `DECISION_LOG.md`

---

## Phase 2 — Market Data Layer ✅

**Status:** Complete  
**Completed:** 2026-06-25

Goals: Transform single-provider Kraken integration into institutional provider abstraction with health scoring, automatic failover, and data validation.

Deliverables:
- [x] `src/lib/marketData/types.ts` — shared types (OHLCVBar, Ticker, ProviderHealth, etc.)
- [x] `src/lib/marketData/providers/IMarketDataProvider.ts` — provider interface
- [x] `src/lib/marketData/providers/BaseProvider.ts` — abstract base with health tracking
- [x] `src/lib/marketData/providers/KrakenProvider.ts` — migrated from src/lib/marketData.ts
- [x] `src/lib/marketData/providers/BinanceProvider.ts` — P1, starts unavailable (geo-blocked)
- [x] `src/lib/marketData/providers/TradingViewProvider.ts` — P2, local/manual only
- [x] `src/lib/marketData/providers/BinanceWsProvider.ts` — P3, stub (deferred)
- [x] `src/lib/marketData/providers/BybitProvider.ts` — P4, starts unavailable
- [x] `src/lib/marketData/providers/CoinbaseProvider.ts` — P5, available
- [x] `src/lib/marketData/validator.ts` — 8 validation checks
- [x] `src/lib/marketData/providerManager.ts` — health scoring, selection, failover
- [x] `src/lib/marketData/engine.ts` — singleton with retry/fallback loop
- [x] `src/lib/marketData/index.ts` — public API
- [x] `src/lib/marketData.ts` — compatibility shim (zero breaking changes)

---

## Phase 3 — Cloud Native Platform ✅

**Status:** Complete  
**Completed:** 2026-06-25

Goals: Introduce typed event bus, centralized config, structured error taxonomy, and core infrastructure for the service layer.

Deliverables:
- [x] `src/core/config.ts` — centralized env var config
- [x] `src/core/correlationId.ts` — cid_ request tracing
- [x] `src/core/errors.ts` — ITOS-1001 through ITOS-5002 error hierarchy
- [x] `src/core/logger.ts` — enhanced logger with withContext factory
- [x] `src/core/eventBus.ts` — TypedEventBus, 16 typed events

---

## Current Phase: Phase 3.5 — Remediation (R-01 to R-21) 🔄

**Status:** In progress  
**Started:** 2026-06-25

Remediation plan approved before Phase 3.5. Items R-01 through R-05 (core infrastructure) and R-06 (market data layer) are complete.

| Item | Description | Status |
|------|-------------|--------|
| R-01 | `src/core/config.ts` | ✅ Done |
| R-02 | `src/core/correlationId.ts` | ✅ Done |
| R-03 | `src/core/logger.ts` | ✅ Done |
| R-04 | `src/core/errors.ts` | ✅ Done |
| R-05 | `src/core/eventBus.ts` | ✅ Done |
| R-06 | Phase 2 Market Data Layer (13 files) | ✅ Done |
| R-07 | `PROJECT_ROADMAP.md` phase numbering fix | ✅ Done |
| R-08 | `constitution/05-Market-Data.md` rewrite | 🔄 In progress |
| R-09 | 9 service modules in `src/services/` | ⏳ Pending |
| R-10 | Prisma: AuditLog, SystemHealth, TradeLifecycle | ⏳ Pending |
| R-11 | `/api/v1/health/*` routes | ⏳ Pending |
| R-12 | `/api/v1/` versioned routes | ⏳ Pending |
| R-13 | Auth middleware | ⏳ Pending |
| R-14 | `constitution/09-Cloud-Native.md` rewrite | ⏳ Pending |
| R-15 | `CHANGELOG.md` + `DECISION_LOG.md` updates | ⏳ Pending |
| R-16 | Vitest config | ⏳ Pending |
| R-17 | Core unit test files | ⏳ Pending |
| R-18 | `BinanceWsProvider` stub | ✅ Done (included in R-06) |
| R-19 | `MarketStatusCard` UI component | ⏳ Pending |
| R-20 | JWT utility | ⏳ Pending |
| R-21 | Monorepo restructure | 🔲 Deferred to post-v1.0 |

---

## Phase 4 — Service Layer

**Status:** Not started  
**Depends on:** Phase 3.5 complete

Goals:
- 9 service modules wrapping existing lib/ with event bus integration
- Decoupled DashboardService (async, event-driven, no live API call on webhook)
- `/api/v1/` versioned routes using the service layer
- Existing `/api/` routes unchanged (zero breaking changes)

Deliverables:
- `src/services/market/MarketService.ts`
- `src/services/strategy/StrategyService.ts`
- `src/services/memory/MemoryService.ts`
- `src/services/risk/RiskService.ts`
- `src/services/lifecycle/LifecycleService.ts`
- `src/services/notification/NotificationService.ts`
- `src/services/dashboard/DashboardService.ts`
- `src/services/audit/AuditService.ts`
- `src/services/health/HealthService.ts`
- Prisma: AuditLog, SystemHealth, TradeLifecycle models

---

## Phase 5 — API and Health

**Status:** Not started  
**Depends on:** Phase 4

Goals:
- `/api/v1/health/live`, `/api/v1/health/ready`, `/api/v1/health/providers`
- Real DB ping on readiness endpoint (503 on failure)
- Rate limiting middleware on `/api/v1/`
- HMAC webhook verification middleware

---

## Phase 6 — Dashboard Enhancements

**Status:** Not started  
**Depends on:** Phase 4

Goals:
- `MarketStatusCard` component (provider status, health scores)
- Equity curve chart (running paper PnL)
- Trade log panel (last 20 trades)
- Confidence trend chart

---

## Phase 7 — Test Coverage

**Status:** Not started  
**Depends on:** Phase 3.5

Goals:
- Vitest unit tests: riskEngine, memoryEngine, signalProvider, validator, config
- Integration test: webhook → signal → trade lifecycle
- Target: ≥ 80% coverage on risk-critical modules

---

## Phase 8 — Strategy Validation

**Status:** Not started  
**Depends on:** 50+ paper trades collected

Goals:
- Manual backtest (TradingView Replay, 50 trades minimum)
- Backtest results recorded in `constitution/14-Backtest.md`
- Governance review decision in DECISION_LOG.md

---

## Phase 9 — Multi-Symbol Support

**Status:** Not started  
**Depends on:** Phase 4

Goals:
- Parameterize stateBuilder by symbol
- Add ETHUSDT as second tracked symbol
- Symbol selector in dashboard

---

## Phase 10 — LLM Integration

**Status:** Not started  
**Depends on:** Phase 9  
**Gate:** Grade ≥ B, Confidence ≥ 60%, not in cooldown

Goals:
- Claude API setup analysis
- Structured evidence category assessment
- Cost control: max 10 calls/day

---

## Phase 11 — Live Execution Preparation

**Status:** Not started  
**Depends on:** Phase 8 governance passed

**Gate requirements (all must be met):**
- 50+ documented paper trades
- 3+ months continuous paper operation
- Drawdown < 20%
- Profit factor ≥ 1.3
- DECISION_LOG.md governance entry

Goals:
- Kraken private API integration (order placement)
- Confirm step before every order
- Emergency close button
- Full audit trail

---

## Non-Goals (v1.0)

These will not be built:
- High-frequency trading
- Automated order routing without human confirmation
- Multiple broker integrations
- Social/copy trading
- Mobile native app (responsive web is sufficient)
- Machine learning price prediction
