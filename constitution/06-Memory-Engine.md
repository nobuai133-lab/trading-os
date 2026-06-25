# ITOS v1.0 — Memory Engine

## Purpose

The memory engine enforces institutional discipline over time. It remembers every setup considered, every range traded, and every cooldown period. Its primary function is to prevent the system from repeating itself — the most common cause of overtrading.

## Three Memory Systems

### 1. RangeMemory
**Table:** `RangeMemory`  
**Purpose:** Tracks the lifecycle of a structural price range

| Field | Description |
|---|---|
| `rangeHigh` / `rangeLow` | Range boundaries (absolute price) |
| `midline` | (rangeHigh + rangeLow) / 2 |
| `width` | (rangeHigh - rangeLow) / rangeLow × 100 (%) |
| `status` | ACTIVE → TRADED → STALE |
| `tradeCount` | How many trades executed in this range |
| `lastTradeDirection` | LONG or SHORT |
| `lastTradeResult` | WIN / LOSS / MANUAL |
| `freshLiquidity` | true = liquidity swept after last trade |
| `reentryAllowed` | true = re-entry permitted |
| `lastTouchedAt` | Used for stale detection |

**State machine:**
```
ACTIVE → TRADED (after first trade)
TRADED → ACTIVE (after fresh liquidity + range reset)
ACTIVE/TRADED → STALE (after 7 days without touch)
STALE → requires manual reset
```

**Stale detection:** `markStaleRanges()` runs on every webhook — ranges with `lastTouchedAt` older than 7 days are set to STALE, `reentryAllowed = false`.

### 2. SetupFingerprint
**Table:** `SetupFingerprint`  
**Purpose:** Uniquely identifies a structural setup to prevent duplicate entries

**Fingerprint ID format:**
```
{symbol}-{timeframe}-{direction}-RH{rangeHigh}-RL{rangeLow}-EH{entryZoneHigh}-EL{entryZoneLow}
```

Example: `BTCUSDT-4H-LONG-RH65000-RL60000-EH61500-EL60500`

| Field | Description |
|---|---|
| `alreadyTraded` | true = this exact setup has been entered |
| `status` | NEW → ACTIVE → TRADED |
| `tradedAt` | Timestamp of last trade using this fingerprint |
| `sameSetupDetected` | Set to true when a duplicate SETUP_DETECTED arrives |

**Duplicate detection:** If a new SETUP_DETECTED arrives with an identical fingerprint ID, it is flagged but not rejected — it updates `sameSetupDetected = true` so the dashboard can display a warning.

**Entry block:** `ENTRY_TRIGGERED` is blocked if `alreadyTraded = true` for the matching fingerprint.

### 3. Cooldown
**Table:** `Cooldown`  
**Purpose:** Enforces mandatory pause after a completed trade

| Field | Description |
|---|---|
| `active` | true while cooldown is in effect |
| `totalBars` | Total bars the cooldown runs |
| `remainingBars` | Bars remaining (decremented on BAR_CLOSE) |
| `reason` | TP3_HIT / SL_HIT / MANUAL |
| `activatedAt` | When cooldown started |

**Cooldown durations by trigger:**
| Trigger | 4H timeframe | 1D timeframe |
|---|---|---|
| TP3_HIT | 4 bars | 2 bars |
| SL_HIT | 4 bars | 2 bars |

**Cooldown lifecycle:**
1. TP3 or SL hit → `createCooldown()` inserts row with `active = true`
2. Each `BAR_CLOSE` signal → `remainingBars -= 1`
3. When `remainingBars <= 0` → `active = false`
4. New entries blocked while `active = true`

## Webhook Deduplication

**Function:** `isDuplicateWebhook(setupId, windowMs = 60_000)`  
**Logic:** Checks `WebhookEvent` table for same `setupId` within the last 60 seconds  
**Purpose:** TradingView alerts can fire multiple times for the same bar close — this prevents double processing

## Memory Queries in StateBuilder

Every state build reads:
- `RangeMemory` where `symbol = 'BTCUSDT'` AND `status IN ('ACTIVE', 'TRADED')` — last 10 by `lastTouchedAt`
- `SetupFingerprint` where `alreadyTraded = false` — most recent
- `Cooldown` where `active = true` AND `remainingBars > 0` — most recent

The `antiReentry` block in DashboardState reflects all three systems.

## Block Conditions

A trade entry is blocked if ANY of:
- `cooldownState.active = true`
- `setupFingerprint.alreadyTraded = true`
- `rangeMemory.status = 'STALE'`
- `rangeMemory.reentryAllowed = false`

When blocked, `mode = 'COOLDOWN'` and `nextRequiredConditions` lists what must happen before re-entry is possible.

## Memory Reset Protocol

To manually reset memory after a legitimate re-entry opportunity:
1. Fresh liquidity sweep confirmed → `markRangeTraded()` sets `freshLiquidity = true`, `reentryAllowed = true`
2. New structural setup → `getOrCreateFingerprint()` creates a new fingerprint with different ID
3. Cooldown expired → happens automatically via BAR_CLOSE signals

No manual DB edits should be required for normal operation. If manual intervention is needed, document it in DECISION_LOG.md.
