# ITOS Changelog

All notable changes to ITOS are documented here.

Format: `## [version] — YYYY-MM-DD`  
Types: `Added`, `Changed`, `Fixed`, `Removed`, `Security`

---

## [1.11.0] — 2026-06-25 (Phase 10 — Backtesting & Walk-Forward Validation)

### Added
- `src/lib/backtestEngine.ts` — Pure, deterministic backtest engine extending the replay engine. Adds round-trip fees and slippage to every closed position (configurable per-side: default 0.1% fees + 0.05% slippage). Exports 10 functions: `createBacktestSession`, `stepBacktestSession`, `runBacktestSession`, `pauseBacktestSession`, `resetBacktestSession`, `computeSharpeRatio`, `computeCalmarRatio`, `computeProfitFactor`, `partitionWalkForwardWindows`, `computeRobustnessScore`, `runWalkForward`. `DEFAULT_BACKTEST_CONFIG` covers all configurable parameters. [Level A]
- `src/lib/__tests__/backtestEngine.test.ts` — 45 tests covering: createBacktestSession (5), stepBacktestSession fee accounting (4), runBacktestSession (5), computeSharpeRatio (5), computeCalmarRatio (3), computeProfitFactor (3), partitionWalkForwardWindows (5), computeRobustnessScore (5), pauseBacktestSession (2), resetBacktestSession (1), runWalkForward (5), fees integration (2). All 45 pass. [Level A]
- `src/services/backtest/BacktestService.ts` — In-memory backtest session store. Methods: `startSession`, `stepSession`, `runSession`, `pauseSession`, `resetSession`, `getSessionById`, `getSessions`, `runWalkForwardAnalysis`. Same isolation pattern as ReplayService — never touches live services. [Level B]
- `GET /api/v1/backtest` — List all backtest session summaries (backtestId, symbol, status, netR, sharpeRatio, winRate, overallScore). [Level B]
- `POST /api/v1/backtest/start` — Create backtest session with OHLCV candle payload + optional `BacktestConfig` overrides. [Level B]
- `POST /api/v1/backtest/step` — Advance one candle with fee-adjusted metrics update. [Level B]
- `POST /api/v1/backtest/run` — Run to completion or optional maxSteps. [Level B]
- `POST /api/v1/backtest/pause` — Pause a running backtest. [Level B]
- `POST /api/v1/backtest/reset` — Reset session to IDLE (config + candles preserved). [Level B]
- `POST /api/v1/backtest/walk-forward` — Run full walk-forward analysis: partition candles into N windows, run IS+OOS backtests, compute per-window robustness score, return `WalkForwardResult`. [Level B]
- `GET /api/v1/backtest/[id]` — Full BacktestSession detail. [Level B]
- `src/hooks/useBacktestFeed.ts` — React hook polling `/api/v1/backtest` every 15s. Exposes `{ sessions, activeSession, wfResult, loading, error, startBacktest, runBacktest, stepBacktest, resetBacktest, runWalkForward, selectSession, refresh }`. [Level A]
- `src/components/dashboard/BacktestPanel.tsx` — Dashboard panel with: status badge, symbol/timeframe, progress bar, Net R / Max DD / Sharpe / Calmar grid, Profit Factor / Win Rate / Fees row, fee config display, quality score bars, walk-forward result section (IS vs OOS aggregate R, per-window robustness bars), Step/Run/Reset controls, WF toggle button, "Demo Run" (60 BTC candles) and "Demo WF" (3-window walk-forward) buttons, sessions history list (up to 3). [Level A]

### Changed
- `src/types/index.ts` — Added 13 backtest + walk-forward types: `BacktestConfig`, `BacktestMetrics`, `BacktestSession`, `WalkForwardConfig`, `WalkForwardWindow`, `WalkForwardWindowResult`, `WalkForwardResult`, `BacktestStartRequest`, `BacktestRunRequest`, `BacktestStepRequest`, `BacktestResetRequest`, `BacktestSessionSummary`, `BacktestApiResponse`, `BacktestListApiResponse`, `WalkForwardApiResponse`. `BacktestMetrics extends ReplayMetrics`; `BacktestSession extends Omit<ReplaySession, 'metrics'>`. [Level A]
- `src/app/page.tsx` — Added `BacktestPanel` to desktop 3rd column (after ReplayPanel, before RiskPanel) and mobile risk tab (between ReplayPanel and RiskPanel). [Level A]

### Architecture
- Fee model: round-trip cost in R = `position.finalR × 2 × (fees + slippage) / RISK_PCT`. At default config, each 1R trade costs 0.30R in fees+slippage
- Walk-forward partitioning: N equal windows; window i has `inSampleRatio` fraction as IS and the remainder as OOS. Minimum 10 candles per window
- Robustness score (0–100): both positive → `min(100, OOS_netR/IS_netR × 100)`; IS positive + OOS negative → 10 (overfit); both negative → 30; IS negative + OOS positive → 70 (unexpected improvement)
- `BacktestSession` is structurally a `ReplaySession` (BacktestMetrics extends ReplayMetrics), so all existing replay code remains compatible
- All 306 tests pass; production build confirmed with all 8 new routes compiled

