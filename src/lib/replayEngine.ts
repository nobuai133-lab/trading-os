import type {
  Decision, TradeDirection, RiskOfficeDecision,
  ReplayStatus, ReplayCandle, ReplaySession,
  ReplayDecisionRecord, ReplaySimulatedPosition,
  ReplayMetrics, ReplayQualityScores, ReplayAuditEvent,
} from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_MAX_STEPS  = 500;
const RISK_PCT           = 0.01;   // 1% risk distance
const TP_MULT            = 2.0;    // TP at 2× risk distance
const MIN_CANDLES_SIGNAL = 5;      // minimum candles needed to produce a signal
const MAX_CONCURRENT     = 2;      // max simultaneous simulated positions
const MIN_CONFIDENCE     = 70;     // minimum confidence for risk approval

// ── Candle validation ─────────────────────────────────────────────────────────

export function validateReplayCandleOrder(
  candles: ReplayCandle[],
): { valid: boolean; error?: string } {
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0) {
      return { valid: false, error: `Candle[${i}]: all prices must be positive` };
    }
    if (c.high < c.low) {
      return { valid: false, error: `Candle[${i}]: high (${c.high}) < low (${c.low})` };
    }
    if (c.high < c.open || c.high < c.close) {
      return { valid: false, error: `Candle[${i}]: high must be ≥ open and close` };
    }
    if (c.low > c.open || c.low > c.close) {
      return { valid: false, error: `Candle[${i}]: low must be ≤ open and close` };
    }
    if (c.volume < 0) {
      return { valid: false, error: `Candle[${i}]: volume must be non-negative` };
    }
    if (i > 0 && candles[i].timestamp <= candles[i - 1].timestamp) {
      return { valid: false, error: `Candle[${i}]: timestamp must be strictly ascending` };
    }
  }
  return { valid: true };
}

// ── Look-ahead bias prevention ─────────────────────────────────────────────────

export function preventLookAheadBias(
  candles:      ReplayCandle[],
  currentIndex: number,
): ReplayCandle[] {
  if (currentIndex < 0) return [];
  return candles.slice(0, Math.min(currentIndex + 1, candles.length));
}

// ── Internal: decision simulation ────────────────────────────────────────────

function simulateDecision(
  visible: ReplayCandle[],
): { decision: Decision; confidence: number } {
  if (visible.length < MIN_CANDLES_SIGNAL) {
    return { decision: 'WAIT', confidence: 50 };
  }

  const recent = visible.slice(-5);
  const curr   = recent[4];
  const prev   = recent[3];
  const prev2  = recent[2];

  if (prev.close <= 0) return { decision: 'WAIT', confidence: 50 };

  const momentum    = (curr.close - prev.close) / prev.close;
  const bullCandle  = curr.close > curr.open;
  const bearCandle  = curr.close < curr.open;
  const higherHighs = curr.high > prev.high && prev.high > prev2.high;
  const lowerLows   = curr.low  < prev.low  && prev.low  < prev2.low;

  if (higherHighs && bullCandle && momentum > 0.001) {
    const conf = Math.min(92, 65 + Math.round(momentum * 3000));
    return { decision: 'LONG', confidence: conf };
  }
  if (lowerLows && bearCandle && momentum < -0.001) {
    const conf = Math.min(92, 65 + Math.round(Math.abs(momentum) * 3000));
    return { decision: 'SHORT', confidence: conf };
  }
  return { decision: 'WAIT', confidence: 55 };
}

// ── Internal: risk simulation ─────────────────────────────────────────────────

function simulateRisk(
  decision:   Decision,
  confidence: number,
  openCount:  number,
): { approved: boolean; riskDecision: RiskOfficeDecision | null; finalR: number; vetoReason: string | null } {
  if (decision !== 'LONG' && decision !== 'SHORT') {
    return { approved: false, riskDecision: null, finalR: 0, vetoReason: null };
  }
  if (openCount >= MAX_CONCURRENT) {
    return {
      approved:     false,
      riskDecision: 'BLOCKED',
      finalR:       0,
      vetoReason:   `Max ${MAX_CONCURRENT} concurrent positions`,
    };
  }
  if (confidence < MIN_CONFIDENCE) {
    return {
      approved:     false,
      riskDecision: 'BLOCKED',
      finalR:       0,
      vetoReason:   'Confidence below threshold',
    };
  }

  const baseR = confidence >= 95 ? 1.00
    : confidence >= 90 ? 0.75
    : confidence >= 80 ? 0.50
    : 0.25;

  return { approved: true, riskDecision: 'APPROVED', finalR: baseR, vetoReason: null };
}

