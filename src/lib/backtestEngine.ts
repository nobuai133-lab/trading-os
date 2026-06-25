import type {
  ReplayCandle, ReplaySession, ReplaySimulatedPosition,
  BacktestConfig, BacktestMetrics, BacktestSession,
  WalkForwardConfig, WalkForwardWindow, WalkForwardWindowResult, WalkForwardResult,
} from '@/types';
import {
  createReplaySession,
  stepReplaySession,
  pauseReplaySession,
  resetReplaySession,
  computeReplayMetrics,
  validateReplayCandleOrder,
} from '@/lib/replayEngine';

// ── Constants ─────────────────────────────────────────────────────────────────

const RISK_PCT = 0.01;  // must match replayEngine constant

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  fees:                   0.001,    // 0.1% per side
  slippage:               0.0005,   // 0.05% per side
  initialCapital:         10_000,
  riskPerTrade:           0.01,
  maxConcurrentPositions: 2,
  minConfidence:          70,
};

// ── Fee helpers ───────────────────────────────────────────────────────────────

function roundHundredths(v: number): number {
  return Math.round(v * 100) / 100;
}

function costForPosition(pos: ReplaySimulatedPosition, config: BacktestConfig): {
  feeR: number;
  slipR: number;
} {
  // Round-trip cost per side: (fees + slippage) / RISK_PCT × finalR
  const feeR  = roundHundredths(pos.finalR * 2 * config.fees     / RISK_PCT);
  const slipR = roundHundredths(pos.finalR * 2 * config.slippage / RISK_PCT);
  return { feeR, slipR };
}

// Detect positions that closed in this step and apply fees to their realizedR
function applyFeesToStep(
  prevPositions: ReplaySimulatedPosition[],
  nextPositions: ReplaySimulatedPosition[],
  config:        BacktestConfig,
): {
  adjusted:      ReplaySimulatedPosition[];
  stepFeesR:     number;
  stepSlippageR: number;
} {
  const prevOpen = new Set(
    prevPositions.filter((p) => p.status === 'OPEN').map((p) => p.positionId),
  );

  let stepFeesR     = 0;
  let stepSlippageR = 0;

  const adjusted = nextPositions.map((p) => {
    const wasPrevOpen = prevOpen.has(p.positionId);
    const nowClosed   =
      p.status === 'CLOSED_TP' || p.status === 'CLOSED_SL' || p.status === 'OPEN_AT_END';
    if (!wasPrevOpen || !nowClosed) return p;

    const { feeR, slipR } = costForPosition(p, config);
    stepFeesR     += feeR;
    stepSlippageR += slipR;
    return { ...p, realizedR: roundHundredths(p.realizedR - feeR - slipR) };
  });

  return { adjusted, stepFeesR, stepSlippageR };
}

// ── Extended metric helpers ───────────────────────────────────────────────────

export function computeSharpeRatio(tradeReturns: number[]): number {
  if (tradeReturns.length < 2) return 0;
  const mean = tradeReturns.reduce((s, r) => s + r, 0) / tradeReturns.length;
  const variance =
    tradeReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / tradeReturns.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return roundHundredths(mean / std);
}

export function computeCalmarRatio(netR: number, maxDrawdownR: number): number {
  if (maxDrawdownR <= 0) return netR > 0 ? 999 : 0;
  return roundHundredths(netR / maxDrawdownR);
}

export function computeProfitFactor(
  winReturns:  number[],
  lossReturns: number[],
): number {
  const grossProfit = winReturns.reduce((s, r) => s + r, 0);
  const grossLoss   = Math.abs(lossReturns.reduce((s, r) => s + r, 0));
  if (grossLoss === 0) return grossProfit > 0 ? 999 : 0;
  return roundHundredths(grossProfit / grossLoss);
}

function buildBacktestMetrics(
  baseMetrics:    ReturnType<typeof computeReplayMetrics>,
  positions:      ReplaySimulatedPosition[],
  accFeesR:       number,
  accSlippageR:   number,
): BacktestMetrics {
  const netR = roundHundredths(baseMetrics.totalRealizedR - accFeesR - accSlippageR);

  const closed = positions.filter(
    (p) => p.status === 'CLOSED_TP' || p.status === 'CLOSED_SL' || p.status === 'OPEN_AT_END',
  );
  const wins   = closed.filter((p) => p.realizedR > 0).map((p) => p.realizedR);
  const losses = closed.filter((p) => p.realizedR < 0).map((p) => p.realizedR);

  return {
    ...baseMetrics,
    totalFeesR:     roundHundredths(accFeesR),
    totalSlippageR: roundHundredths(accSlippageR),
    netR,
    sharpeRatio:    computeSharpeRatio(closed.map((p) => p.realizedR)),
    calmarRatio:    computeCalmarRatio(netR, baseMetrics.maxDrawdownR),
    profitFactor:   computeProfitFactor(wins, losses),
    recoveryFactor: baseMetrics.maxDrawdownR > 0
      ? roundHundredths(netR / baseMetrics.maxDrawdownR)
      : 0,
  };
}