[Level B Report]
- New: `src/lib/backtestEngine.ts`
- New: `src/lib/__tests__/backtestEngine.test.ts` (45/45 passing)
- New: `src/services/backtest/BacktestService.ts`
- New: `src/app/api/v1/backtest/route.ts`
- New: `src/app/api/v1/backtest/start/route.ts`
- New: `src/app/api/v1/backtest/step/route.ts`
- New: `src/app/api/v1/backtest/run/route.ts`
- New: `src/app/api/v1/backtest/pause/route.ts`
- New: `src/app/api/v1/backtest/reset/route.ts`
- New: `src/app/api/v1/backtest/walk-forward/route.ts`
- New: `src/app/api/v1/backtest/[id]/route.ts`
- New: `src/hooks/useBacktestFeed.ts`
- New: `src/components/dashboard/BacktestPanel.tsx`
- Modified: `src/types/index.ts` — 15 new types
- Modified: `src/app/page.tsx` — BacktestPanel wired into desktop + mobile risk tab
- Why: Phase 10 Backtesting & Walk-Forward Validation — evaluate ITOS strategy performance on historical data with realistic transaction costs, and validate that IS performance generalizes OOS
- Impact: Any historical OHLCV array can now be backtested with configurable fees/slippage; walk-forward analysis quantifies overfitting risk via per-window robustness scores
- Rollback: remove BacktestPanel from page.tsx (Level A — 1 import + 2 placements)

### Remaining gaps before Phase 11
1. **Real pipeline integration** — BacktestService uses same simulated decision/risk logic as ReplayService. Wiring the real Evidence→Decision→Risk pipeline (with isolated contexts) remains Phase 11 scope
2. **Historical OHLCV data loader** — No built-in historical data source; backtests require caller-supplied candles. TradingView MCP integration (`data_get_ohlcv`) can supply production-quality data
3. **Parameter optimization** — Walk-forward analysis evaluates fixed parameters; no grid-search or optimization loop
4. **Monte Carlo simulation** — No statistical confidence intervals on backtest results
5. **Multi-symbol backtests** — Sessions are single-symbol; portfolio-level backtesting is not yet supported
6. **Persistence** — Backtest sessions reset on server restart; no PostgreSQL storage
7. **Equity curve visualization** — BacktestPanel shows aggregate metrics but no chart of the running equity curve

---

## [1.10.0] — 2026-06-25 (Phase 9 — Replay & Simulation Engine)

### Added
- `src/lib/replayEngine.ts` — Deterministic, pure, no-side-effect candle-by-candle replay engine. 5-state machine (IDLE→RUNNING→PAUSED/COMPLETED/FAILED). Exports 13 functions: `createReplaySession`, `stepReplaySession`, `runReplaySession`, `pauseReplaySession`, `resetReplaySession`, `validateReplayCandleOrder`, `preventLookAheadBias`, `computeReplayMetrics`, `computeDecisionQualityScore`, `computeRiskQualityScore`, `computeMemoryQualityScore`, `computeLifecycleQualityScore`, `computeOpportunityCost`. Look-ahead bias enforcement on every step. Simulated decision (5-candle momentum), simulated risk (confidence tier), simulated TP/SL position tracking. [Level A]
- `src/lib/__tests__/replayEngine.test.ts` — 49 tests (TC-RE01–TC-RE38+variants) covering: create session (6), candle validation (5), look-ahead prevention (3), step behavior (7), TP/SL simulation (3), run behavior (5), pause/resume (3), reset (3), metrics (3), opportunity cost (2), quality scores (6), status transitions (3). All 49 pass. [Level A]
- `src/services/replay/ReplayService.ts` — In-memory session store. Thin orchestration layer around pure engine. Methods: `startSession`, `stepSession`, `runSession`, `pauseSession`, `resetSession`, `getSessionById`, `getSessions`. Isolation: never calls live DecisionService, RiskOfficeService, PaperPositionService, or TradeMemoryService — replay runs fully contained. [Level B]
- `GET /api/v1/replay` — List all session summaries (replayId, symbol, status, progress, totalR, winRate, overallScore). [Level B]
- `POST /api/v1/replay/start` — Create a new session with OHLCV candle payload. [Level B]
- `POST /api/v1/replay/step` — Advance one candle. [Level B]
- `POST /api/v1/replay/run` — Run to completion or optional maxSteps. [Level B]
- `POST /api/v1/replay/pause` — Pause a running session. [Level B]
- `POST /api/v1/replay/reset` — Reset session to IDLE (candles preserved). [Level B]
- `GET /api/v1/replay/[id]` — Full session detail including all decisions, simulated positions, metrics, quality scores, and audit trail. [Level B]
- `src/hooks/useReplayFeed.ts` — React hook polling `/api/v1/replay` every 10s. Exposes `{ sessions, activeSession, loading, error, startReplay, stepReplay, runReplay, pauseReplay, resetReplay, selectSession, refresh }`. [Level A]
- `src/components/dashboard/ReplayPanel.tsx` — Dashboard panel with: status badge, symbol/timeframe, progress bar, Total R / Max Drawdown / Expectancy / Opportunity Cost grid, TP/SL/win-rate row, four quality score bars with color gradient, last decision + veto, Start/Step/Run/Pause/Reset controls, session history list, "Demo Run" button (generates 30 BTC candles client-side). [Level A]

### Changed
- `src/types/index.ts` — Added 17 replay types: `ReplayStatus`, `ReplayCandle`, `ReplayDecisionRecord`, `ReplaySimulatedPosition`, `ReplayAuditEvent`, `ReplayMetrics`, `ReplayQualityScores`, `ReplaySession`, `ReplaySessionSummary`, `ReplayStartRequest`, `ReplayStepRequest`, `ReplayRunRequest`, `ReplayPauseRequest`, `ReplayResetRequest`, `ReplayApiResponse`, `ReplayListApiResponse`, `ReplayMemoryContext`, `ReplayRiskContext`, `ReplayDecisionContext`. [Level A]
- `src/app/page.tsx` — Added `ReplayPanel` to desktop 3rd column (after PaperPositionsPanel, before RiskPanel) and mobile risk tab (between PaperPositionsPanel and RiskPanel). [Level A]