// ── Internal: open simulated position ────────────────────────────────────────

function openSimulatedPosition(
  candle:    ReplayCandle,
  index:     number,
  direction: TradeDirection,
  finalR:    number,
  now:       Date,
): ReplaySimulatedPosition {
  const riskDist   = candle.close * RISK_PCT;
  const stopLoss   = direction === 'LONG'
    ? candle.close - riskDist
    : candle.close + riskDist;
  const takeProfit = direction === 'LONG'
    ? candle.close + riskDist * TP_MULT
    : candle.close - riskDist * TP_MULT;

  return {
    positionId:  `rp_${index}_${now.getTime()}`,
    openIndex:   index,
    closeIndex:  null,
    direction,
    entryPrice:  candle.close,
    stopLoss,
    takeProfit,
    exitPrice:   null,
    realizedR:   0,
    finalR,
    status:      'OPEN',
    closeReason: null,
    openTs:      now.toISOString(),
    closeTs:     null,
  };
}

// ── Internal: tick positions against a candle ─────────────────────────────────

function tickPositions(
  positions: ReplaySimulatedPosition[],
  candle:    ReplayCandle,
  index:     number,
  now:       Date,
): ReplaySimulatedPosition[] {
  return positions.map((p) => {
    if (p.status !== 'OPEN') return p;

    const riskDist = Math.abs(p.entryPrice - p.stopLoss);

    if (p.direction === 'LONG') {
      // Check TP first (optimistic — candle went up before down)
      if (candle.high >= p.takeProfit) {
        const rawR = riskDist > 0 ? (p.takeProfit - p.entryPrice) / riskDist : 0;
        return {
          ...p, status: 'CLOSED_TP' as const, closeReason: 'TAKE_PROFIT',
          exitPrice: p.takeProfit,
          realizedR: Math.round(rawR * 100) / 100,
          closeIndex: index, closeTs: now.toISOString(),
        };
      }
      if (candle.low <= p.stopLoss) {
        const rawR = riskDist > 0 ? (p.stopLoss - p.entryPrice) / riskDist : 0;
        return {
          ...p, status: 'CLOSED_SL' as const, closeReason: 'STOP_LOSS',
          exitPrice: p.stopLoss,
          realizedR: Math.round(rawR * 100) / 100,
          closeIndex: index, closeTs: now.toISOString(),
        };
      }
    } else {
      if (candle.low <= p.takeProfit) {
        const rawR = riskDist > 0 ? (p.entryPrice - p.takeProfit) / riskDist : 0;
        return {
          ...p, status: 'CLOSED_TP' as const, closeReason: 'TAKE_PROFIT',
          exitPrice: p.takeProfit,
          realizedR: Math.round(rawR * 100) / 100,
          closeIndex: index, closeTs: now.toISOString(),
        };
      }
      if (candle.high >= p.stopLoss) {
        const rawR = riskDist > 0 ? (p.entryPrice - p.stopLoss) / riskDist : 0;
        return {
          ...p, status: 'CLOSED_SL' as const, closeReason: 'STOP_LOSS',
          exitPrice: p.stopLoss,
          realizedR: Math.round(rawR * 100) / 100,
          closeIndex: index, closeTs: now.toISOString(),
        };
      }
    }
    return p;
  });
}

// ── Internal: finalize open positions at session completion ───────────────────

function finalizeOpenPositions(
  positions: ReplaySimulatedPosition[],
): ReplaySimulatedPosition[] {
  return positions.map((p) =>
    p.status === 'OPEN' ? { ...p, status: 'OPEN_AT_END' as const } : p,
  );
}

