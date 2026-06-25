# ADR-002: Market Data Gateway — Multi-Provider Abstraction

**Date:** 2026-06-25  
**Status:** Accepted  
**Deciders:** CTO  
**Level:** A (new providers), C (production provider config)

## Context

ITOS needs real-time BTC/USDT price data for dashboard display, trade entry timing, and eventually risk checks. A single exchange API is unreliable: Binance is geo-blocked in some jurisdictions, APIs have rate limits, WebSocket connections drop, and providers go down during volatile markets — exactly when price data is most critical.

## Decision

Implement a `MarketDataEngine` with a priority-ordered provider list and automatic health-scored failover:

```
marketDataEngine.withFallback()
  → ProviderManager.getActive()     (health-checks every 60s)
  → retry up to 3 providers on failure
  → emit market.updated on every successful fetch
```

Provider priority (lower number = preferred):

| P | Provider | Status | Notes |
|---|----------|--------|-------|
| 1 | Binance REST | Available (geo-dependent) | Fast, accurate |
| 2 | TradingView MCP | Local only | Manual/dev mode only |
| 3 | Binance WebSocket | Stub | Future implementation |
| 4 | Bybit REST | Available (geo-dependent) | Fallback |
| 5 | Coinbase REST | Available | Reliable fallback |
| 6 | Kraken REST | Always available | Last resort; guaranteed |

Each provider implements `IMarketDataProvider`:
```typescript
interface IMarketDataProvider {
  name: string;
  priority: number;
  isAvailable(): Promise<boolean>;
  fetchPrice(symbol: string): Promise<PriceData>;
  healthCheck(): Promise<HealthCheckResult>;
}
```

The `ProviderManager` assigns an `overallScore` (0–100) to each provider based on latency, success rate, and availability, and selects the highest-scoring available provider.

## Rationale

The abstraction layer was chosen over a single-provider approach because:
1. Geo-blocking makes Binance unreliable across deployment regions
2. TradingView MCP is inherently local-only and cannot run in Railway production
3. Price data unavailability during volatile markets is the worst-case failure scenario

Health scoring (vs. simple priority) was chosen because a high-priority provider with degraded latency should yield to a lower-priority but healthy provider.

## Consequences

### Positive
- Single `marketDataEngine` call site; provider selection is invisible to callers
- Kraken as last resort guarantees the system never returns `null` price on a healthy network
- Health scores update every 60s without user intervention
- New providers can be added without changing existing code

### Negative
- Provider health-checks add background polling (60s interval, ~6 simultaneous probes)
- TradingView MCP provider is excluded from Railway production (environment detection required)
- Adding a real-money execution provider (Bybit, Binance) requires Level C approval

### Risks
- **Risk:** All 6 providers fail simultaneously — `withFallback()` throws
- **Mitigation:** Last fetched price is cached; UI shows "stale price" warning rather than crash
- **Risk:** Health scores drift incorrectly, excluding healthy providers
- **Mitigation:** Health scores decay toward 50 on timeout; manual reset endpoint available

## Alternatives Considered

| Option | Why Rejected |
|--------|-------------|
| Single Binance client | Geo-blocked; no fallback; single point of failure |
| CoinGecko only | High latency (30s update); not suitable for real-time display |
| TradingView MCP only | Local-only; cannot run in Railway |
| WebSocket only | Complex reconnection logic; overkill for dashboard display |

## Key Files

```
src/lib/marketData/
  IMarketDataProvider.ts      — Provider interface
  engine.ts                   — MarketDataEngine with withFallback()
  ProviderManager.ts          — Health scoring and provider selection
  providers/
    BinanceProvider.ts        — Binance REST (P1)
    TradingViewProvider.ts    — TradingView MCP bridge (P2, local only)
    BinanceWsProvider.ts      — Binance WebSocket stub (P3, future)
    BybitProvider.ts          — Bybit REST (P4)
    CoinbaseProvider.ts       — Coinbase REST (P5)
    KrakenProvider.ts         — Kraken REST (P6, guaranteed)
```

## Review Date

On v1.1.0 (when Memory Engine begins using price data for pattern recognition).