### Architecture
- Replay engine is fully isolated — it has its own simulated decision, risk, and position contexts; it never reads from or writes to live services
- Look-ahead bias is enforced by `preventLookAheadBias()` on every `stepReplaySession` call — candles[0..currentIndex] only
- Decision simulation: 5-candle pattern (higher highs + bullish body + momentum > 0.1% → LONG; lower lows + bearish body + momentum < -0.1% → SHORT)
- Risk simulation: mirrors production confidence tiers (≥95→1R, ≥90→0.75R, ≥80→0.5R, else 0.25R); blocks at < 70 confidence or > MAX_CONCURRENT open positions
- Position simulation: 1% risk distance, 2R TP (2% target); TP checked before SL on same candle (optimistic convention)
- `computeOpportunityCost` scans post-decision candles to measure R lost from blocked/missed LONG/SHORT signals
- Quality scores: Decision (0–100 from TP/SL ratio), Risk (40–100 from approved TP rate), Memory (50–90 from avg confidence calibration), Lifecycle (100 minus open-at-end penalty)
- Overall score: weighted average (Decision×0.35 + Risk×0.30 + Memory×0.20 + Lifecycle×0.15)

[Level B Report]
- New: `src/lib/replayEngine.ts`
- New: `src/lib/__tests__/replayEngine.test.ts` (49/49 passing)
- New: `src/services/replay/ReplayService.ts`
- New: `src/app/api/v1/replay/route.ts`
- New: `src/app/api/v1/replay/start/route.ts`
- New: `src/app/api/v1/replay/step/route.ts`
- New: `src/app/api/v1/replay/run/route.ts`
- New: `src/app/api/v1/replay/pause/route.ts`
- New: `src/app/api/v1/replay/reset/route.ts`
- New: `src/app/api/v1/replay/[id]/route.ts`
- New: `src/hooks/useReplayFeed.ts`
- New: `src/components/dashboard/ReplayPanel.tsx`
- Modified: `src/types/index.ts` — 17 new types
- Modified: `src/app/page.tsx` — ReplayPanel wired into desktop + mobile risk tab
- Why: Phase 9 Replay Engine — deterministic simulation validates ITOS decision pipeline without look-ahead bias
- Impact: Any OHLCV candle array can now be replayed through simulated Evidence→Decision→Risk→Lifecycle; quality scores measure pipeline effectiveness
- Rollback: remove ReplayPanel from page.tsx (Level A — 1 import + 2 placements)

### Remaining gaps before Phase 10 (Backtesting & Walk-Forward Validation)
1. **Real pipeline integration** — `ReplayService` currently uses simulated decision/risk logic. Phase 10 should allow replay to call the real `EvidenceService` → `DecisionService` → `RiskOfficeService` with isolated (non-mutating) contexts
2. **Historical OHLCV data source** — Replay accepts any candle array but has no built-in historical data loader. Phase 10 should wire `MarketDataService` to supply backtesting candles
3. **Multi-session management** — UI currently shows most recent session; Phase 10 should add session comparison and walk-forward window slicing
4. **Slippage and fees** — Simulated positions assume zero slippage. Phase 10 should accept configurable slippage/fee parameters
5. **Multiple timeframe evidence** — Decision simulation uses single-timeframe momentum only. Full Evidence Engine integration would improve decision fidelity
6. **Position sizing from real Risk Office** — Simulated risk uses fixed 4-tier confidence-to-R table; Phase 10 should optionally use live `RiskBudget` configuration
7. **Persistence** — Replay sessions reset on server restart. Phase 10 could optionally persist completed sessions to PostgreSQL for long-run backtest storage

---

## [1.9.0] — 2026-06-25 (Phase 8 — Trade Lifecycle & Paper Position Ledger)

### Added
- `src/lib/tradeLifecycleEngine.ts` — Pure, deterministic paper-trading lifecycle engine. 8-state machine (PENDING_APPROVAL → APPROVED → OPEN → PARTIAL → CLOSED; terminal: REJECTED/CANCELLED/ERROR). Exports: `createPaperPosition`, `approvePaperPosition`, `openPaperPosition`, `updatePaperPositionMark`, `partialClosePaperPosition`, `closePaperPosition`, `cancelPaperPosition`, `rejectPaperPosition`, `validatePositionTransition`, `isTerminalStatus`, `computePositionPnL`, `computeOpenRiskR`, `computeLifecycleState`, `computePositionDuration`. LONG/SHORT R calculation with fees + slippage deduction. Immutable audit trail appended on every state transition. [Level A]
- `src/lib/__tests__/tradeLifecycleEngine.test.ts` — 40 tests (TC-LS01–40) covering: create/validate (6), LONG P&L (3), SHORT P&L (2), close reasons (7), computePositionPnL (2), validatePositionTransition (7), computeOpenRiskR (2), computePositionDuration (2), computeLifecycleState (1), partialClose (2), audit trail (3), mark edge cases (3). All 40 pass. [Level A]
- `src/services/trading/PaperPositionService.ts` — In-memory paper position ledger. Enforces `maxConcurrentPositions` and `maxSameSymbolPositions` from Risk Office budget. Methods: `openPositionFromDecision`, `markPosition`, `closePosition`, `cancelPosition`, `getOpenPositions`, `getClosedPositions`, `getPositionById`, `getLedgerSummary`, `getPortfolioExposure`. Calls `riskOfficeService.invalidate()` after every state mutation. Writes `PaperPositionOpened`/`PaperPositionClosed`/`PaperPositionCancelled` events to 'trade' kernel domain (fire-and-forget). [Level B]
- `GET /api/v1/paper/positions` — Open positions array, closed positions array, `PaperLedgerSummary`. [Level B]
- `GET /api/v1/paper/positions/[id]` — Full position detail including audit trail. [Level B]
- `POST /api/v1/paper/close` — Controlled paper close: `{ positionId, reason, exitPrice? }` → `PaperCloseResponse`. [Level B]
- `src/hooks/usePaperPositionsFeed.ts` — React hook polling `/api/v1/paper/positions` every 15s. Exposes `{ data, loading, error, updatedAt, refresh }`. [Level A]
- `src/components/dashboard/PaperPositionsPanel.tsx` — Dashboard panel: open count, unrealized/realized R totals, win rate summary row; active positions list (direction arrow, symbol, unrealized R, status badge); recent closed positions (last 5, realized R); win/loss stats footer. [Level A]