// ── Internal: zero state helpers ──────────────────────────────────────────────

function zeroMetrics(totalCandles: number): ReplayMetrics {
  return {
    totalCandles, processedCandles: 0, totalDecisions: 0,
    longDecisions: 0, shortDecisions: 0, waitDecisions: 0, noTradeDecisions: 0,
    approvedTrades: 0, blockedTrades: 0, riskVetoes: 0,
    tpHits: 0, slHits: 0, openAtEnd: 0,
    winRate: 0, totalRealizedR: 0, maxDrawdownR: 0,
    averageR: 0, expectancyR: 0, opportunityCostR: 0,
    peakR: 0, currentDrawdownR: 0,
  };
}

function zeroQuality(): ReplayQualityScores {
  return {
    decisionQualityScore:  50,
    riskQualityScore:      60,
    memoryQualityScore:    50,
    lifecycleQualityScore: 100,
    overallScore:          56,
  };
}

// ── computeOpportunityCost ────────────────────────────────────────────────────

export function computeOpportunityCost(
  decisions: ReplayDecisionRecord[],
  candles:   ReplayCandle[],
): number {
  const DEFAULT_R = 0.5;
  let cost = 0;

  for (const d of decisions) {
    if ((d.decision !== 'LONG' && d.decision !== 'SHORT') || d.riskApproved) continue;

    const entry    = d.candle.close;
    const riskDist = entry * RISK_PCT;
    const sl       = d.decision === 'LONG' ? entry - riskDist : entry + riskDist;
    const tp       = d.decision === 'LONG'
      ? entry + riskDist * TP_MULT
      : entry - riskDist * TP_MULT;

    for (let i = d.index + 1; i < candles.length; i++) {
      const c = candles[i];
      if (d.decision === 'LONG') {
        if (c.high >= tp)  { cost += DEFAULT_R * TP_MULT; break; }
        if (c.low  <= sl)  { break; }
      } else {
        if (c.low  <= tp)  { cost += DEFAULT_R * TP_MULT; break; }
        if (c.high >= sl)  { break; }
      }
    }
  }

  return Math.round(cost * 100) / 100;
}

// ── computeReplayMetrics ──────────────────────────────────────────────────────

export function computeReplayMetrics(
  decisions:    ReplayDecisionRecord[],
  positions:    ReplaySimulatedPosition[],
  candles:      ReplayCandle[],
  totalCandles: number,
): ReplayMetrics {
  const closed  = positions.filter((p) => p.status !== 'OPEN');
  const wins    = closed.filter((p) => p.realizedR > 0);
  const losses  = closed.filter((p) => p.realizedR < 0);
  const tpHits  = positions.filter((p) => p.status === 'CLOSED_TP').length;
  const slHits  = positions.filter((p) => p.status === 'CLOSED_SL').length;
  const openEnd = positions.filter((p) => p.status === 'OPEN' || p.status === 'OPEN_AT_END').length;

  const totalR  = closed.reduce((s, p) => s + p.realizedR, 0);
  const winRate = closed.length > 0 ? wins.length / closed.length : 0;
  const avgR    = closed.length > 0 ? totalR / closed.length : 0;
  const avgWin  = wins.length   > 0 ? wins.reduce((s, p) => s + p.realizedR, 0) / wins.length   : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, p) => s + p.realizedR, 0) / losses.length : 0;
  const expect  = (winRate * avgWin) + ((1 - winRate) * avgLoss);

  // Running R curve for drawdown
  let peakR = 0;
  let curR  = 0;
  let maxDD = 0;
  const sortedClosed = [...closed].sort((a, b) => (a.closeIndex ?? 0) - (b.closeIndex ?? 0));
  for (const p of sortedClosed) {
    curR += p.realizedR;
    if (curR > peakR) peakR = curR;
    const dd = peakR - curR;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    totalCandles,
    processedCandles:  decisions.length,
    totalDecisions:    decisions.length,
    longDecisions:     decisions.filter((d) => d.decision === 'LONG').length,
    shortDecisions:    decisions.filter((d) => d.decision === 'SHORT').length,
    waitDecisions:     decisions.filter((d) => d.decision === 'WAIT').length,
    noTradeDecisions:  decisions.filter((d) => d.decision === 'NO TRADE').length,
    approvedTrades:    decisions.filter((d) => d.riskApproved).length,
    blockedTrades:     decisions.filter(
      (d) => (d.decision === 'LONG' || d.decision === 'SHORT') && !d.riskApproved,
    ).length,
    riskVetoes:        decisions.filter((d) => d.riskVetoReason != null).length,
    tpHits,
    slHits,
    openAtEnd:         openEnd,
    winRate:           Math.round(winRate * 1000) / 10,
    totalRealizedR:    Math.round(totalR * 100) / 100,
    maxDrawdownR:      Math.round(maxDD * 100) / 100,
    averageR:          Math.round(avgR * 100) / 100,
    expectancyR:       Math.round(expect * 100) / 100,
    opportunityCostR:  computeOpportunityCost(decisions, candles),
    peakR:             Math.round(peakR * 100) / 100,
    currentDrawdownR:  Math.round(Math.max(0, peakR - curR) * 100) / 100,
  };
}

