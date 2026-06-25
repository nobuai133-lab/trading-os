# ITOS — Institutional Engineering Governance Framework (IEGF)

> **Authority:** CTO  
> **Effective:** 2026-06-25  
> **Version:** 1.0.0  
> **Status:** RATIFIED

This document governs all engineering decisions, approvals, and execution within the ITOS project. It supersedes all prior ad-hoc confirmation workflows. Once ratified, Claude operates autonomously through Level A and Level B work without pausing for approval.

---

## Section 1 — Engineering Philosophy

### 1.1 Core Principles

| # | Principle | Application |
|---|-----------|-------------|
| P-01 | **Safety First** | Paper trading default. Live execution requires explicit Level D approval. Never enable real-money paths implicitly. |
| P-02 | **SystemState is Authority** | Until Stage 3 is explicitly approved, `SystemState` is the single source of truth. The kernel is shadow-only. |
| P-03 | **Non-Blocking Kernel** | Kernel writes are fire-and-forget. They must never block webhook responses or affect user-facing latency. |
| P-04 | **Fail-Safe Divergence** | Divergences are observed and logged, never auto-corrected. Correction requires human review. |
| P-05 | **Idempotent by Default** | All state mutations check for prior execution via `correlationId` before writing. |
| P-06 | **Event Sourcing Immutability** | `KernelEvent` records are append-only. Retroactive mutation is never permitted. |
| P-07 | **No Secrets in Code** | All secrets via Railway environment variables. `.env.local` is never committed. |
| P-08 | **Rollback-Ready** | Every production change must have a defined rollback path before deployment. |
| P-09 | **Observability Over Optimism** | Log and measure before optimizing. Metrics drive decisions, not intuition. |
| P-10 | **Explicit Over Implicit** | Authority switches, mode changes, and deployment actions require explicit approval. |

### 1.2 Architecture Invariants

These invariants must never be violated without Level D approval:

1. `SystemState` remains the production read authority until Stage 3 is approved
2. The kernel dual-write is always `void (async () => { ... })()` — never `await`ed in the webhook path
3. `seq: BigInt` on `KernelEvent` is monotonically increasing and collision-free
4. All Railway secrets are injected as environment variables, never hardcoded
5. The paper trading mode (`PAPER_TRADING` / `ALERT_ONLY`) is the default; live execution requires explicit configuration

---

## Section 2 — Approval Policy

### 2.1 Level A — Automatic (No Approval Required)

Claude executes immediately without pausing.

- Documentation, comments, inline code notes
- Test files (unit, integration, regression)
- Refactoring within existing module boundaries
- Logging, debug instrumentation, trace IDs
- Metrics collection additions (new counters, timers)
- Dashboard UI components and pages (read-only, display-only)
- Monitoring endpoints and health checks
- New TypeScript interfaces, types, enums, constants
- Performance improvements (caching, memoization, query optimization)
- Kernel replay, backtest, memory engine improvements
- Code cleanup, dead code removal, import ordering
- Bug fixes that do not change data contracts or DB schema
- New signal mappers or divergence classifiers

### 2.2 Level B — Notify Only (Execute + Report)

Claude executes, then immediately reports what was changed and why.

- New Prisma models (schema-only, no migration execution)
- New API route handlers (`/api/v1/...`)
- New Next.js pages
- New services (`src/services/...`)
- New background workers or schedulers
- New cache layers or queue implementations
- New provider implementations (market data, exchange, etc.)
- Migration SQL files created manually (not executed)
- New Prisma schema fields on existing models

**Report format:**
```
[Level B] <what was created>
Path: <file path>
Why: <business reason>
Impact: <what it affects>
Rollback: <how to undo>
```

### 2.3 Level C — Stop + Ask (Architect Approval)

Claude stops, describes the action, and waits for explicit approval.

- Executing DB migrations (`prisma migrate deploy`, `prisma migrate dev`)
- Railway deployment configuration changes
- Environment variable additions or changes
- Authentication or authorization changes
- External service integrations (new APIs, webhooks, OAuth)
- Production configuration changes (Railway, Vercel, etc.)
- API contract changes (breaking changes to existing endpoints)
- Kernel authority switch preparation (any code that conditionally reads kernel instead of SystemState)
- Prisma `schema.prisma` field deletions or type changes on existing fields

### 2.4 Level D — Always Stop (Executive Approval)

Claude never proceeds without explicit human approval, regardless of prior context.

| Action | Why It Is Level D |
|--------|-------------------|
| Execute production DB migration that drops or alters columns | Irreversible data loss risk |
| Delete or disable `SystemState` as production authority | Architectural regime change |
| Remove rollback path from any production system | Eliminates recovery option |
| Enable live trading execution (any real-money path) | Financial risk |
| Connect to exchange order execution APIs | Financial risk |
| Delete `SystemState` Prisma model or migration | Permanent production data loss |
| Remove kernel shadow mode; make kernel the primary writer | Stage 3 — full authority transfer |
| Major architectural rewrite (module restructure, framework change) | Systemic risk |
| Force-push to `main` or any production branch | Git history corruption risk |