### Changed
- `src/types/index.ts` — Added 10 paper-trading types: `TradeDirection`, `PaperPositionStatus`, `PaperCloseReason`, `PositionAuditEvent`, `PaperPosition`, `PaperLedgerSummary`, `CreatePaperPositionInput`, `OpenPositionSignal`, `PaperPositionResult`, `PaperPositionApiResponse`, `PaperCloseRequest`, `PaperCloseResponse`. [Level A]
- `src/app/page.tsx` — Added `PaperPositionsPanel` to desktop 3rd column (after RiskOfficePanel, before RiskPanel) and mobile risk tab (between RiskOfficePanel and RiskPanel). [Level A]

### Architecture
- Paper trading layer sits after Risk Office in the decision flow: Risk Office approves → `openPositionFromDecision` creates lifecycle position
- No database persistence in this phase — in-memory only; ledger is reset on server restart (intentional for paper trading)
- No real-money execution; no broker/exchange integration; no exchange keys — pure simulation
- `PaperPositionService` enforces Risk Office budget limits (concurrent positions, same-symbol limits) at open time
- Risk Office cache is invalidated after every paper position event so risk metrics stay current
- Partial close (OPEN → PARTIAL) records 50% of the exit R as partial contribution; full close adds remaining gross R on top
- P&L formula: LONG R = (exit − entry) / |entry − sl|; SHORT R = (entry − exit) / |entry − sl|; fees + slippage subtracted from gross R at close
- Audit trail is append-only on `PaperPosition.auditTrail` — every state transition adds `{ts, event, details}`

[Level B Report]
- New: `src/lib/tradeLifecycleEngine.ts`
- New: `src/lib/__tests__/tradeLifecycleEngine.test.ts` (40/40 passing)
- New: `src/services/trading/PaperPositionService.ts`
- New: `src/app/api/v1/paper/positions/route.ts`
- New: `src/app/api/v1/paper/positions/[id]/route.ts`
- New: `src/app/api/v1/paper/close/route.ts`
- New: `src/hooks/usePaperPositionsFeed.ts`
- New: `src/components/dashboard/PaperPositionsPanel.tsx`
- Modified: `src/types/index.ts` — 12 new types
- Modified: `src/app/page.tsx` — PaperPositionsPanel wired into desktop + mobile risk tab
- Why: Phase 8 Trade Lifecycle — simulated paper-trading position tracking with full audit trail and P&L
- Impact: Dashboard now shows open paper positions, realized/unrealized R, win rate; Risk Office invalidated on every position event
- Rollback: remove PaperPositionsPanel from page.tsx (Level A — 1 import + 2 placements)

---

## [1.8.0] — 2026-06-25 (Phase 7 — Institutional Risk Office)

### Added
- `src/lib/riskOfficeEngine.ts` — Pure, deterministic Risk Office computation: `computePortfolioMetrics`, `computeRiskCooldown`, `computeRiskOffice`. Enforces 5 risk states (NORMAL/CAUTION/REDUCE/BLOCK/EMERGENCY_STOP), confidence-tiered position sizing (0.25/0.50/0.75/1.00R), memory edge multiplier, and 15 kill switch / veto conditions. [Level A]
- `src/lib/__tests__/riskOfficeEngine.test.ts` — 33 tests covering all paths: PM-07 portfolio metrics, CD-05 cooldown, RO-21 risk office decisions (approval, reduction, all block/emergency conditions). All 33 pass. [Level A]
- `src/services/risk/RiskOfficeService.ts` — Orchestrates portfolio metrics, cooldown, decision, similarity, kernel + provider health into `RiskOfficeResult`. 15s cache, kernel audit write (`RiskOfficeComputed`), env-var-configurable budget (`RO_*` prefix). [Level B]
- `GET /api/v1/risk` — Full `RiskOfficeResult`: decision, risk state, position size, metrics, budget, vetos, kill switch, approval chain. [Level B]
- `GET /api/v1/risk/status` — Lightweight status: decision, riskState, killSwitchActive, finalR, cooldownActive. [Level B]
- `GET /api/v1/risk/capital` — Portfolio metrics + drawdown + budget + cooldown. [Level B]
- `GET /api/v1/risk/governance` — Active budget config + DEFAULT_RISK_BUDGET reference. [Level B]
- `src/hooks/useRiskOfficeFeed.ts` — React hook polling `/api/v1/risk` every 15s. [Level A]
- `src/components/dashboard/RiskOfficePanel.tsx` — Risk Office dashboard panel: risk state + decision badges, kill switch banner, approved/reduced/blocked display with finalR, position size breakdown (base × mem × state), capital budget bars (daily/weekly/monthly), streak counter, cooldown countdown, veto list, approval chain, footer P&L stats. [Level A]

### Changed
- `src/types/index.ts` — Added 8 Risk Office types: `RiskOfficeState`, `RiskOfficeDecision`, `RiskBudget`, `PortfolioRiskMetrics`, `RiskOfficeCooldown`, `PositionSizeRecommendation`, `RiskVeto`, `RiskOfficeResult`. [Level A]
- `src/app/page.tsx` — Added `RiskOfficePanel` to desktop 3rd column (after DecisionCard, before RiskPanel) and mobile risk tab (above existing RiskPanel). [Level A]

