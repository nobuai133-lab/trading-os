# ITOS v1.0 — Architecture

## System Overview

```
TradingView (Pine Script Alerts)
        │
        │ POST /api/webhook/tradingview?secret=xxx
        ▼
┌─────────────────────────────────────────┐
│         Signal Ingestion Layer          │
│  signalProvider.ts (validate + parse)  │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│       Trade Lifecycle Engine            │
│         tradeLifecycle.ts               │
│  SETUP_DETECTED │ ENTRY_TRIGGERED       │
│  TP1/2/3_HIT   │ SL_HIT │ BAR_CLOSE   │
└──────┬──────────┬────────────┬──────────┘
       │          │            │
       ▼          ▼            ▼
  riskEngine  memoryEngine  notificationService
  (gates)     (fingerprint  (Telegram)
              + cooldown)
       │          │
       └────┬─────┘
            ▼
     PostgreSQL (Railway)
     9 models, full audit trail
            │
            ▼
┌─────────────────────────────────────────┐
│          State Builder                  │
│  stateBuilder.ts                        │
│  DB queries + live Kraken price         │
│  → DashboardState → SystemState cache  │
└──────────────────┬──────────────────────┘
                   │ GET /api/state (every 10s)
                   ▼
┌─────────────────────────────────────────┐
│        Next.js Frontend                 │
│  useLiveFeed → Zustand → React panels  │
│  Scanner │ Active │ Risk │ Review       │
└─────────────────────────────────────────┘

         Background Cron (every 15 min)
┌─────────────────────────────────────────┐
│  /api/cron/market-scan                  │
│  Kraken OHLCV → strategyEngine          │
│  → MarketSnapshot → SystemState rebuild │
└─────────────────────────────────────────┘
```

## Layer Definitions

### Layer 0 — Infrastructure
- Railway (PaaS host)
- PostgreSQL (Railway plugin)
- GitHub (source control, auto-deploy trigger)

### Layer 1 — Market Data
- `src/lib/marketData.ts` — Kraken REST API
- Fetches OHLCV bars and live price
- No auth required for public endpoints
- Symbol mapping: BTCUSDT → XBTUSDT (Kraken format)

### Layer 2 — Analysis Engine
- `src/lib/strategyEngine.ts`
- EMA20, EMA50, ATR14
- Swing detection (lookback=5 bars)
- Key level clustering (0.5% tolerance)
- Liquidity zone detection (equal highs/lows, 0.3%)
- Range detection (2–20% width)
- Confidence scoring (regime + EMA + structure)
- Regime: TRENDING_UP / TRENDING_DOWN / RANGING / UNKNOWN

### Layer 3 — Signal Ingestion
- `src/lib/signalProvider.ts`
- HMAC-safe webhook secret validation
- Payload parsing and normalization
- 8 signal types: SETUP_DETECTED, ENTRY_TRIGGERED, TP1/2/3_HIT, SL_HIT, CLOSE_TRADE, BAR_CLOSE

### Layer 4 — Memory Engine
- `src/lib/memoryEngine.ts`
- RangeMemory: tracks range status, liquidity, re-entry permission
- SetupFingerprint: unique ID per setup, prevents duplicate entry
- Cooldown: bars-based post-trade restriction
- Stale detection: ranges untouched >7 days → STALE

### Layer 5 — Risk Engine
- `src/lib/riskEngine.ts`
- Kill switch (KILL_SWITCH=true halts everything)
- Trading mode (PAPER_TRADING / ALERT_ONLY / LIVE)
- RR gate (minimum 1.5)
- Grade gate (reject D grade)
- Confidence gate (minimum 30%)

### Layer 6 — Trade Lifecycle
- `src/lib/tradeLifecycle.ts`
- Main orchestrator for all signal types
- Anti-reentry checks before every entry
- Auto-cooldown after TP3 and SL
- Full DB write trail on every event

### Layer 7 — State Builder
- `src/lib/stateBuilder.ts`
- Assembles complete DashboardState from DB + live price
- Computes synthetic agents, confidence history, htfBias, ltfBias
- Persists to SystemState table (id=1) — single-row cache
- Called after every webhook signal and every cron scan

### Layer 8 — Dashboard (Frontend)
- Next.js 14 App Router
- Zustand client state store
- `useLiveFeed` polls `/api/state` every 10s
- 4 panels: Scanner, ActiveTrade, Risk, Review
- Responsive: mobile (tabs) / tablet (2-col) / desktop (3-col)

## Current Constraints

| Constraint | Root Cause | Impact |
|---|---|---|
| Kraken-only market data | Binance/Bybit blocked on Railway US | Symbol availability limited |
| No live execution | By design (PAPER_TRADING default) | Safe |
| Single primary symbol (BTCUSDT) | Hardcoded in stateBuilder | Can't switch without code change |
| State rebuild on every signal | stateBuilder calls Kraken live | Adds latency to webhook response |
| No test coverage | Not yet implemented | Risk on refactors |
| Webhook secret in query string | TradingView limitation | Visible in server logs |
| Public GET endpoints | No auth on /api/state, /api/trades | Data exposed (acceptable for PAPER mode) |
