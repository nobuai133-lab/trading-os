# ITOS v1.0 — Risk Constitution

## Prime Directive

**No trade may be entered without a defined exit.** Every entry requires a stop-loss at a structural level and a minimum risk/reward of 1.5. These rules are not guidelines — they are enforced in code by the risk engine.

## Kill Switch

The kill switch is the highest-priority control in the system.

- Env var: `KILL_SWITCH=true`
- Effect: All signals are rejected. No trades open. No DB writes except a logged rejection event.
- Reset: Set `KILL_SWITCH=false` or remove the variable.
- Activation: Manual only. No automatic kill switch triggers in current implementation.

When KILL_SWITCH is active, the webhook returns `{ allowed: false, reason: 'Kill switch active' }` and a `KILL_SWITCH` notification is sent via Telegram.

## Trading Modes

| Mode | Behavior |
|---|---|
| `PAPER_TRADING` | Signals processed, trades recorded in DB, no real orders sent |
| `ALERT_ONLY` | Signals processed, notifications sent, no trades recorded |
| `LIVE` | **Not yet implemented. Requires governance approval.** |

Default: `PAPER_TRADING`

Env var: `TRADING_MODE`

Live mode must not be enabled until:
1. 3+ months of paper trading with positive expectancy
2. Governance review with documented edge
3. Explicit code change by the trader (not a config toggle alone)

## Risk Gates (enforced in riskEngine.ts)

### Gate 1 — Kill Switch
- If `KILL_SWITCH=true` → reject all signals

### Gate 2 — Grade Gate
- If `grade === 'D'` → reject entry

### Gate 3 — RR Gate
- If `rr < 1.5` → reject entry

### Gate 4 — Confidence Gate
- If `confidence < 30` → reject entry

All four gates run on every `ENTRY_TRIGGERED` signal. If any gate fails, the signal is rejected with a reason logged and a notification sent.

## Position Sizing

Position size is computed from:
```
riskPct = 1.0 (default, configurable per trade)
accountBaseline = $10,000 (PAPER mode reference)
riskAmount = accountBaseline × riskPct / 100
distancePct = abs(entry - sl) / entry
sizeBtc = riskAmount / (entry × distancePct)
```

In PAPER_TRADING mode, `accountBaseline` is a fixed reference. No actual capital is at risk.

Maximum single-trade risk: 2% of account baseline (hard-coded limit — not configurable via webhook payload).

## Anti-Overtrading Rules

These rules are enforced in memoryEngine.ts and tradeLifecycle.ts:

1. **One active trade at a time** — a second `ENTRY_TRIGGERED` signal is rejected if any non-closed trade exists
2. **Setup fingerprint uniqueness** — the exact same structural setup cannot be entered twice
3. **Range re-entry restriction** — after trading in a range, re-entry requires fresh liquidity sweep + range reset + fingerprint clearance
4. **Cooldown after TP3** — 4 bars (4H) or 2 bars (1D) mandatory pause after full trade completion
5. **Stale range blocking** — ranges untouched for >7 days are marked STALE and block entry

## Drawdown Governance

| Drawdown Level | Action |
|---|---|
| > 5% on paper | Review last 3 trades, document learnings |
| > 10% on paper | Pause trading, audit strategy engine confidence |
| > 20% on paper | Full review required before resuming |

In paper mode, drawdown is computed against the accountBaseline reference, not real capital.

## Risk Metrics — Required Before Live Consideration

- Minimum 50 paper trades documented
- Win rate ≥ 40% (with positive expectancy from RR)
- Maximum drawdown < 20%
- Profit factor ≥ 1.3
- Average RR achieved ≥ 1.5
- All trades documented with entry thesis and outcome

## Emergency Procedures

### Scenario: Unexpected trade opened
1. Set `KILL_SWITCH=true` immediately
2. Review WebhookEvent table for unexpected signals
3. Identify source (TradingView alert misconfiguration, replay, etc.)
4. Set trade status to CLOSED_MANUAL in DB
5. Document in DECISION_LOG.md

### Scenario: System offline during active trade
1. Trade remains in DB with last known status
2. On system restart, stateBuilder rebuilds from DB
3. Trade will appear in dashboard with last snapshot price
4. Manual SL_HIT or CLOSE_TRADE signal can be sent via webhook to close