// ── Quality scores ────────────────────────────────────────────────────────────

export function computeDecisionQualityScore(
  decisions: ReplayDecisionRecord[],
  positions: ReplaySimulatedPosition[],
): number {
  if (decisions.length === 0) return 50;

  const posMap   = new Map(positions.map((p) => [p.positionId, p]));
  let correct    = 0;
  let incorrect  = 0;

  for (const d of decisions) {
    if (!d.positionOpened || !d.positionId) continue;
    const p = posMap.get(d.positionId);
    if (!p) continue;
    if (p.status === 'CLOSED_TP') correct++;
    else if (p.status === 'CLOSED_SL') incorrect++;
  }

  const total = correct + incorrect;
  if (total === 0) return 50;
  return Math.max(0, Math.min(100, Math.round((correct / total) * 100)));
}

export function computeRiskQualityScore(
  decisions: ReplayDecisionRecord[],
  positions: ReplaySimulatedPosition[],
): number {
  const posMap   = new Map(positions.map((p) => [p.positionId, p]));
  const approved = decisions.filter((d) => d.riskApproved && d.positionId);

  if (approved.length === 0) return 60;

  let tpCount = 0;
  let slCount = 0;

  for (const d of approved) {
    const p = posMap.get(d.positionId!);
    if (!p) continue;
    if (p.status === 'CLOSED_TP') tpCount++;
    if (p.status === 'CLOSED_SL') slCount++;
  }

  const total = tpCount + slCount;
  if (total === 0) return 60;
  return Math.max(0, Math.min(100, Math.round(40 + (tpCount / total) * 60)));
}

export function computeMemoryQualityScore(decisions: ReplayDecisionRecord[]): number {
  const actionable = decisions.filter(
    (d) => d.decision === 'LONG' || d.decision === 'SHORT',
  );
  if (actionable.length === 0) return 50;

  const avgConf = actionable.reduce((s, d) => s + d.confidence, 0) / actionable.length;
  // 70 conf → score 50; 92 conf → score 90
  const score = Math.round(50 + ((avgConf - 70) / 22) * 40);
  return Math.max(0, Math.min(100, score));
}

export function computeLifecycleQualityScore(
  positions: ReplaySimulatedPosition[],
): number {
  if (positions.length === 0) return 100;

  const openAtEnd    = positions.filter(
    (p) => p.status === 'OPEN' || p.status === 'OPEN_AT_END',
  ).length;
  const penaltyFrac  = Math.min(0.6, (openAtEnd / positions.length) * 0.4);
  return Math.max(0, Math.min(100, Math.round(100 - penaltyFrac * 100)));
}

function buildQualityScores(
  decisions: ReplayDecisionRecord[],
  positions: ReplaySimulatedPosition[],
): ReplayQualityScores {
  const dq = computeDecisionQualityScore(decisions, positions);
  const rq = computeRiskQualityScore(decisions, positions);
  const mq = computeMemoryQualityScore(decisions);
  const lq = computeLifecycleQualityScore(positions);
  return {
    decisionQualityScore:  dq,
    riskQualityScore:      rq,
    memoryQualityScore:    mq,
    lifecycleQualityScore: lq,
    overallScore:          Math.round(dq * 0.35 + rq * 0.30 + mq * 0.20 + lq * 0.15),
  };
}