### Architecture
- Risk Office is the final governance gate before trade lifecycle — Decision Intelligence feeds into Memory Intelligence feeds into Risk Office
- Kill switch triggers: kernel down (EMERGENCY), provider down, daily/weekly/monthly loss limits, consecutive losses
- EMERGENCY_STOP requires 2+ simultaneous hard-block conditions or any EMERGENCY-severity veto
- Position sizing is a three-stage multiplier chain: confidence tier × memory edge × risk state
- Budget fully configurable via env vars (`RO_MAX_DAILY_LOSS_R`, `RO_MAX_CONSEC_LOSSES`, etc.) — defaults are hardcoded safe values
- `RiskOfficeComputed` written to 'risk' kernel domain as audit record; default case ignores it (pure audit trail)
- Memory edge multiplier: +edge >20 = 1.0×, neutral = 0.9×, negative = 0.75× — advisory, not directive

[Level B Report]
- New: `src/lib/riskOfficeEngine.ts`
- New: `src/lib/__tests__/riskOfficeEngine.test.ts` (33/33 passing)
- New: `src/services/risk/RiskOfficeService.ts`
- New: `src/app/api/v1/risk/route.ts`
- New: `src/app/api/v1/risk/status/route.ts`
- New: `src/app/api/v1/risk/capital/route.ts`
- New: `src/app/api/v1/risk/governance/route.ts`
- New: `src/hooks/useRiskOfficeFeed.ts`
- New: `src/components/dashboard/RiskOfficePanel.tsx`
- Modified: `src/types/index.ts` — 8 new types
- Modified: `src/app/page.tsx` — RiskOfficePanel wired into desktop + mobile risk tab
- Why: Phase 7 Institutional Risk Office — capital protection before any trade lifecycle event
- Impact: Dashboard now shows live risk state, position size approval, portfolio drawdown, kill switch status
- Rollback: remove RiskOfficePanel from page.tsx (Level A — 1 import + 2 placements)

---

## [1.7.0] — 2026-06-25 (Phase 6 — Memory Intelligence Layer)

### Added
- `src/lib/memory/memoryFingerprint.ts` — Deterministic setup fingerprint from kernel state: 14 categorical fields + SHA-1 hash of canonical JSON. Classifies trend, EMA alignment, HTF/LTF bias, liquidity, acceptance, momentum, RR bucket, grade bucket, risk bucket, direction. [Level A]
- `src/lib/memory/memoryDNA.ts` — 14-token DNA string from fingerprint: `TREND_X · EMA_X · HTF_X · LTF_X · LIQ_X · ACC_X · RET_X · MOM_X · VOL_X · RR_X · GRADE_X · RISK_X · DIR_X · TF_X`. Includes DNA hash (SHA-1, 12-char hex, order-invariant). [Level A]
- `src/lib/memory/similarityEngine.ts` — Weighted token similarity: direction(20), trend(18), grade(15), liquidity(14), htfBias(10), momentum(9), acceptance(7), ema(7). Partial credit for adjacent ordinals. Returns 0–100 score + loser-pattern warnings. [Level A]
- `src/lib/memory/confidenceCalibrator.ts` — Confidence calibration: `netEdge = clamp((winSim−lossSim)/100, −1, 1)`, `multiplier = 1 + netEdge × 0.05`, `calibrated = round(base × multiplier)`. ±5% max adjustment. [Level A]
- `src/lib/memory/experienceEngine.ts` — 5 deterministic lesson generators: direction-regime conflicts, grade performance, momentum quality, liquidity edge, range acceptance edge. Min 3 samples per lesson, sorted by strength. [Level A]
- `src/lib/memory/__tests__/memoryFingerprint.test.ts` — 8 tests. [Level A]
- `src/lib/memory/__tests__/memoryDNA.test.ts` — 11 tests. [Level A]
- `src/lib/memory/__tests__/similarityEngine.test.ts` — 9 tests. [Level A]
- `src/lib/memory/__tests__/confidenceCalibrator.test.ts` — 11 tests. [Level A]
- `src/services/memory/TradeMemoryService.ts` — In-memory Map keyed by tradeId. Cold-start replay from `TradeMemoryRecorded` kernel events via Prisma. Records trade on close (prices → resultR, no reliance on kernel.trade.resultR). Exposes getSummary, getSimilarity, getExperience, getCurrentFingerprint, getAll. [Level B]
- `GET /api/v1/memory` — Aggregate response: summary + fingerprint + similarity + top 5 experience lessons. Single fetch for dashboard. [Level B]
- `GET /api/v1/memory/similarity` — Detailed similarity analysis with full queryDNA. [Level B]
- `GET /api/v1/memory/experience` — Full lesson set from experience engine. [Level B]
- `GET /api/v1/memory/fingerprint` — Current setup fingerprint + DNA string from kernel state. [Level B]
- `src/hooks/useMemoryFeed.ts` — React hook polling `/api/v1/memory` every 30s. [Level A]
- `src/components/dashboard/MemoryIntelligenceCard.tsx` — Experience level badge, win/loss similarity bars, edge %, calibrated confidence (≥5 trades), nearest historical winner, active lessons (top 3) with action badges, similarity warnings, store stats footer. [Level A]

### Changed
- `src/types/index.ts` — Added `TradeOutcome`, `ExperienceLevel`, `SetupFingerprintData`, `TradeMemoryRecord`, `SimilarityMatch`, `SimilarityResult`, `ExperienceLesson`, `MemorySummary` types. [Level A]
- `src/services/lifecycle/LifecycleService.ts` — On SL_HIT / CLOSE_TRADE: `void tradeMemoryService.record(signal, correlationId)` fire-and-forget. [Level A]
- `src/app/page.tsx` — Added `MemoryIntelligenceCard` to desktop 3rd column (top, above DecisionCard) and mobile scanner tab (top, above DecisionCard). [Level A]

