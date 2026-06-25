# ADR-001: Core State Kernel — Event-Sourced State Machine

**Date:** 2026-06-25  
**Status:** Accepted  
**Deciders:** CTO  
**Level:** D (authority switch), C (migration execution), A (implementation)

## Context

ITOS requires a reliable, auditable record of trading system state across the full trade lifecycle. The existing `SystemState` Prisma model provides current state but no history, making it impossible to:
- Replay events to reconstruct state at any past point
- Diagnose why a state transition happened
- Verify that state transitions followed the intended state machine
- Recover from process crashes without replaying missed events

Additionally, concurrent webhook processing can cause race conditions when multiple signals arrive close together.

## Decision

Implement a `CoreStateKernel` — an event-sourced state machine that:

1. **Appends immutable `KernelEvent` records** with monotonically increasing `seq: BigInt`
2. **Maintains in-memory state cache** rebuilt from events on startup (with snapshot optimization)
3. **Enforces a serial write queue** (`_writeQueue: Promise<unknown>`) to prevent concurrent seq collisions
4. **Auto-snapshots every 100 events** to bound replay time on restart
5. **Runs in shadow mode initially** — mirrors all `SystemState` writes without replacing them

The kernel is deployed in stages:
- **Stage 1:** Foundation — state machines, stores, KernelAPI, full test suite
- **Stage 2:** Dual-write — webhook fires kernel write fire-and-forget after existing Prisma writes
- **Stage 2.5:** Shadow verification — consistency measurement, divergence monitoring, go-live gates
- **Stage 3:** Authority transfer — kernel becomes single source of truth (Level D approval required)

## Rationale

Event sourcing was chosen over:
- **Mutable state only:** No audit trail, no replay, no divergence detection
- **CDC (Change Data Capture):** Requires additional infrastructure (Debezium, Kafka); overkill for v1.0
- **CQRS with separate read model:** Adds complexity before the read path is a bottleneck

The shadow mode approach was chosen to:
- Eliminate risk during the transition (SystemState remains authoritative)
- Validate kernel correctness against known-good production data
- Establish a measurable consistency target (99.95%) before switching authority

## Consequences

### Positive
- Full audit trail of every state transition
- Deterministic replay for debugging and backtest
- Snapshot recovery bounds restart time to seconds
- Serial write queue eliminates seq collision races
- Divergence monitoring gives confidence before authority switch

### Negative
- Additional DB tables and storage (KernelEvent, KernelSnapshot)
- Dual-write adds ~5–50ms latency to the fire-and-forget background path
- `seq: BigInt` requires `bigIntReplacer` for all JSON serialization of kernel data
- Kernel must be initialized before first write (adds ~10–100ms on cold start)

### Risks
- **Risk:** Kernel initialization fails on cold start — webhook still returns 200 (fire-and-forget)
- **Mitigation:** `getKernel()` is `await`ed inside the void IIFE; errors are caught and logged
- **Risk:** Out-of-order TPs from TradingView (TP2 before TP1) could cause illegal transitions
- **Mitigation:** Auto-reconciliation emits missing intermediate events (TP1HitReconciled, TP2HitReconciled)

## Alternatives Considered

| Option | Why Rejected |
|--------|-------------|
| Pure `SystemState` (no kernel) | No audit trail; cannot replay or verify transitions |
| Replace `SystemState` immediately | Too risky; no validation period; no rollback |
| External event store (EventStoreDB) | Infrastructure dependency; overkill for v1.0 |
| Kafka event stream | Same — overkill for single-process Next.js app |

## Key Files

```
src/kernel/
  types.ts                    — Domain state interfaces, KernelEvent, bigIntReplacer
  KernelAPI.ts                — CoreStateKernel class (writeEvent, applyTransition, readState)
  singleton.ts                — globalThis-based singleton for Next.js hot-reload safety
  machines/TradeMachine.ts    — TradePhase state machine (11 states)
  machines/LifecycleMachine.ts — KernelLifecycleMode state machine (8 states)
  store/EventStore.ts         — PrismaEventStore (append, readFrom, nextSeq)
  store/SnapshotStore.ts      — PrismaSnapshotStore (save, loadLatest)
  store/StateCache.ts         — In-memory domain state cache
  KernelValidator.ts          — Input and chain validation (KERNEL-1001..3003)
src/lib/kernel/
  signalMapper.ts             — Maps TradingView webhook signals to KernelEventInput
  divergenceMonitor.ts        — Compares kernel vs SystemState, emits DivergenceReport
  divergenceClassifier.ts     — Classifies divergences as INFO/WARNING/CRITICAL
  metricsCollector.ts         — Accumulates KernelMetrics (single-row upsert pattern)
src/app/api/v1/kernel/
  health/route.ts             — GET /api/v1/kernel/health
  state/route.ts              — GET /api/v1/kernel/state
  events/route.ts             — GET /api/v1/kernel/events
```

## Stage 3 Promotion — 2026-06-25

Stage 3 completed. Kernel is now the single source of truth for `/api/v1/state`.

Implementation details:
- `authorityConfig.ts` — `KERNEL_AUTHORITY` feature flag (rollback: set `=false`)
- `kernelStateAdapter.ts` — kernel overlay on legacy base
- `kernelSeeder.ts` — cold-boot seeding from SystemState
- Domain reducers updated to handle `KernelSystemSeeded` event

SystemState remains write-compatible. Legacy cleanup deferred to post-v1.0.

## Review Date

Post-v1.0 legacy cleanup (SystemState removal).