// ── createReplaySession ───────────────────────────────────────────────────────

export function createReplaySession(
  params: {
    symbol:          string;
    timeframe:       string;
    exchange?:       string;
    candles:         ReplayCandle[];
    maxStepsPerRun?: number;
  },
  now: Date = new Date(),
): { session: ReplaySession | null; error: string | null } {
  const validation = validateReplayCandleOrder(params.candles);
  if (!validation.valid) {
    return { session: null, error: validation.error ?? 'Invalid candles' };
  }

  const ts        = now.toISOString();
  const startTime = params.candles.length > 0
    ? params.candles[0].timestamp
    : now.getTime();
  const endTime   = params.candles.length > 0
    ? params.candles[params.candles.length - 1].timestamp
    : now.getTime();

  const session: ReplaySession = {
    replayId:           `re_${now.getTime()}_${Math.random().toString(36).slice(2, 7)}`,
    symbol:             params.symbol,
    timeframe:          params.timeframe,
    exchange:           params.exchange ?? 'SIMULATED',
    startTime,
    endTime,
    candles:            params.candles,
    currentIndex:       -1,
    currentCandle:      null,
    visibleCandlesOnly: [],
    decisions:          [],
    simulatedPositions: [],
    metrics:            zeroMetrics(params.candles.length),
    qualityScores:      zeroQuality(),
    auditTrail:         [{
      ts, index: -1, event: 'SESSION_CREATED',
      details: {
        symbol:      params.symbol,
        timeframe:   params.timeframe,
        candleCount: params.candles.length,
      },
    }],
    status:         'IDLE',
    createdAt:      ts,
    updatedAt:      ts,
    completedAt:    null,
    errorMessage:   null,
    maxStepsPerRun: params.maxStepsPerRun ?? DEFAULT_MAX_STEPS,
  };

  return { session, error: null };
}

// ── stepReplaySession ─────────────────────────────────────────────────────────

