# ITOS v1.0 — Evidence Engine

## Purpose

Every trade entry must be backed by documented, structured evidence. The evidence engine defines what qualifies as acceptable evidence, how it is recorded, and how it expires.

The system does not predict. It accumulates evidence until the weight justifies a structured entry.

## Evidence Categories

### Category 1 — Market Structure
- Trend direction on 1D (HTF bias)
- Trend direction on 4H (LTF confirmation)
- EMA20 vs EMA50 alignment (same direction as trade)
- Swing high/low structure (higher highs = bullish, lower lows = bearish)
- Key level proximity (entry within 0.5% of identified support/resistance)

### Category 2 — Range Context
- Range identified with clear high/low boundaries (2–20% width)
- Price at range extreme (not midrange entry)
- No active stale flag on range
- Fresh liquidity sweep at range boundary

### Category 3 — Liquidity
- Liquidity zone identified (equal highs or equal lows within 0.3%)
- Sweep confirmed before entry (not anticipated)
- Previous structure swept, not just touched

### Category 4 — Risk/Reward
- SL defined at a structural level (not arbitrary)
- Minimum RR of 1.5 calculated before entry
- TP1 / TP2 / TP3 defined at known structural levels
- Trade sizing computed from riskPct and account baseline

### Category 5 — Regime Alignment
- Regime is not UNKNOWN
- HTF and LTF bias are aligned (both bullish or both bearish)
- ATR confirms volatility is appropriate for the setup (not extreme)

## Evidence Scoring

Evidence is summarized as a **confidence score** (0–100):

| Score Band | Meaning |
|---|---|
| 0–29 | Insufficient — no entry allowed |
| 30–49 | Marginal — entry requires manual override |
| 50–69 | Moderate — automatic ALERT_ONLY permitted |
| 70–89 | Strong — standard entry criteria met |
| 90–100 | Exceptional — high conviction |

### Scoring Logic (current implementation)
- Base: 30
- Regime known (not UNKNOWN): +15
- Regime trending (UP or DOWN): +20
- EMA spread > 2%: +35
- EMA spread > 1%: +20

### Minimum to Trigger LLM Analysis
- Grade ≥ B
- Confidence ≥ 60%
- Not in active cooldown

## Evidence Capture — Signal Payload

Each webhook signal from TradingView must include:

```json
{
  "symbol": "BTCUSDT",
  "signal": "SETUP_DETECTED",
  "direction": "LONG",
  "grade": "B",
  "entryZoneLow": 60000,
  "entryZoneHigh": 60500,
  "sl": 58000,
  "tp1": 63000,
  "tp2": 66000,
  "tp3": 70000,
  "rr": 2.1,
  "riskPct": 1.0,
  "timeframe": "4H",
  "setupId": "BTCUSDT-4H-LONG-20260625-001",
  "note": "Liquidity sweep at 59800, EMA20 above EMA50, HTF uptrend"
}
```

The `note` field is the human-readable evidence summary. It must explain WHY this setup qualifies — not just WHAT the setup is.

## Setup Grades

| Grade | Criteria |
|---|---|
| A | All 5 categories met, confidence ≥ 70%, regime trending |
| B | 4 categories met, confidence 50–69% |
| C | 3 categories met, marginal alignment |
| D | 2 or fewer categories met — **blocked by risk engine** |

## Evidence Invalidation

A setup's evidence becomes invalid when:
- Price closes beyond the SL level before entry
- HTF regime flips opposite to trade direction
- A higher-timeframe close invalidates the range
- Liquidity zone is swept in the opposite direction
- 10+ bars pass without entry trigger (time decay)

When invalidated, the setup lifecycle transitions to `INVALIDATED` and a note is appended.

## Audit Trail

Every evidence evaluation is persisted via WebhookEvent → Setup → Trade chain:
- WebhookEvent: raw payload, timestamp, source IP
- Setup: parsed evidence, grade, lifecycle status
- Trade: final entry parameters, SL, TPs, outcome

The full chain must be reconstructable from DB alone — no in-memory state is authoritative.
