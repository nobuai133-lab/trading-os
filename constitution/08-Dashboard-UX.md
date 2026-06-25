# ITOS v1.0 — Dashboard UX

## Design Principles

1. **Information density over decoration** — every visible element must convey decision-relevant data
2. **Status at a glance** — mode, price, regime, and active trade status must be readable in 2 seconds
3. **Mobile-first, desktop-capable** — trader must be able to check status from a phone
4. **No false precision** — show ranges and categories, not spuriously precise decimals
5. **State reflects DB truth** — dashboard shows what the system knows, not what the user wishes

## Layout

### Mobile (< 768px) — Tab Navigation
Single column, 4 tabs:
1. Scanner (regime, confidence, agents)
2. Active Trade (entry, SL, TPs, unrealized R)
3. Risk (anti-reentry, cooldown, fingerprint)
4. Review (last trade memory, lesson)

### Tablet (768–1279px) — 2-Column
- Left: Scanner + Active Trade
- Right: Risk + Review

### Desktop (≥ 1280px) — 3-Column
- Left: Scanner + Key Levels
- Center: Active Trade + Pending Setups
- Right: Risk + Agents + Review

## Panel Definitions

### Scanner Panel
**Purpose:** Current market regime and structural context

Contents:
- Symbol + timeframe (BTCUSDT / 4H)
- Live price (polled every 10s)
- Regime badge (TRENDING_UP / TRENDING_DOWN / RANGING / UNKNOWN)
- HTF Bias (1D regime) + LTF Bias (4H regime)
- Confidence score (0–100) with color band
- Confidence history sparkline (last 10 snapshots)
- System mode badge (IDLE / SETUP_DETECTED / ACTIVE_TRADE / COOLDOWN)

### Active Trade Panel
**Purpose:** Current open trade at a glance

Contents:
- Direction (LONG / SHORT)
- Entry price, current price, open % from entry
- SL (original) + current SL + SL status badge
- TP1, TP2, TP3 with hit checkmarks
- Unrealized R multiple
- Risk % and position size

When no active trade: shows IDLE state with last closed trade summary.

### Risk Panel
**Purpose:** Anti-reentry and system health status

Contents:
- Kill switch indicator
- Trading mode (PAPER_TRADING / ALERT_ONLY / LIVE)
- Cooldown bar: remaining bars / total bars
- Fingerprint status: NEW / ACTIVE / TRADED
- Range memory: status, last direction, reentry allowed
- Blocked conditions list (nextRequiredConditions)

### Review Panel
**Purpose:** Last completed trade + learning record

Contents:
- Last trade direction and result
- Entry → close price → PnL (in R)
- Close reason
- Lesson note (if recorded)
- Mistake note (if recorded)
- Bias carryover indicator

### Key Levels Panel
**Purpose:** Current structural price levels from strategy engine

Contents:
- List of key levels sorted high → low
- Level type badge: RESISTANCE / SUPPORT / LIQUIDITY_HIGH / LIQUIDITY_LOW
- Distance % from current price
- Strength indicator (1–3 stars)
- Current price marker (yellow highlight)

### Agents Panel
**Purpose:** Synthetic agent reports from strategy engine

Agents displayed:
1. Trend — regime on 4H (bullish / bearish / neutral)
2. EMA Alignment — EMA20 vs EMA50 spread and direction
3. HTF Bias (1D) — 1D regime
4. Volatility (ATR) — ATR value and ATR% of price

Each agent has a type badge: bullish (green) / bearish (red) / neutral (gray) / warning (orange) / valid (blue)

## State Polling

- `useLiveFeed` hook polls `/api/state` every 10 seconds
- Full `DashboardState` JSON is returned
- State is set into Zustand store: `useTradeStore`
- All panels are reactive to Zustand — no prop drilling

## Alert Display

`alertMessage` field in DashboardState is shown as a top-of-page banner when non-null. Used for kill switch active, governance warnings, or system errors.

## Color Conventions

| Color | Meaning |
|---|---|
| Green | Bullish / WIN / allowed / TP hit |
| Red | Bearish / LOSS / blocked / SL hit |
| Orange | Warning / stale / high volatility |
| Blue | Neutral / informational / LONG |
| Yellow | Current price / entry zone |
| Gray | IDLE / unknown / inactive |

## Data Freshness Indicator

The last-updated timestamp is shown in the footer of the Scanner panel. If `/api/state` returns data older than 60 seconds, a "stale" warning is shown.

## Future UX Enhancements (Phase 4+)

- Trade entry form (manual override for ALERT_ONLY mode)
- Thesis builder UI (structured evidence capture before webhook)
- Equity curve chart (running paper PnL over time)
- Symbol switcher (requires multi-symbol stateBuilder)
- Historical trade log with filter by outcome/direction/grade