### Architecture
- No new DB schema — `TradeMemoryRecorded` events written to existing `kernelEvent` table; replayed at cold start
- `TradeMemoryRecorded` written to 'memory' kernel domain; reducers ignore unknown event types (pure audit trail)
- Outcome computed from prices at close time (entry, sl, tp1/2/3) not from kernel.trade.resultR — avoids timing race
- DNA is order-invariant (SHA-1 of sorted tokens) — same setup always produces same hash regardless of token generation order
- Confidence calibration capped at ±5% — memory is advisory, not directive; never overrides decision engine
- O(n) similarity search acceptable <1000 trades; index if store grows beyond that

[Level B Report]
- New: `src/lib/memory/memoryFingerprint.ts`
- New: `src/lib/memory/memoryDNA.ts`
- New: `src/lib/memory/similarityEngine.ts`
- New: `src/lib/memory/confidenceCalibrator.ts`
- New: `src/lib/memory/experienceEngine.ts`
- New: `src/lib/memory/__tests__/memoryFingerprint.test.ts` (8/8 passing)
- New: `src/lib/memory/__tests__/memoryDNA.test.ts` (11/11 passing)
- New: `src/lib/memory/__tests__/similarityEngine.test.ts` (9/9 passing)
- New: `src/lib/memory/__tests__/confidenceCalibrator.test.ts` (11/11 passing)
- New: `src/services/memory/TradeMemoryService.ts`
- New: `src/app/api/v1/memory/route.ts`
- New: `src/app/api/v1/memory/similarity/route.ts`
- New: `src/app/api/v1/memory/experience/route.ts`
- New: `src/app/api/v1/memory/fingerprint/route.ts`
- New: `src/hooks/useMemoryFeed.ts`
- New: `src/components/dashboard/MemoryIntelligenceCard.tsx`
- Modified: `src/types/index.ts` — 8 new types added
- Modified: `src/services/lifecycle/LifecycleService.ts` — memory recording on trade close
- Modified: `src/app/page.tsx` — MemoryIntelligenceCard wired into desktop + mobile
- Why: Phase 6 Memory Intelligence Layer — institutional deterministic memory for ITOS
- Impact: Dashboard now shows live experience level, similarity scores, calibrated confidence, active lessons, nearest historical trade match
- Rollback: remove MemoryIntelligenceCard from page.tsx (Level A); tradeMemoryService.record() is fire-and-forget and can be removed without side effects

---

## [1.6.0] — 2026-06-25 (Phase 5 — Decision Intelligence Layer)

### Added
- `src/lib/decisionEngine.ts` — Pure stateless decision computation: 8 weighted categories (Trend:25, Liquidity:20, Structure:15, Momentum:10, Acceptance:10, Volume:5 n/a, Risk:10, Memory:5), 10 mandatory gates (G1–G10), blended confidence formula (60% weighted score + 40% evidence confidence). [Level A]
- `src/lib/__tests__/decisionEngine.test.ts` — 12 Vitest test cases covering all outcomes: LONG, SHORT, NO_TRADE×3, WAIT×4, HOLD, REDUCE_POSITION, READY. All 12 pass. [Level A]
- `src/services/decision/DecisionService.ts` — In-memory cache (30s TTL), reads 6 kernel domains (evidence, strategy, memory, provider, risk, trade), writes `DecisionComputed` audit event to 'risk' domain (fire-and-forget). [Level B]
- `GET /api/v1/decision` — Returns current decision with outcome, confidence, weighted score, gate results, supporting/opposing factors, and next action. Authority: `kernel-derived`. [Level B]
- `src/hooks/useDecisionFeed.ts` — React hook polling `/api/v1/decision` every 10s. [Level A]
- `src/components/dashboard/DecisionCard.tsx` — Decision card: outcome badge, confidence bar, weighted score, top supporting/opposing lists, blocking reason, next action, gate strip. [Level A]

### Changed
- `src/types/index.ts` — Added `DecisionOutcome` union type (LONG, SHORT, WAIT, NO_TRADE, HOLD, REDUCE_POSITION, READY, EXIT), `WeightedEvidenceItem`, `DecisionGateResult`, `DecisionResult` interfaces. [Level A]
- `src/app/page.tsx` — Added `DecisionCard` to desktop 3rd column (above RiskPanel) and mobile scanner tab (above ScannerPanel). [Level A]

### Architecture
- Decision is computed from kernel state on every request — no new kernel domain added
- Cache TTL 30s prevents redundant computation; `invalidate()` available for future push-based invalidation
- `DecisionComputed` audit event written to 'risk' domain; unknown event types are silently ignored by all domain reducers (no state change, pure audit trail)
- Volume category excluded from denominator (MAX_SCORE=95) pending market volume data in kernel
- Grade is ceiling: signal grade D blocks entry before weighted scoring

[Level B Report]
- New: `src/lib/decisionEngine.ts`
- New: `src/lib/__tests__/decisionEngine.test.ts` (12/12 passing)
- New: `src/services/decision/DecisionService.ts`
- New: `src/app/api/v1/decision/route.ts`
- New: `src/hooks/useDecisionFeed.ts`
- New: `src/components/dashboard/DecisionCard.tsx`
- Modified: `src/types/index.ts` — 4 new types added
- Modified: `src/app/page.tsx` — DecisionCard wired into desktop + mobile
- Why: Phase 5 Decision Intelligence Layer per governance auto-progression
- Impact: Dashboard now shows live LONG/SHORT/WAIT/HOLD/NO_TRADE decision with gate audit trail
- Rollback: remove DecisionCard from page.tsx (Level A — one line per layout)

