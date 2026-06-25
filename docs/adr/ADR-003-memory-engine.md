# ADR-003: Memory Engine — Deferred to Post-v1.0

**Date:** 2026-06-25  
**Status:** Accepted  
**Deciders:** CTO  
**Level:** A (when implementation begins)

## Context

The ITOS Memory Engine (constitution/06-Memory-Engine.md) is designed to accumulate institutional trading knowledge: setup fingerprints, outcome patterns, risk-adjusted performance by setup type, and market regime recognition. This is a core differentiator of ITOS over simple signal-following systems.

However, implementing the Memory Engine requires:
1. A reliable event history — which the Core State Kernel provides via `KernelEvent` records
2. A sufficient volume of completed trades to form meaningful patterns
3. Stage 3 completion (kernel as single source of truth) so Memory Engine reads from authoritative data

Attempting to build the Memory Engine before Stage 3 would require either:
- Reading from `SystemState` (non-authoritative, no history), or
- Building a parallel event accumulation system that duplicates the kernel's purpose

## Decision

Defer Memory Engine implementation to post-v1.0 (after Stage 3 approval). The `KernelEvent` store serves as the foundation that Memory Engine will query when the time comes.

The deferral is tracked as item R-21 in `PROJECT_ROADMAP.md`.

During v1.0 development, the Memory Engine interface (`constitution/06-Memory-Engine.md`) is treated as a specification document only — no implementation code is created.

## Rationale

The decision to defer is driven by:
1. **Data dependency:** Memory patterns require completed trade cycles. The kernel must be in production authority mode to accumulate trustworthy data.
2. **Risk reduction:** Implementing Memory Engine before Stage 3 creates premature coupling to an unverified data source.
3. **Complexity budget:** v1.0 scope is already significant. Adding Memory Engine increases risk of v1.0 slipping.
4. **Event sourcing foundation:** The `KernelEvent` store already provides everything Memory Engine needs — the deferred work is the pattern recognition layer on top, not data collection.

## Consequences

### Positive
- v1.0 scope is bounded and achievable
- Memory Engine starts with a rich, verified event history rather than retroactively filling it
- No technical debt from premature implementation

### Negative
- Pattern recognition and trade memory not available until v1.1+
- Trade quality assessment is manual in v1.0

### Risks
- **Risk:** Post-v1.0 context is lost and Memory Engine is never implemented
- **Mitigation:** `constitution/06-Memory-Engine.md` preserves the full specification; R-21 in PROJECT_ROADMAP.md marks it as deferred (not cancelled)

## Alternatives Considered

| Option | Why Rejected |
|--------|-------------|
| Implement now against SystemState | No trade history; SystemState is not authoritative for kernel-level data |
| Implement stub with no logic | Creates dead code and misleads future developers |
| Implement alongside Stage 2.5 | Adds scope to an already complex verification stage |

## Key Constitution Reference

Full Memory Engine specification: `constitution/06-Memory-Engine.md`

## Review Date

On Stage 3 approval. Memory Engine implementation begins immediately after Stage 3 is complete and the kernel has accumulated ≥100 completed trade cycles.