export function stepReplaySession(
  session: ReplaySession,
  now:     Date = new Date(),
): { session: ReplaySession; stepped: boolean; error: string | null } {
  // Terminal or no-op states
  if (session.status === 'COMPLETED' || session.status === 'FAILED') {
    return { session, stepped: false, error: null };
  }

  // PAUSED → resume then step
  if (session.status === 'PAUSED') {
    const resumed = { ...session, status: 'RUNNING' as ReplayStatus };
    return stepReplaySession(resumed, now);
  }

  // IDLE → RUNNING
  let s: ReplaySession = session.status === 'IDLE'
    ? { ...session, status: 'RUNNING' as ReplayStatus }
    : session;

  const nextIndex = s.currentIndex + 1;

  // Past end of candles
  if (nextIndex >= s.candles.length) {
    const ts = now.toISOString();
    return {
      session: {
        ...s,
        status:      'COMPLETED',
        completedAt: ts,
        updatedAt:   ts,
        simulatedPositions: finalizeOpenPositions(s.simulatedPositions),
      },
      stepped: true, error: null,
    };
  }

  const ts      = now.toISOString();
  const candle  = s.candles[nextIndex];
  const visible = preventLookAheadBias(s.candles, nextIndex);

  // 1. Update existing open positions with this candle
  const tickedPositions = tickPositions(s.simulatedPositions, candle, nextIndex, now);

  // 2. Simulate decision (visible candles only — no look-ahead)
  const { decision, confidence } = simulateDecision(visible);

  // 3. Simulate risk approval
  const openNow = tickedPositions.filter((p) => p.status === 'OPEN').length;
  const risk    = simulateRisk(decision, confidence, openNow);

  // 4. Open position if approved
  let finalPositions = tickedPositions;
  let newPosId: string | null = null;

  if (risk.approved && (decision === 'LONG' || decision === 'SHORT')) {
    const pos = openSimulatedPosition(candle, nextIndex, decision as TradeDirection, risk.finalR, now);
    newPosId   = pos.positionId;
    finalPositions = [...tickedPositions, pos];
  }

  // 5. Record decision
  const record: ReplayDecisionRecord = {
    index:          nextIndex,
    candle,
    decision,
    confidence,
    riskApproved:   risk.approved,
    riskDecision:   risk.riskDecision,
    finalR:         risk.finalR,
    positionOpened: newPosId !== null,
    positionId:     newPosId,
    riskVetoReason: risk.vetoReason,
    ts,
  };

  const newDecisions = [...s.decisions, record];

  // 6. If last candle: finalize open positions
  const isLast          = nextIndex >= s.candles.length - 1;
  const readyPositions  = isLast ? finalizeOpenPositions(finalPositions) : finalPositions;

  // 7. Recompute metrics and quality
  const newMetrics = computeReplayMetrics(newDecisions, readyPositions, s.candles, s.candles.length);
  const newQuality = buildQualityScores(newDecisions, readyPositions);

  // 8. Audit entry
  const auditEntry: ReplayAuditEvent = {
    ts, index: nextIndex, event: 'CANDLE_PROCESSED',
    details: {
      decision, confidence, approved: risk.approved,
      positionOpened: newPosId !== null,
      openPositions:  readyPositions.filter((p) => p.status === 'OPEN').length,
    },
  };

  return {
    session: {
      ...s,
      currentIndex:       nextIndex,
      currentCandle:      candle,
      visibleCandlesOnly: visible,
      decisions:          newDecisions,
      simulatedPositions: readyPositions,
      metrics:            newMetrics,
      qualityScores:      newQuality,
      auditTrail:         [...s.auditTrail, auditEntry],
      status:             isLast ? 'COMPLETED' : 'RUNNING',
      updatedAt:          ts,
      completedAt:        isLast ? ts : null,
    },
    stepped: true,
    error:   null,
  };
}

// ── runReplaySession ──────────────────────────────────────────────────────────

export function runReplaySession(
  session:   ReplaySession,
  maxSteps?: number,
  now:       Date = new Date(),
): { session: ReplaySession; stepsRun: number; error: string | null } {
  if (session.status === 'COMPLETED' || session.status === 'FAILED') {
    return { session, stepsRun: 0, error: null };
  }

  const limit = maxSteps ?? session.maxStepsPerRun;
  let s       = session;
  let count   = 0;

  while (s.status !== 'COMPLETED' && s.status !== 'FAILED' && count < limit) {
    const { session: next, stepped } = stepReplaySession(s, now);
    if (!stepped) break;
    s = next;
    count++;
  }

  return { session: s, stepsRun: count, error: null };
}

// ── pauseReplaySession ────────────────────────────────────────────────────────

export function pauseReplaySession(
  session: ReplaySession,
  now:     Date = new Date(),
): { session: ReplaySession; error: string | null } {
  if (session.status !== 'RUNNING') {
    return { session, error: null };
  }

  const ts = now.toISOString();
  return {
    session: {
      ...session,
      status:    'PAUSED',
      updatedAt: ts,
      auditTrail: [
        ...session.auditTrail,
        { ts, index: session.currentIndex, event: 'PAUSED', details: {} },
      ],
    },
    error: null,
  };
}

// ── resetReplaySession ────────────────────────────────────────────────────────

export function resetReplaySession(
  session: ReplaySession,
  now:     Date = new Date(),
): { session: ReplaySession; error: string | null } {
  const ts = now.toISOString();
  return {
    session: {
      ...session,
      currentIndex:       -1,
      currentCandle:      null,
      visibleCandlesOnly: [],
      decisions:          [],
      simulatedPositions: [],
      metrics:            zeroMetrics(session.candles.length),
      qualityScores:      zeroQuality(),
      auditTrail:         [{
        ts, index: -1, event: 'SESSION_RESET',
        details: { previousStatus: session.status },
      }],
      status:       'IDLE',
      updatedAt:    ts,
      completedAt:  null,
      errorMessage: null,
    },
    error: null,
  };
}
