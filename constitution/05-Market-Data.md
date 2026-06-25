# ITOS v1.0 — Market Data Constitution

## Architecture Overview

ITOS uses a **multi-provider abstraction layer** with automatic health scoring, priority-based selection, and transparent failover. All callers interact with a single `marketDataEngine` singleton — the active provider is invisible to the rest of the system.

```
┌─────────────────────────────────────────────────────┐
│                  marketDataEngine                    │
│  (src/lib/marketData/engine.ts)                     │
│                                                     │
│   withFallback() → ProviderManager.getActive()      │
│   → retry up to 3 providers on failure              │
│   → emit market.updated on every ticker fetch       │
└──────────────────┬──────────────────────────────────┘
                   │ selects by overallScore
          ┌────────▼────────┐
          │  ProviderManager │  (health-checks every 60s)
          └────────┬────────┘
                   │
    ┌──────────────┼──────────────┬──────────────┬──────────────┬──────────────┐
    │              │              │              │              │              │
    ▼              ▼              ▼              ▼              ▼              ▼
 P1 Binance   P2 TradingView  P3 BinanceWS  P4 Bybit    P5 Coinbase   P6 Kraken
 (geo-blocked) (local only)   (stub/future) (geo-blocked) (available) (guaranteed)
```

## Provider Registry

| Priority | Name | Module | Status | Notes |
|----------|------|--------|--------|-------|
| P1 | Binance REST | `BinanceProvider` | Unavailable (geo-blocked) | Promoted by health check if accessible |
| P2 | TradingView MCP | `TradingViewProvider` | Unavailable (local only) | Manual mode; never deployed to Railway |
| P3 | Binance WS | `BinanceWsProvider` | Stub — not implemented | Deferred to Phase 9 |
| P4 | Bybit REST | `BybitProvider` | Unavailable (geo-blocked) | Promoted by health check if accessible |
| P5 | Coinbase REST | `CoinbaseProvider` | Available | Spot only; no funding rate / OI |
| P6 | Kraken REST | `KrakenProvider` | Always available | Guaranteed Railway US fallback |

**Active provider on Railway US:** Coinbase (P5) or Kraken (P6), depending on health score.

## Health Scoring

Each provider's `overallScore` is computed continuously:

```
availability  = successCount / (successCount + failureCount)
latency       = moving average of last 100 call durations (ms)
freshness     = max(0, 1 - latency / 2000)          # penalty above 2000ms
consistency   = availability
reliability   = availability×0.4 + freshness×0.3 + consistency×0.3
overallScore  = reliability × (1 - rateLimitPct×0.5)
```

`ProviderManager` re-evaluates scores after every 60-second health check ping. The provider with the highest `overallScore` among available providers becomes active.

## Provider Interface

All providers implement `IMarketDataProvider`:

```typescript
interface IMarketDataProvider {
  readonly name:     string;  // 'kraken' | 'binance' | 'coinbase' | ...
  readonly priority: number;  // 1 = highest, 6 = lowest
  isAvailable(): boolean;
  getHealth():   ProviderHealth;
  fetchOHLCV(symbol, timeframe, limit?): Promise<OHLCVBar[]>
  fetchTicker(symbol):                  Promise<Ticker>
  fetchOrderBook(symbol, depth?):       Promise<OrderBook>
  fetchFundingRate(symbol):             Promise<FundingRate>
  fetchOpenInterest(symbol):            Promise<OpenInterest>
}
```

`BaseProvider` provides `timed()`, `recordSuccess()`, `recordFailure()`, and health computation. Concrete providers only implement the data fetching methods.

## Data Validation

`validator.ts` runs 8 checks on every OHLCV response:

| # | Check | Severity |
|---|-------|----------|
| 1 | Timestamp ordering (ascending) | high |
| 2 | Duplicate candles | medium |
| 3 | Missing candles / gap detection | medium |
| 4 | Price deviation > 20% bar-to-bar | high |
| 5 | Volume anomaly (z-score > 5) | low |
| 6 | Clock drift (last bar vs wall clock) | medium |
| 7 | Stale data (candle close time > 5 min ago) | medium |
| 8 | OHLC sanity (high ≥ open/close, low ≤ open/close) | high |

