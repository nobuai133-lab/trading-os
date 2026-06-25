# ADR-004: Replay Engine — Event Sourcing as Audit Trail and Backtest Foundation

**Date:** 2026-06-25  
**Status:** Accepted  
**Deciders:** CTO  
**Level:** A (replay logic within kernel), C (production replay execution)

## Context

ITOS needs to:
1. **Recover from crashes** — restart without losing state, without replaying the entire event history on every boot
2. **Debug divergences** — replay a specific window of events to understand why kernel and SystemState diverged
3. **Backtest strategies** — run historical signals through the kernel to evaluate strategy performance

The `CoreStateKernel` is event-sourced (ADR-001), so all three capabilities come from the same underlying mechanism: replaying `KernelEvent` records from a given sequence number.

## Decision

The replay engine is implemented directly inside `CoreStateKernel` as three methods:

### `initialize()` — Startup Recovery
```
1. Load latest snapshot (if any)
2. Replay all events after snapshot.seq
3. Cache is now current; system is ready to process new events
```

### `replayFrom(seq)` — Diagnostic Replay
```
1. Load events from seq onward (up to current)
2. Apply to a temporary state copy (does not affect live cache)
3. Returns reconstructed state at that point for inspection
```

### `rollbackTo(seq)` — Emergency Rollback
```
1. Load snapshot at or before seq
2. Replay events from snapshot.seq to target seq
3. Replace live cache with reconstructed state
4. Level C: requires explicit approval before use in production
```

### Snapshot Strategy

A snapshot is created automatically every `STATE_SNAPSHOT_INTERVAL = 100` events. Snapshots store the full `KernelFullState` as JSON in `KernelSnapshot`. On startup:
- If no snapshot exists: replay all events from beginning
- If snapshot exists: replay only events after the snapshot's `seq`

With 100 events per snapshot, worst-case cold start replays 99 events — bounded and fast.

## Rationale

Embedding replay in `CoreStateKernel` (vs. a separate service) was chosen because:
1. Replay requires direct access to the in-memory state cache, which is kernel-private
2. A separate service would need to reconstruct the same state machine logic, creating duplication
3. Replay is a recovery/diagnostic operation — it does not need to be called from outside the kernel

The 100-event snapshot interval was chosen as a balance between:
- Storage cost (1 snapshot per 100 events ≈ manageable)
- Cold-start replay time (≤100 events ≈ sub-second on any hardware)
- Snapshot creation overhead (1 extra DB write per 100 events ≈ negligible)

## Consequences

### Positive
- Cold start replay is bounded to ≤99 events regardless of total event count
- Divergence investigations can pinpoint exactly which event caused the divergence
- Backtest foundation is the same code path as production — no separate implementation
- Rollback is possible without a DBA — it is a kernel operation

### Negative
- `KernelSnapshot` table grows indefinitely without a pruning policy (old snapshots not yet pruned)
- `rollbackTo()` resets live production state — must never be called without Level C approval
- Replay of a large event window (e.g., backtest of 10,000 events) is slow in-process

### Risks
- **Risk:** Snapshot state drifts from what the events would produce (snapshot corruption)
- **Mitigation:** `KernelValidator.validateEventChain()` checks chain integrity on replay; snapshot is discarded and full replay attempted if validation fails
- **Risk:** `rollbackTo()` called accidentally in production
- **Mitigation:** The method checks `process.env.NODE_ENV !== 'production'` in non-emergency paths; full production rollback requires Level C approval

## Alternatives Considered

| Option | Why Rejected |
|--------|-------------|
| No snapshots (full replay always) | Startup time grows linearly with event count; unacceptable after 100k+ events |
| External replay service (separate process) | Requires IPC; adds complexity; same logic duplication problem |
| Database triggers for state reconstruction | Not portable; ties kernel to PostgreSQL internals |
| Snapshot every event | Storage explosion; defeats the purpose of event sourcing |

## Key Files

```
src/kernel/KernelAPI.ts
  initialize()      — startup recovery with snapshot + trailing replay
  replayFrom(seq)   — diagnostic replay (returns reconstructed state)
  rollbackTo(seq)   — emergency production rollback (Level C in production)
  createSnapshot()  — manual snapshot trigger (also called auto every 100 events)

src/kernel/store/
  EventStore.ts     — readFrom(seq), getLatestSeq()
  SnapshotStore.ts  — save(), loadLatest(), loadAt(seq)

src/kernel/__tests__/
  replay.test.ts    — 7 tests covering rollbackTo, replayFrom, snapshot recovery cycle
```

## Review Date

On v1.1.0 (when Memory Engine begins using replay for pattern extraction from historical events).