**Stage 3 specifically:** Making the kernel the single source of truth for `/api/v1/state` and all production reads is always Level D, regardless of go-live gate metrics.

---

## Section 3 — Execution Policy

### 3.1 Auto-Progression Rules

After this document is ratified:

1. Claude executes all Level A work automatically within the conversation turn.
2. Claude executes all Level B work, then provides a change report before continuing.
3. Claude stops at Level C and waits for explicit user approval.
4. Claude stops at Level D and provides a detailed impact assessment; never self-approves.

### 3.2 Multi-Step Task Execution

For tasks spanning multiple approval levels:

1. Execute all Level A and Level B sub-tasks in sequence
2. Stop at the first Level C or Level D boundary
3. Report what was completed (A/B) and what is pending (C/D)
4. Do not request re-approval for already-approved Level A/B work

### 3.3 Ambiguity Resolution

When a task's level is ambiguous, Claude defaults to the **higher** level (more caution). If the task could be Level B or Level C, treat it as Level C.

### 3.4 Emergency Override

The user may explicitly downgrade a level by stating the action and approval level:
> "Proceed with [action] — I approve this as Level C."

This applies only to the specific action in that message, not to all future instances.

---

## Section 4 — Change Management

### 4.1 Mandatory Artifacts per Change Type

| Change Type | Required Artifacts |
|-------------|-------------------|
| New DB model | Schema change + manual migration SQL + Level B report |
| New API endpoint | Route handler + type definitions + Level B report |
| DB migration execution | Migration SQL reviewed + Level C approval + rollback SQL documented |
| Kernel phase transition | ADR update + divergence check + Level D approval |
| New external integration | Security review note + secret management plan + Level C approval |

### 4.2 Rollback Documentation

Every Level C and Level D change must document its rollback path before execution:

```
Rollback Plan:
  Command: <exact command to undo>
  Data impact: <what data is affected or lost>
  Time to rollback: <estimated minutes>
  Dependencies: <what else must change>
```

### 4.3 CHANGELOG Protocol

All significant changes are appended to `CHANGELOG.md` using Keep a Changelog format:

- `### Added` — new features
- `### Changed` — changes in existing functionality
- `### Fixed` — bug fixes
- `### Deprecated` — soon-to-be removed features
- `### Removed` — removed features
- `### Security` — security patches

Minimum entry for Level B and above:
```markdown
## [Unreleased]
### Added
- Brief description (path/to/file.ts) [Level B/C/D]
```

---

## Section 5 — Architecture Decision Records (ADR)

### 5.1 ADR Format

All ADRs live in `docs/adr/ADR-NNN-slug.md`.

```markdown
# ADR-NNN: Title

**Date:** YYYY-MM-DD  
**Status:** Proposed | Accepted | Deprecated | Superseded  
**Deciders:** CTO | Architect | Team  
**Level:** A | B | C | D  

## Context
Why this decision was needed.

## Decision
What was decided.

## Rationale
Why this option was chosen over alternatives.

## Consequences
### Positive
### Negative
### Risks

## Alternatives Considered
| Option | Why Rejected |
|--------|-------------|

## Review Date
YYYY-MM-DD (or "On Stage N transition")
```

### 5.2 When to Write an ADR

Write an ADR for:
- Any Level C or Level D decision
- Any architectural change that affects more than one module
- Any decision where the rationale would not be obvious from the code
- Any decision to defer or not implement a feature

Do not write ADRs for:
- Level A tasks (code is the documentation)
- Individual bug fixes
- Minor refactors

---

## Section 6 — Release Management

### 6.1 Version Milestones

| Version | Name | Gate Conditions |
|---------|------|-----------------|
| `v1.0.0-alpha` | Core Infrastructure | Stage 2.5 active: dual-write running, health dashboard live |
| `v1.0.0-beta` | Shadow Verification | ≥1000 kernel events, consistency ≥99.95%, 0 critical divergences |
| `v1.0.0-rc` | Go-Live Ready | All 5 go-live gates passing, Stage 3 approved |
| `v1.0.0` | Production Authority | Kernel is single source of truth, SystemState read-only |
| `v1.1.0` | Memory Engine | Memory engine integrated, pattern recognition active |
| `v1.2.0` | Risk Constitution | Full risk gating on all trades |
| `v2.0.0` | Live Execution | Exchange integration, real-money execution enabled |

### 6.2 Release Gates

Before any version is tagged:
1. All tests pass (`npm test`)
2. TypeScript builds without errors (`npm run build`)
3. No `console.log` in production code (only structured logger)
4. All Level C/D changes reviewed and documented
5. Railway deployment verified (no crash within 60 seconds of deploy)
6. Health endpoint returns `{ ok: true }` post-deploy

### 6.3 v2.0.0 Live Execution Gate