`ValidationResult.valid = false` when any `high`-severity warning is present. Callers use `fetchOHLCV` for raw bars or `fetchOHLCVValidated` for the full result including warnings.

## Failover Behavior

```
engine.withFallback(fn):
  1. Call fn(activeProvider)
  2. On exception → manager.failover(reason) → pick next best
  3. Repeat up to MAX_RETRIES (3)
  4. If all fail → throw AllProvidersFailedError (ITOS-4002)
```

Every failover is logged with `logger.warn('provider.failover', ...)` and appended to the failover log (last 50 events retained). The event bus emits `provider.changed` on each failover.

## Compatibility Shim

`src/lib/marketData.ts` is a thin re-export wrapper:

```typescript
// All existing callers work unchanged:
import { fetchOHLCV, fetchCurrentPrice } from '@/lib/marketData';
```

The shim delegates to `marketDataEngine` and calls `marketDataEngine.init()` on module load, which starts the 60-second health check loop.

## Data Flow

```
Webhook / Cron / API route
         │
         │ fetchOHLCV('BTCUSDT', '4H', 720)
         │ fetchCurrentPrice('BTCUSDT')
         ▼
  src/lib/marketData.ts  (shim)
         │
         ▼
  marketDataEngine        (engine.ts)
         │
         ▼
  ProviderManager         (picks best available)
         │
         ▼
  Active Provider         (Coinbase or Kraken on Railway)
         │
         ▼
  validateOHLCV()         (8 checks, returns ValidationResult)
         │
         ▼
  Return OHLCVBar[]
         │
    ┌────┴────┐
    ▼         ▼
stateBuilder  historicalScan
    │
    ▼
MarketSnapshot (DB)
```

## Symbol Mapping

Each provider handles its own symbol format internally. The engine always receives ITOS canonical symbols:

| ITOS | Kraken | Binance | Bybit | Coinbase |
|------|--------|---------|-------|----------|
| BTCUSDT | XBTUSDT | BTCUSDT | BTCUSDT | BTC-USDT |
| ETHUSDT | ETHUSDT | ETHUSDT | ETHUSDT | ETH-USDT |
| BTCUSD  | XBTUSD  | —       | —       | BTC-USD  |

Mapping is isolated inside each provider class — callers always use `BTCUSDT` etc.

## Rate Limits

| Provider | Public Limit | Notes |
|----------|-------------|-------|
| Kraken | ~1 req/sec | Conservative; cron tasks not parallelized |
| Binance | 1200 req/min weight | Tracked in `rateLimitUsed` |
| Coinbase | 10 req/sec | Per IP |
| Bybit | 120 req/min | Linear category |

The `RateLimitStatus` in `ProviderHealth` reflects `pct = used/limit`. When `pct > 0.8`, the provider's `overallScore` is penalized.

## Adding a New Symbol

1. Add to the provider's internal symbol map (e.g., `SYMBOL_MAP` in KrakenProvider)
2. Verify the pair exists on that exchange
3. Add to `historicalScan.ts` for backfill
4. Update `stateBuilder.ts` — currently hardcoded to `BTCUSDT` (multi-symbol in Phase 9)

## Adding a New Provider

1. Extend `BaseProvider`
2. Implement all 5 methods
3. Assign unused priority number
4. Register in `engine.ts` constructor array
5. Set `protected override available = false` if geo-restricted or requires credentials

## Constraints

| Constraint | Detail |
|------------|--------|
| Production providers | Only REST APIs; no WebSocket on Railway (WS in Phase 9) |
| TradingView provider | Local/manual only — never enabled in production |
| Paper trading mode | `TRADING_MODE=PAPER_TRADING` — no order placement |
| Bar history | Kraken: ~720 bars/request; Coinbase: computed time window |
| Funding / OI | Only Binance P1 and Bybit P4 support these; unavailable on Railway US today |
