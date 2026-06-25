# ITOS v1.0 — Backtest Governance

## Philosophy

No strategy enters production without documented backtest results. Backtesting is not about curve-fitting — it is about establishing whether a structural edge exists and under what market conditions it performs.

A backtest that shows 90% win rate is a warning sign, not a goal. The goal is: positive expectancy with a realistic win rate over at least 50 trades across multiple market regimes.

## Minimum Backtest Requirements

| Requirement | Minimum |
|---|---|
| Trade count | 50 trades |
| Time span | 12+ months |
| Market regimes covered | TRENDING_UP, TRENDING_DOWN, RANGING |
| Expectancy | Positive |
| Win rate | ≥ 35% (with RR ≥ 2 average) |
| Maximum drawdown | < 20% |
| Profit factor | ≥ 1.3 |

## Backtest Methodology

### Step 1 — Define Strategy Rules (before looking at charts)
Document in writing:
- Entry condition (exact structural criteria)
- SL placement rule (structural level only)
- TP1, TP2, TP3 placement rules
- Which setups are disqualified (grade D, wrong regime, etc.)

### Step 2 — Select Test Data
- Use Kraken OHLCV data (consistent with production data source)
- Minimum 720 bars × 4H timeframe = ~4 months
- Preferred: 2 years of 4H bars

### Step 3 — Manual Backtesting (TradingView Replay)
For each potential setup:
1. Enter Replay mode at the setup bar
2. Record entry, SL, TP1/TP2/TP3 BEFORE advancing bars
3. Advance bars and record outcome
4. Do NOT adjust parameters after seeing outcome

### Step 4 — Record Each Trade
Required fields per trade:
```
Date | Symbol | TF | Direction | Entry | SL | TP1 | TP2 | TP3 | RR | Grade | Regime | Result | Bars Held | Notes
```

### Step 5 — Calculate Statistics
```
Win rate = wins / total
Loss rate = losses / total
Average win in R = sum(realized R for wins) / wins
Average loss in R = 1.0 (by definition — 1R risk per trade)
Expectancy = (winRate × avgWinR) - (lossRate × 1.0)
Profit factor = sum(wins in R) / sum(losses in R)
Max drawdown = largest peak-to-trough on equity curve (in R)
```

### Step 6 — Stress Test
Identify the worst 10-trade sequence in the backtest. Would this sequence:
- Exceed the 20% drawdown limit?
- Violate any risk rules?
- Destroy confidence in the edge?

If yes: reduce position sizing or tighten entry criteria.

## Backtest Governance Gate

Before paper trading begins:
- [ ] Backtest results documented in this file (Results section below)
- [ ] At least 50 trades across 3+ regimes
- [ ] All requirements above met
- [ ] Results reviewed and approved (DECISION_LOG.md entry)

Before live trading begins:
- [ ] Backtest governance gate passed ✓
- [ ] 30+ days paper trading with at least 10 live paper trades
- [ ] Paper results consistent with backtest results (within 20%)

## Results — BTCUSDT 4H Range Strategy (PENDING)

*This section will be completed when backtest data is collected.*

| Metric | Target | Actual |
|---|---|---|
| Trade count | ≥ 50 | — |
| Time span | ≥ 12 months | — |
| Win rate | ≥ 35% | — |
| Profit factor | ≥ 1.3 | — |
| Max drawdown | < 20% | — |
| Expectancy | > 0 | — |
| Approval date | — | — |

## TradingView Replay Process

1. Open BTCUSDT 4H chart in TradingView
2. Navigate to start date (12+ months ago)
3. Add ITOS indicators (EMA20, EMA50, ATR)
4. Activate Replay Mode (clock icon)
5. Identify range structure → record setup parameters
6. Step forward bar-by-bar
7. Record outcome in backtest log (spreadsheet or text file)
8. Repeat for next setup

**Important:** The Pine Script strategy in TradingView is NOT the source of truth for backtesting. Manual bar-by-bar replay is required to capture the qualitative judgment component of setup selection.

## Pine Script Strategy Backtester (supplementary)

A Pine Script strategy script can be used as a sanity check but not as the primary backtest:
- Pine strategy cannot replicate the structural judgment of setup selection
- Pine strategy results are bar-based, not setup-based
- Pine strategy is useful for: confirmation, stress-testing parameter sensitivity, identifying optimal TP levels

Any Pine Script strategy used must be documented in `src/pinescript/strategy_backtester.pine`.

## Regime-Specific Performance (to fill in)

| Regime | Trades | Win Rate | Expectancy |
|---|---|---|---|
| TRENDING_UP | — | — | — |
| TRENDING_DOWN | — | — | — |
| RANGING | — | — | — |
| UNKNOWN | — | — | — |

This decomposition is critical. A strategy that only works in trending regimes should not be traded in ranging conditions — and the regime detection in ITOS should gate entries accordingly.