`v2.0.0` requires explicit CTO sign-off with all of:
- 30+ consecutive trading days of shadow mode with 0 critical divergences
- Consistency score ≥99.99% over last 7 days
- Paper trading P&L reviewed and deemed acceptable
- Risk constitution fully enforced
- Drawdown limits tested in backtest
- Emergency kill switch implemented and tested

---

## Section 7 — Risk Matrix

### 7.1 Change Risk Classification

| Impact \ Probability | Low | Medium | High |
|---------------------|-----|--------|------|
| **Low** | Level A | Level A | Level B |
| **Medium** | Level B | Level C | Level C |
| **High** | Level C | Level D | Level D |

### 7.2 Known High-Risk Areas

| Area | Risk | Mitigation |
|------|------|------------|
| Kernel authority switch | SystemState bypass → incorrect trades | Level D gate + consistency check |
| DB migration execution | Schema drift → data loss | Manual SQL review + rollback plan |
| BigInt serialization | JSON.stringify drops bigint → silent data corruption | `bigIntReplacer` always required |
| Dual-write idempotency | Retry creates duplicate kernel event | `correlationId` check before write |
| Prisma singleton in Next.js | Hot-reload creates multiple Prisma clients | `globalThis.__prisma` pattern required |
| Logger import | `@/lib/logger` has no `withContext` | Always import from `@/core/logger` |
| Live execution default | Accidental real-money order | Default mode is always `PAPER_TRADING` |

### 7.3 Incident Response

On critical divergence (`criticalDivergences > 0`):
1. Stage 3 go-live is automatically blocked (kernel gate fails)
2. Alert visible on `/kernel-health` dashboard
3. Investigate via `GET /api/v1/kernel/events?type=<event>` and divergence log
4. Do not clear divergence counts — they are a permanent record
5. Root cause must be documented in `DECISION_LOG.md` before Stage 3 re-evaluation

---

## Section 8 — Definition of Done

### 8.1 Feature Complete

A feature is done when:
- [ ] Implementation complete with no TypeScript errors
- [ ] Unit tests written and passing
- [ ] Integration path verified (API endpoint tested end-to-end where applicable)
- [ ] Logger uses `@/core/logger` with `withContext`
- [ ] No `console.log` statements
- [ ] No `as any` casts (unless with documented justification)
- [ ] `CHANGELOG.md` updated
- [ ] Level B report filed (if Level B or above)

### 8.2 Stage Complete

A kernel stage is complete when:
- [ ] All go-live gates documented and confirmed
- [ ] All affected ADRs updated to `Accepted`
- [ ] CHANGELOG entry for the stage transition
- [ ] Health endpoint reports `healthy` status
- [ ] No pending Level C or Level D items remain unreviewed

### 8.3 Production Ready

A deployment is production-ready when:
- [ ] `npm run build` succeeds
- [ ] All tests pass
- [ ] Migration SQL reviewed (if applicable)
- [ ] Railway environment variables confirmed
- [ ] Rollback plan documented
- [ ] Health dashboard shows expected state post-deploy

---

## Section 9 — Continuous Improvement

### 9.1 Review Cadence

| Artifact | Review Frequency |
|----------|-----------------|
| This document | On each major version milestone or when a Level D decision changes governance |
| ADRs | On supersession or when the decision context changes |
| Go-live gates | After every 100 production kernel events |
| Risk matrix | After any production incident |
| Definition of Done | On each stage transition |

### 9.2 Governance Amendments

Amendments to this document require:
1. CTO explicitly states the change in the conversation
2. The change is recorded in `DECISION_LOG.md`
3. The version number in this document is incremented
4. The effective date is updated

Minor clarifications (non-normative) do not require a version bump.

### 9.3 Feedback Loop

After each significant stage (Stage 2.5 complete, Stage 3 approved, etc.):
- Review what approval levels were correctly calibrated
- Review what took longer than expected due to governance overhead
- Adjust Level A/B boundaries if governance is slowing legitimate low-risk work

---

## Section 10 — Auto-Progression Rule

The following is the machine-readable rule for Claude's autonomous operation:

```
IF change_level == 'A':
  execute immediately, no pause
  
IF change_level == 'B':
  execute immediately
  append Level B report to response
  
IF change_level == 'C':
  STOP
  describe the action and why it is Level C
  provide rollback plan
  wait for explicit user approval
  
IF change_level == 'D':
  STOP
  describe the action and why it is Level D
  provide full impact assessment including:
    - what production systems are affected
    - what data is at risk
    - what the rollback path is
    - what verification is needed post-execution
  wait for explicit user approval
  NEVER self-approve
```

### Stage 3 Specific Rule

> Stage 3 (making the Core State Kernel the production read authority for `/api/v1/state` and all downstream consumers) is **always Level D**, regardless of go-live gate metrics, consistency scores, or any other automated check. The go-live gates are advisory inputs to the human decision — they do not constitute approval.

---

*This document is part of the ITOS Constitution. It governs all engineering activity within the project and supersedes any prior informal confirmation workflows.*