---

## [1.5.0] — 2026-06-25 (Phase 4 — Evidence Engine Foundation)

### Added
- `src/lib/evidenceEngine.ts` — Pure 5-category evidence evaluation (Market Structure, Range Context, Liquidity, Risk/Reward, Regime Alignment). Confidence scoring per constitution/03-Evidence-Engine.md. [Level B]
- `src/services/evidence/EvidenceService.ts` — Orchestrates evaluation + emits `EvidenceUpdated` kernel event (fire-and-forget). [Level B]
- `GET /api/v1/evidence` — Returns current evidence state from kernel's evidence domain. [Level B]

### Changed
- `POST /api/v1/webhook/tradingview` — On `SETUP_DETECTED`, fires `evidenceService.evaluate()` (fire-and-forget, never blocks response). [Level A]

### Architecture
- Evidence evaluation is read from kernel via `kernel.readState('evidence')` — authoritative after Stage 3 promotion
- Evidence is computed from signal fields (grade, rr, sl, tp1/2/3, note, thesisType) + kernel strategy state (regime, ema20/50, htfBias/ltfBias) + kernel memory state (rangeMemory)
- Grade is never upgraded by engine (signal grade acts as ceiling, not floor)

[Level B Report]
- New: `src/lib/evidenceEngine.ts`
- New: `src/services/evidence/EvidenceService.ts`
- New: `src/app/api/v1/evidence/route.ts`
- Modified: webhook — evidence fire-and-forget on SETUP_DETECTED
- Why: Phase 4 Evidence Engine Foundation per governance auto-progression
- Impact: evidence domain in kernel now populated on every SETUP_DETECTED webhook
- Rollback: remove `evidenceService.evaluate()` call from webhook (Level A)

---

## [1.4.0] — 2026-06-25 (Phase 3.5 Stage 3 — Core State Kernel Go-Live)

### Added
- `src/lib/kernel/authorityConfig.ts` — `KERNEL_AUTHORITY` feature flag (default: kernel authoritative; `=false` = one-command rollback) [Level D]
- `src/lib/kernel/kernelStateAdapter.ts` — maps `KernelFullState` → `DashboardState` (kernel overlay on legacy base)
- `src/lib/kernel/kernelSeeder.ts` — seeds kernel from SystemState on cold boot (writes `KernelSystemSeeded` event)
- `docs/adr/ADR-001-core-state-kernel.md` — architecture decision record for kernel design
- `docs/adr/ADR-002-market-gateway.md` — market data provider abstraction decision
- `docs/adr/ADR-003-memory-engine.md` — memory engine deferral decision
- `docs/adr/ADR-004-replay-engine.md` — replay engine design decision
- `constitution/15-Engineering-Governance.md` — IEGF with Level A/B/C/D approval policy

### Changed
- `GET /api/v1/state` — now reads from Core State Kernel (kernel is single source of truth for mode, trade lifecycle, TP hits, antiReentry). Response includes `X-Authority: kernel` header. [Level D]
- `DashboardService.getState()` — kernel authority path with fallback to legacy on kernel failure (zero production risk)
- `kernel/singleton.ts` — seeds kernel from SystemState on cold boot (zero divergence on first deploy)
- Domain reducers (`LifecycleState`, `MemoryState`, `MarketState`, `StrategyState`) — handle `KernelSystemSeeded` event for cross-domain seeding

### Fixed
- 8 service files (`AuditService`, `HealthService`, `LifecycleService`, `MarketService`, `MemoryService`, `NotificationService`, `RiskService`, `StrategyService`) — fixed runtime crash: `@/lib/logger` → `@/core/logger` (`withContext` only exists on core logger)
- `EventStore.ts` — Prisma JSON payload type cast (`Prisma.InputJsonValue`)
- `marketData/engine.ts` — double-cast for Ticker type assertion

### Architecture
- **Kernel is now the single source of truth.** `SystemState` remains a write-compatible legacy layer (divergence monitor, compatibility for any service reading it directly). Legacy cleanup deferred to post-v1.0.
- **Rollback:** Set `KERNEL_AUTHORITY=false` on Railway env vars (Level C — takes effect on next deploy/restart). No code changes required. No data loss.
- **Cold-boot seeding:** On first Railway deployment with zero kernel events, the seeder reads current SystemState, active trade, cooldowns, range memory, and market snapshots — writes one `KernelSystemSeeded` event. All domain reducers apply their relevant fields from the event payload.
- **Kernel overlay pattern:** `adaptKernelState()` starts from the legacy base (market analysis, agents, confidence history, key levels) and overlays kernel-authoritative fields (mode, lifecycleIndex, trade, TP hits, antiReentry). Fields not in kernel fall through from the legacy base — zero data gaps.

### Rollback Plan
```
Command:        Set KERNEL_AUTHORITY=false in Railway env vars, trigger restart
Data impact:    None — kernel events preserved, SystemState unchanged
Time to rollback: ~2 minutes (Railway env var change + restart)
Dependencies:   None — kernel continues accumulating events in background
```

---

## [1.3.0] — 2026-06-25 (Phase 3.5 Remediation — R-01 to R-21)

### Added
- `src/core/config.ts` — centralized env-var config (replaces 14 scattered `process.env` calls)
- `src/core/correlationId.ts` — `cid_${timestamp}_${hex}` request tracing
- `src/core/errors.ts` — ITOS-1001 through ITOS-5002 typed error hierarchy
- `src/core/logger.ts` — enhanced logger with `withContext` factory; replaces `src/lib/logger.ts`
- `src/core/eventBus.ts` — `TypedEventBus` with 16 compile-safe typed events
- `src/lib/marketData/` — multi-provider abstraction layer (13 files)
  - 6 providers: Binance (P1), TradingView (P2, local only), BinanceWS (P3, stub), Bybit (P4), Coinbase (P5), Kraken (P6)
  - `ProviderManager` — health scoring, priority selection, automatic failover
  - `validator.ts` — 8 OHLCV validation checks (timestamp ordering, gaps, price deviation, volume anomaly, clock drift, stale data, OHLC sanity)
  - `engine.ts` — singleton with retry/fallback loop, max 3 attempts
  - `src/lib/marketData.ts` converted to compatibility shim (zero breaking changes)
