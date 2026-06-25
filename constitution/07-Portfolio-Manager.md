# ITOS v1.0 — Portfolio Manager

## Current State: Single-Symbol Paper Trading

ITOS v1.0 operates on a single primary symbol (BTCUSDT) in PAPER_TRADING mode. There is no multi-symbol portfolio management yet. This document defines the intended portfolio management architecture for future phases.

## Paper Trading Reference Account

| Parameter | Value |
|---|---|
| Reference balance | $10,000 USD |
| Max risk per trade | 2% of reference |
| Default risk per trade | 1% of reference |
| Max concurrent trades | 1 (enforced in tradeLifecycle.ts) |
| Max daily trades | No hard limit (governed by cooldown + fingerprinting) |

## Trade Sizing Formula

```
riskAmount = accountBaseline × riskPct / 100
priceDistance = abs(entry - sl) / entry
sizeBtc = riskAmount / (entry × priceDistance)
```

Example at BTC $65,000, entry $64,000, SL $62,000, riskPct 1%:
```
riskAmount = $10,000 × 1% = $100
priceDistance = |64000 - 62000| / 64000 = 3.125%
sizeBtc = $100 / ($64,000 × 3.125%) = 0.05 BTC
```

## Trade Outcome Tracking

Every trade records:
- Entry price, SL, TP1/TP2/TP3
- Which TPs were hit (tp1Hit, tp2Hit, tp3Hit)
- Close reason (SL_HIT, TP3_HIT, CLOSE_TRADE, EXPIRED)
- Close price and timestamp
- Lesson and mistake notes (manual addition)
- SL status at close (ORIGINAL / MOVED_TO_BE / TRAILING)

## Performance Metrics (to implement in Phase 3+)

Required metrics for governance review:

| Metric | Formula | Minimum Target |
|---|---|---|
| Win rate | wins / total trades | ≥ 40% |
| Profit factor | gross wins / gross losses | ≥ 1.3 |
| Average RR achieved | avg(realized RR per win) | ≥ 1.5 |
| Max drawdown | max peak-to-trough on equity curve | < 20% |
| Expectancy | (winRate × avgWin) - (lossRate × avgLoss) | > 0 |

Currently, these must be calculated manually from the Trade table. A `/api/performance` endpoint is planned for Phase 3.

## Multi-Symbol Architecture (Phase 5+)

When multi-symbol support is added:

1. `stateBuilder.ts` must be parameterized by symbol
2. SystemState table must either:
   - Store per-symbol state as JSON sub-keys, OR
   - Have one row per symbol (id = hash of symbol)
3. All DB queries in `stateBuilder`, `memoryEngine`, and `tradeLifecycle` are currently hardcoded to `BTCUSDT` — these become parameters
4. Dashboard must show a symbol selector or multi-panel layout
5. Risk engine must enforce per-symbol position limits and aggregate exposure

## Symbol Eligibility Criteria

Before adding a new symbol to ITOS:
- Minimum daily volume > $1B (liquidity)
- Available on Kraken with perpetual/spot data
- Clear range structure (ITOS strategy relies on range-bound behavior)
- Not correlated > 90% with BTC (to avoid redundant exposure)
- Backtest results documented for that specific symbol

## Drawdown Monitoring (manual until Phase 3)

Calculate from Trade table:
```sql
SELECT direction, entryPrice, closePrice, closeReason, closedAt
FROM Trade WHERE status IN ('CLOSED_WIN', 'CLOSED_LOSS', 'CLOSED_MANUAL')
ORDER BY closedAt;
```

Compute running PnL from the results, identify peak and trough, calculate max drawdown.

## Phase Gate: Paper to Live

Live trading requires ALL of the following:
1. ≥ 50 paper trades documented with entry thesis
2. ≥ 3 months continuous paper trading
3. Drawdown < 20% over the full period
4. Profit factor ≥ 1.3
5. Win rate ≥ 40%
6. Governance review decision documented in DECISION_LOG.md
7. Explicit code change to `TRADING_MODE=LIVE` with commit message referencing governance approval

No environment variable toggle alone is sufficient. The code change requirement ensures the decision is versioned and auditable.
