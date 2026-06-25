# ADR-005: BacktestEngine–ReplayEngine Coupling & Technical Debt

**Status:** Accepted (Phase 10, 2026-06-25)  
**Deciders:** Architecture review — Phase 10 close  
**Supersedes:** None

---

## Context

`BacktestEngine` was built as a fee/slippage wrapper around `ReplayEngine`. During Phase 10 architecture review, three coupling points were identified that represent non-blocking technical debt.

---

## Accepted Technical Debt

### TD-001 — `RISK_PCT` constant is duplicated

**Location:** `src/lib/backtestEngine.ts:17`
```typescript
const RISK_PCT = 0.01;  // must match replayEngine constant
```

**Problem:** `replayEngine.ts` declares `RISK_PCT` as a module-level private constant. `backtestEngine.ts` copies it with a comment noting the coupling. If the replay engine changes its default risk distance, the backtest engine silently uses the wrong value until tests surface the divergence.

**Resolution:** Export `RISK_PCT` (or a `DEFAULT_REPLAY_CONSTANTS` object) from `replayEngine.ts` and import it in `backtestEngine.ts`. This makes the coupling explicit and compiler-enforced.

```typescript
// replayEngine.ts — proposed change
export const RISK_PCT = 0.01;

// backtestEngine.ts — after change
import { RISK_PCT } from '@/lib/replayEngine';
```

**Priority:** Low — only breaks if `RISK_PCT` changes (it has not changed since v1.10.0).

---

### TD-002 — `zeroBacktestMetrics` reimplements private `zeroMetrics`

**Location:** `src/lib/backtestEngine.ts:131–143`

**Problem:** `replayEngine.ts` has a private `zeroMetrics(totalCandles)` function that initialises a `ReplayMetrics` object to all-zeros. `backtestEngine.ts` cannot import it because it is unexported. `zeroBacktestMetrics` duplicates all 18 fields and adds 7 backtest-specific ones. If a new field is added to `ReplayMetrics` / `zeroMetrics` without updating `zeroBacktestMetrics`, the backtest session will start with `undefined` for that field (caught by TypeScript if the type is updated simultaneously, silent otherwise if optional).

**Resolution:** Export a `createZeroReplayMetrics(totalCandles: number): ReplayMetrics` helper from `replayEngine.ts`. `zeroBacktestMetrics` then spreads it:

```typescript
// replayEngine.ts — proposed change
export function createZeroReplayMetrics(totalCandles: number): ReplayMetrics { ... }

// backtestEngine.ts — after change
import { createZeroReplayMetrics } from '@/lib/replayEngine';

function zeroBacktestMetrics(totalCandles: number): BacktestMetrics {
  return {
    ...createZeroReplayMetrics(totalCandles),
    totalFeesR: 0, totalSlippageR: 0, netR: 0,
    sharpeRatio: 0, calmarRatio: 0, profitFactor: 0, recoveryFactor: 0,
  };
}
```

**Priority:** Medium — protects against silent missing fields if `ReplayMetrics` grows.

---

### TD-003 — `runBacktestSession` duplicates `runReplaySession` loop

**Location:** `src/lib/backtestEngine.ts:216–237`

**Problem:** `runBacktestSession` contains an identical while-loop pattern to `runReplaySession` in `replayEngine.ts`. It cannot call `runReplaySession` directly because it must route through `stepBacktestSession` (to apply fees on each step). If the run loop acquires new logic (e.g., pause handling, error recovery, step-count telemetry), the two loops will silently diverge.

**Resolution (if divergence appears):** Extract a generic session runner into a shared utility:

```typescript
// potential future helper in replayEngine.ts or a new src/lib/sessionRunner.ts
export function runSessionLoop<T extends { status: ReplayStatus; maxStepsPerRun: number }>(
  session:  T,
  stepFn:   (s: T, now: Date) => { session: T; stepped: boolean },
  maxSteps: number | undefined,
  now:      Date,
): { session: T; stepsRun: number } { ... }
```

`runBacktestSession` and `runReplaySession` would both call this. Do not introduce this abstraction prematurely — implement only when the loops actually diverge.

**Priority:** Low — implement only on first divergence, not before.

---

## Decision

All three items are accepted as non-blocking technical debt for Phase 10 release. They are to be addressed in the following order if resources allow:

1. **TD-002** first — prevents silent missing fields as `ReplayMetrics` grows
2. **TD-001** second — makes constant coupling compiler-visible  
3. **TD-003** last, and only on actual divergence

No Phase 11 work is blocked by any of these items.

---

## Consequences

- `RISK_PCT` change in `replayEngine.ts` requires manual sync to `backtestEngine.ts` until TD-001 is resolved
- New `ReplayMetrics` fields require manual addition to `zeroBacktestMetrics` until TD-002 is resolved
- Run-loop logic changes in `runReplaySession` require manual mirroring in `runBacktestSession` until TD-003 is resolved (if the loops diverge)