- `src/services/` — 9 service modules wrapping existing lib/ modules
  - `DashboardService` — event-driven async state rebuild (decoupled from webhook hot path)
  - `AuditService` — append-only AuditLog writes (graceful no-op until R-10 migration runs)
  - `HealthService` — real DB ping + provider health aggregation
- Prisma schema: `AuditLog`, `SystemHealth`, `TradeLifecycle` models (3 new tables)
- `/api/v1/health/live` — always-200 liveness probe
- `/api/v1/health/ready` — real DB ping, returns 503 on database failure
- `/api/v1/health/providers` — live provider health scores and failover log
- `/api/v1/state` — versioned state endpoint via DashboardService
- `/api/v1/webhook/tradingview` — versioned webhook with correlation ID + audit log
- `src/lib/middleware/withAuth.ts` — HMAC-SHA256 webhook auth utility
- `constitution/05-Market-Data.md` — complete rewrite documenting provider architecture
- `constitution/09-Cloud-Native.md` — complete rewrite documenting service layer + event bus

### Changed
- `PROJECT_ROADMAP.md` — phase numbering corrected (Phase 2 = Market Data, Phase 3 = Cloud Native)
- Health check path in `railway.toml` updated to `/api/v1/health/ready` (real DB ping vs JSON state)
- `src/lib/marketData.ts` converted to compatibility shim — all existing callers unchanged

### Architecture
- **Webhook latency fix:** `DashboardService` now rebuilds dashboard state asynchronously via event bus. `tradeLifecycle.ts` no longer calls `buildDashboardState()` synchronously — eliminates 200–500ms Kraken API call from webhook response path.
- **Provider failover:** Active provider switches automatically on error; failover log retained (last 50 events).
- **Correlation IDs:** Thread through all log lines and the `X-Correlation-Id` response header.

---

## [1.0.0] — 2026-06-25 (Phase 1 — Master Constitution)

### Added
- Full cloud-native architecture on Railway (PostgreSQL + Next.js 14)
- Webhook ingestion: `POST /api/webhook/tradingview` with HMAC-safe secret validation
- 8 signal types: SETUP_DETECTED, ENTRY_TRIGGERED, TP1/2/3_HIT, SL_HIT, CLOSE_TRADE, BAR_CLOSE
- Trade lifecycle engine (`tradeLifecycle.ts`) — main signal orchestrator
- Risk engine (`riskEngine.ts`) — 4 gates: kill switch, grade, RR, confidence
- Memory engine (`memoryEngine.ts`) — SetupFingerprint, RangeMemory, Cooldown, webhook dedup
- Strategy engine (`strategyEngine.ts`) — EMA20/50, ATR14, swing detection, key levels, liquidity zones, ranges, confidence scoring
- Market data (`marketData.ts`) — Kraken REST API (OHLCV + live price), symbol mapping
- State builder (`stateBuilder.ts`) — assembles full DashboardState from DB + live Kraken data
- State cache — SystemState table (id=1), single-row JSON cache, polled every 10s
- Dashboard: Scanner, ActiveTrade, Risk, Review panels
- Key Levels card with distance % and strength indicators
- Synthetic agents: Trend, EMA Alignment, HTF Bias, Volatility
- Telegram notifications (`notificationService.ts`)
- Historical scan endpoint: `GET /api/cron/historical-scan`
- Market scan cron: `GET /api/cron/market-scan` (15-min background rebuild)
- 9 Prisma models: Trade, Setup, RangeMemory, SetupFingerprint, Cooldown, SystemState, MarketSnapshot, WebhookEvent, Notification
- Constitution documentation: 00-Vision through 14-Backtest
- MASTER_PROMPT.md, PROJECT_ROADMAP.md, CHANGELOG.md, DECISION_LOG.md

### Changed
- Replaced Binance market data with Kraken (Binance geo-blocked from Railway US)
- Replaced Bybit fallback with Kraken (Bybit also geo-blocked)
- Upgraded Next.js to ^14.2.35 (security: CVE-2025-55184, CVE-2025-67779)
- `useLiveFeed` polls `/api/state` instead of localhost:3001 proxy

### Removed
- `chrome-remote-interface` package (desktop CDP dependency removed from production)
- TradingView Desktop dependency from production path

### Security
- Webhook secret validated with `crypto.timingSafeEqual` (timing attack safe)
- Kill switch (`KILL_SWITCH=true`) halts all signal processing
- No secrets in source code — all via Railway Environment Variables

### Fixed
- tsconfig.tsbuildinfo tracked in git causing Docker mount error → removed from git, added to .gitignore
- DATABASE_URL not auto-injected from Railway PostgreSQL plugin → set explicitly via Railway Variables
- Dashboard showing ETHUSDT instead of BTCUSDT → hardcoded `symbol: 'BTCUSDT'` filter in stateBuilder
- Regime type union conflict between types/index.ts and strategyEngine.ts → extended union to include both value sets

---

## [0.1.0] — 2026-06-24

### Added
- Initial local development version
- TradingView Desktop MCP bridge (local use only)
- Basic dashboard with 4 panels
- Anti-overtrading system: fingerprint, range memory, cooldown
- Local dev server on port 3000–3002

---

*Older history available in git log.*