function zeroBacktestMetrics(totalCandles: number): BacktestMetrics {
  return {
    totalCandles, processedCandles: 0, totalDecisions: 0,
    longDecisions: 0, shortDecisions: 0, waitDecisions: 0, noTradeDecisions: 0,
    approvedTrades: 0, blockedTrades: 0, riskVetoes: 0,
    tpHits: 0, slHits: 0, openAtEnd: 0,
    winRate: 0, totalRealizedR: 0, maxDrawdownR: 0,
    averageR: 0, expectancyR: 0, opportunityCostR: 0,
    peakR: 0, currentDrawdownR: 0,
    totalFeesR: 0, totalSlippageR: 0, netR: 0,
    sharpeRatio: 0, calmarRatio: 0, profitFactor: 0, recoveryFactor: 0,
  };
}

// ── createBacktestSession ─────────────────────────────────────────────────────

export function createBacktestSession(
  params: {
    symbol:    string;
    timeframe: string;
    exchange?: string;
    candles:   ReplayCandle[];
    config?:   Partial<BacktestConfig>;
  },
  now: Date = new Date(),
): { session: BacktestSession | null; error: string | null } {
  const { session: replay, error } = createReplaySession(params, now);
  if (!replay || error) return { session: null, error: error ?? 'Failed to create session' };

  const config = { ...DEFAULT_BACKTEST_CONFIG, ...(params.config ?? {}) };
  return {
    session: {
      ...replay,
      config,
      metrics: zeroBacktestMetrics(params.candles.length),
    },
    error: null,
  };
}

// ── stepBacktestSession ───────────────────────────────────────────────────────

export function stepBacktestSession(
  session: BacktestSession,
  now:     Date = new Date(),
): { session: BacktestSession; stepped: boolean; error: string | null } {
  const prevPositions = session.simulatedPositions;

  const { session: nextReplay, stepped, error } = stepReplaySession(
    session as ReplaySession,
    now,
  );
  if (error || !stepped) return { session, stepped: false, error: error ?? null };

  // Apply fees to positions that closed in this step
  const { adjusted, stepFeesR, stepSlippageR } = applyFeesToStep(
    prevPositions,
    nextReplay.simulatedPositions,
    session.config,
  );

  const accFeesR     = roundHundredths(session.metrics.totalFeesR     + stepFeesR);
  const accSlippageR = roundHundredths(session.metrics.totalSlippageR + stepSlippageR);

  const baseMetrics = computeReplayMetrics(
    nextReplay.decisions,
    adjusted,
    nextReplay.candles,
    nextReplay.candles.length,
  );

  return {
    session: {
      ...nextReplay,
      simulatedPositions: adjusted,
      config:             session.config,
      metrics:            buildBacktestMetrics(baseMetrics, adjusted, accFeesR, accSlippageR),
    },
    stepped: true,
    error:   null,
  };
}

// ── runBacktestSession ────────────────────────────────────────────────────────

export function runBacktestSession(
  session:   BacktestSession,
  maxSteps?: number,
  now:       Date = new Date(),
): { session: BacktestSession; stepsRun: number; error: string | null } {
  if (session.status === 'COMPLETED' || session.status === 'FAILED') {
    return { session, stepsRun: 0, error: null };
  }

  const limit = maxSteps ?? session.maxStepsPerRun;
  let s       = session;
  let count   = 0;

  while (s.status !== 'COMPLETED' && s.status !== 'FAILED' && count < limit) {
    const { session: next, stepped } = stepBacktestSession(s, now);
    if (!stepped) break;
    s = next;
    count++;
  }

  return { session: s, stepsRun: count, error: null };
}

// ── pauseBacktestSession / resetBacktestSession ───────────────────────────────

export function pauseBacktestSession(
  session: BacktestSession,
  now:     Date = new Date(),
): { session: BacktestSession; error: string | null } {
  const { session: paused, error } = pauseReplaySession(session as ReplaySession, now);
  return {
    session: { ...paused, config: session.config, metrics: session.metrics } as BacktestSession,
    error,
  };
}

export function resetBacktestSession(
  session: BacktestSession,
  now:     Date = new Date(),
): { session: BacktestSession; error: string | null } {
  const { session: reset, error } = resetReplaySession(session as ReplaySession, now);
  return {
    session: {
      ...reset,
      config:  session.config,
      metrics: zeroBacktestMetrics(session.candles.length),
    } as BacktestSession,
    error,
  };
}

// ── Walk-Forward ──────────────────────────────────────────────────────────────

export function partitionWalkForwardWindows(
  totalCandles: number,
  config:       WalkForwardConfig,
): WalkForwardWindow[] {
  const minCandlesPerWindow = 10;
  if (totalCandles < config.numWindows * minCandlesPerWindow) return [];

  const step    = Math.floor(totalCandles / config.numWindows);
  const windows: WalkForwardWindow[] = [];

  for (let i = 0; i < config.numWindows; i++) {
    const winStart  = i * step;
    const winEnd    = i === config.numWindows - 1 ? totalCandles - 1 : (i + 1) * step - 1;
    const winTotal  = winEnd - winStart + 1;
    const isCount   = Math.floor(winTotal * config.inSampleRatio);
    const isEnd     = winStart + isCount - 1;
    const oosStart  = isEnd + 1;

    if (oosStart > winEnd || isCount < 5) continue;

    windows.push({
      windowIndex:      i,
      inSampleStart:    winStart,
      inSampleEnd:      isEnd,
      outOfSampleStart: oosStart,
      outOfSampleEnd:   winEnd,
    });
  }

  return windows;
}

export function computeRobustnessScore(
  isMetrics:  BacktestMetrics,
  oosMetrics: BacktestMetrics,
): number {
  const isR  = isMetrics.netR;
  const oosR = oosMetrics.netR;

  if (isR <= 0 && oosR <= 0) return 30;
  if (isR <= 0 && oosR > 0)  return 70;
  if (isR > 0  && oosR <= 0) return 10;

  const ratio = Math.min(1, oosR / isR);
  return Math.max(10, Math.round(ratio * 100));
}

export function runWalkForward(
  candles:   ReplayCandle[],
  symbol:    string,
  timeframe: string,
  exchange:  string,
  config:    BacktestConfig,
  wfConfig:  WalkForwardConfig,
  now:       Date = new Date(),
): { result: WalkForwardResult | null; error: string | null } {
  const validation = validateReplayCandleOrder(candles);
  if (!validation.valid) return { result: null, error: validation.error ?? 'Invalid candles' };

  const windows = partitionWalkForwardWindows(candles.length, wfConfig);
  if (windows.length === 0) {
    return { result: null, error: 'Not enough candles for walk-forward (need numWindows × 10 minimum)' };
  }

  const windowResults: WalkForwardWindowResult[] = [];

  for (const w of windows) {
    const isCandles  = candles.slice(w.inSampleStart,    w.inSampleEnd    + 1);
    const oosCandles = candles.slice(w.outOfSampleStart, w.outOfSampleEnd + 1);

    const { session: isInit, error: isErr } = createBacktestSession(
      { symbol, timeframe, exchange, candles: isCandles, config }, now,
    );
    if (!isInit || isErr) continue;
    const { session: isCompleted } = runBacktestSession(isInit, undefined, now);

    const { session: oosInit, error: oosErr } = createBacktestSession(
      { symbol, timeframe, exchange, candles: oosCandles, config }, now,
    );
    if (!oosInit || oosErr) continue;
    const { session: oosCompleted } = runBacktestSession(oosInit, undefined, now);

    windowResults.push({
      window:              w,
      inSampleSession:     isCompleted,
      outOfSampleSession:  oosCompleted,
      robustnessScore:     computeRobustnessScore(isCompleted.metrics, oosCompleted.metrics),
    });
  }

  const aggIS  = roundHundredths(windowResults.reduce((s, w) => s + w.inSampleSession.metrics.netR,    0));
  const aggOOS = roundHundredths(windowResults.reduce((s, w) => s + w.outOfSampleSession.metrics.netR, 0));
  const avgRob = windowResults.length > 0
    ? Math.round(windowResults.reduce((s, w) => s + w.robustnessScore, 0) / windowResults.length)
    : 0;

  return {
    result: {
      wfId:                     `wf_${now.getTime()}`,
      symbol,
      timeframe,
      config,
      walkForwardConfig:        wfConfig,
      windows:                  windowResults,
      aggregateInSampleNetR:    aggIS,
      aggregateOutOfSampleNetR: aggOOS,
      overallRobustnessScore:   avgRob,
      createdAt:                now.toISOString(),
    },
    error: null,
  };
}
