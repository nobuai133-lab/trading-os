import { describe, it, expect } from 'vitest';
import {
  createReplaySession,
  stepReplaySession,
  runReplaySession,
  pauseReplaySession,
  resetReplaySession,
  validateReplayCandleOrder,
  preventLookAheadBias,
  computeReplayMetrics,
  computeDecisionQualityScore,
  computeRiskQualityScore,
  computeMemoryQualityScore,
  computeLifecycleQualityScore,
  computeOpportunityCost,
} from '@/lib/replayEngine';
import type { ReplayCandle, ReplayDecisionRecord, ReplaySimulatedPosition } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCandles(count: number, basePrice = 100): ReplayCandle[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: 1_000_000 + i * 60_000,
    open:  basePrice,
    high:  basePrice + 2,
    low:   basePrice - 1,
    close: basePrice + 1,
    volume: 1000,
  }));
}

// Produces LONG signal after ≥5 candles: rising highs, bullish body, positive momentum
function makeBullCandles(count: number, basePrice = 100): ReplayCandle[] {
  return Array.from({ length: count }, (_, i) => {
    const base = basePrice + i * 2;
    return {
      timestamp: 1_000_000 + i * 60_000,
      open:   base,
      high:   base + 3,
      low:    base - 0.5,
      close:  base + 2,
      volume: 1000,
    };
  });
}

// Produces SHORT signal after ≥5 candles: falling lows, bearish body, negative momentum
function makeBearCandles(count: number, basePrice = 100): ReplayCandle[] {
  return Array.from({ length: count }, (_, i) => {
    const base = basePrice - i * 2;
    return {
      timestamp: 1_000_000 + i * 60_000,
      open:   base + 2,
      high:   base + 2.5,
      low:    base - 2,
      close:  base,
      volume: 1000,
    };
  });
}

function makeSession(count = 10, drift = 0) {
  const candles = makeCandles(count, 100);
  return createReplaySession({ symbol: 'BTCUSDT', timeframe: '4H', candles }).session!;
}

// ── createReplaySession ───────────────────────────────────────────────────────

describe('createReplaySession', () => {
  it('TC-RE01: creates session with IDLE status', () => {
    const { session, error } = createReplaySession({
      symbol: 'BTCUSDT', timeframe: '4H', candles: makeCandles(10),
    });
    expect(error).toBeNull();
    expect(session!.status).toBe('IDLE');
    expect(session!.currentIndex).toBe(-1);
    expect(session!.currentCandle).toBeNull();
  });

  it('TC-RE02: stores correct candle count in metrics.totalCandles', () => {
    const { session } = createReplaySession({
      symbol: 'BTCUSDT', timeframe: '4H', candles: makeCandles(20),
    });
    expect(session!.metrics.totalCandles).toBe(20);
    expect(session!.candles).toHaveLength(20);
  });

  it('TC-RE03: accepts empty candle array', () => {
    const { session, error } = createReplaySession({
      symbol: 'BTCUSDT', timeframe: '4H', candles: [],
    });
    expect(error).toBeNull();
    expect(session!.status).toBe('IDLE');
    expect(session!.candles).toHaveLength(0);
  });

  it('TC-RE04: sets startTime and endTime from candles', () => {
    const candles = makeCandles(5);
    const { session } = createReplaySession({ symbol: 'BTCUSDT', timeframe: '4H', candles });
    expect(session!.startTime).toBe(candles[0].timestamp);
    expect(session!.endTime).toBe(candles[4].timestamp);
  });

  it('TC-RE05: applies default maxStepsPerRun = 500', () => {
    const { session } = createReplaySession({ symbol: 'BTCUSDT', timeframe: '4H', candles: makeCandles(5) });
    expect(session!.maxStepsPerRun).toBe(500);
  });

  it('TC-RE05b: rejects invalid candles at creation', () => {
    const bad: ReplayCandle[] = [
      { timestamp: 1000, open: 100, high: 90, low: 95, close: 92, volume: 0 },
    ];
    const { session, error } = createReplaySession({ symbol: 'X', timeframe: '1H', candles: bad });
    expect(session).toBeNull();
    expect(error).toBeTruthy();
  });
});

// ── validateReplayCandleOrder ─────────────────────────────────────────────────

describe('validateReplayCandleOrder', () => {
  it('TC-RE06: passes valid sequential candles', () => {
    expect(validateReplayCandleOrder(makeCandles(5)).valid).toBe(true);
  });

  it('TC-RE07: rejects out-of-order timestamps', () => {
    const candles = makeCandles(3);
    candles[1] = { ...candles[1], timestamp: candles[0].timestamp - 1 };
    const r = validateReplayCandleOrder(candles);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/ascending/);
  });

  it('TC-RE08: rejects duplicate timestamps', () => {
    const candles = makeCandles(3);
    candles[1] = { ...candles[1], timestamp: candles[0].timestamp };
    expect(validateReplayCandleOrder(candles).valid).toBe(false);
  });

  it('TC-RE09: rejects malformed OHLCV — high < low', () => {
    const candles: ReplayCandle[] = [
      { timestamp: 1000, open: 100, high: 90, low: 95, close: 92, volume: 0 },
    ];
    const r = validateReplayCandleOrder(candles);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/high.*low/i);
  });

  it('TC-RE10: rejects zero close price', () => {
    const candles: ReplayCandle[] = [
      { timestamp: 1000, open: 0, high: 0, low: 0, close: 0, volume: 0 },
    ];
    expect(validateReplayCandleOrder(candles).valid).toBe(false);
  });
});

// ── preventLookAheadBias ──────────────────────────────────────────────────────

describe('preventLookAheadBias', () => {
  it('TC-RE11: returns only candles 0..currentIndex', () => {
    const candles = makeCandles(10);
    const visible = preventLookAheadBias(candles, 4);
    expect(visible).toHaveLength(5);
    expect(visible[4]).toBe(candles[4]);
  });

  it('TC-RE12: returns single candle at index 0', () => {
    const candles = makeCandles(10);
    expect(preventLookAheadBias(candles, 0)).toHaveLength(1);
  });

  it('TC-RE12b: returns empty array for index -1', () => {
    expect(preventLookAheadBias(makeCandles(5), -1)).toHaveLength(0);
  });
});

// ── stepReplaySession ─────────────────────────────────────────────────────────

describe('stepReplaySession', () => {
  it('TC-RE13: step from IDLE transitions to RUNNING', () => {
    const s = makeSession(5);
    expect(s.status).toBe('IDLE');
    const { session } = stepReplaySession(s);
    expect(session.status === 'RUNNING' || session.status === 'COMPLETED').toBe(true);
  });

  it('TC-RE14: step advances currentIndex by 1', () => {
    const s = makeSession(10);
    const { session } = stepReplaySession(s);
    expect(session.currentIndex).toBe(0);
    const { session: s2 } = stepReplaySession(session);
    expect(s2.currentIndex).toBe(1);
  });

  it('TC-RE15: step records a decision for each processed candle', () => {
    let s = makeSession(10);
    for (let i = 0; i < 3; i++) {
      const { session } = stepReplaySession(s);
      s = session;
    }
    expect(s.decisions).toHaveLength(3);
  });

  it('TC-RE16: step on COMPLETED returns unchanged session (no-op)', () => {
    const s = makeSession(1);
    const { session: done } = runReplaySession(s);
    expect(done.status).toBe('COMPLETED');
    const { session: again, stepped } = stepReplaySession(done);
    expect(stepped).toBe(false);
    expect(again.decisions).toHaveLength(done.decisions.length);
  });

  it('TC-RE17: step on last candle → status becomes COMPLETED', () => {
    const s = makeSession(1);
    const { session } = stepReplaySession(s);
    expect(session.status).toBe('COMPLETED');
    expect(session.completedAt).not.toBeNull();
  });

  it('TC-RE18: bullish candles produce LONG decision after 5 candles', () => {
    const candles  = makeBullCandles(6);
    const { session } = createReplaySession({ symbol: 'BTC', timeframe: '4H', candles });
    const { session: done } = runReplaySession(session!);
    const longs = done.decisions.filter((d) => d.decision === 'LONG');
    expect(longs.length).toBeGreaterThan(0);
  });

  it('TC-RE19: LONG decision with confidence ≥70 opens simulated position', () => {
    const candles = makeBullCandles(7);
    const { session } = createReplaySession({ symbol: 'BTC', timeframe: '4H', candles });
    const { session: done } = runReplaySession(session!);
    const opened = done.decisions.filter((d) => d.positionOpened);
    expect(opened.length).toBeGreaterThan(0);
    expect(done.simulatedPositions.length).toBeGreaterThan(0);
  });
});

// ── TP / SL simulation ────────────────────────────────────────────────────────

describe('TP / SL simulation', () => {
  // Build a controlled scenario: 5 bull candles → LONG opened at ~110, then spike
  it('TC-RE22: simulated LONG position closes as CLOSED_TP on price spike', () => {
    const bull  = makeBullCandles(6);  // candles[5] close ≈ 110
    const entry = bull[5].close;       // ~110
    const tp    = entry * 1.021;       // just above TP (entry * 1.02)
    const next: ReplayCandle = {
      timestamp: bull[5].timestamp + 60_000,
      open: entry, high: tp, low: entry - 0.5, close: tp - 0.1, volume: 1000,
    };
    const candles = [...bull, next];
    const { session } = createReplaySession({ symbol: 'BTC', timeframe: '4H', candles });
    const { session: done } = runReplaySession(session!);
    const tpPos = done.simulatedPositions.filter((p) => p.status === 'CLOSED_TP');
    expect(tpPos.length).toBeGreaterThan(0);
    expect(tpPos[0].realizedR).toBeCloseTo(2.0, 1);
  });

  it('TC-RE32: simulated LONG position closes as CLOSED_SL on price drop', () => {
    const bull  = makeBullCandles(6);
    const entry = bull[5].close;
    const sl    = entry * 0.989;  // just below SL (entry * 0.99)
    const next: ReplayCandle = {
      timestamp: bull[5].timestamp + 60_000,
      open: entry, high: entry + 0.5, low: sl, close: sl + 0.1, volume: 1000,
    };
    const candles = [...bull, next];
    const { session } = createReplaySession({ symbol: 'BTC', timeframe: '4H', candles });
    const { session: done } = runReplaySession(session!);
    const slPos = done.simulatedPositions.filter((p) => p.status === 'CLOSED_SL');
    expect(slPos.length).toBeGreaterThan(0);
    expect(slPos[0].realizedR).toBeCloseTo(-1.0, 1);
  });

  it('TC-RE33: bearish candles produce SHORT decision and open SHORT position', () => {
    const candles = makeBearCandles(7);
    const { session } = createReplaySession({ symbol: 'ETH', timeframe: '4H', candles });
    const { session: done } = runReplaySession(session!);
    const shorts = done.decisions.filter((d) => d.decision === 'SHORT');
    expect(shorts.length).toBeGreaterThan(0);
    const shortPos = done.simulatedPositions.filter((p) => p.direction === 'SHORT');
    expect(shortPos.length).toBeGreaterThan(0);
  });
});

// ── runReplaySession ──────────────────────────────────────────────────────────

describe('runReplaySession', () => {
  it('TC-RE20: run processes all candles and reaches COMPLETED', () => {
    const candles = makeCandles(15);
    const { session } = createReplaySession({ symbol: 'BTC', timeframe: '1H', candles });
    const { session: done, stepsRun } = runReplaySession(session!);
    expect(done.status).toBe('COMPLETED');
    expect(stepsRun).toBe(15);
    expect(done.decisions).toHaveLength(15);
  });

  it('TC-RE21: run respects maxSteps limit', () => {
    const candles = makeCandles(20);
    const { session } = createReplaySession({ symbol: 'BTC', timeframe: '1H', candles });
    const { session: partial, stepsRun } = runReplaySession(session!, 5);
    expect(stepsRun).toBe(5);
    expect(partial.status).toBe('RUNNING');
    expect(partial.currentIndex).toBe(4);
  });

  it('TC-RE23: run on completed session returns immediately with 0 steps', () => {
    const { session } = createReplaySession({ symbol: 'BTC', timeframe: '1H', candles: makeCandles(3) });
    const { session: done } = runReplaySession(session!);
    const { stepsRun } = runReplaySession(done);
    expect(stepsRun).toBe(0);
  });

  it('TC-RE30: same candles produce same metrics (deterministic)', () => {
    const candles = makeBullCandles(10);
    const { session: s1 } = createReplaySession({ symbol: 'BTC', timeframe: '4H', candles });
    const { session: s2 } = createReplaySession({ symbol: 'BTC', timeframe: '4H', candles });
    const t = new Date('2026-01-01T00:00:00Z');
    const { session: r1 } = runReplaySession(s1!, undefined, t);
    const { session: r2 } = runReplaySession(s2!, undefined, t);
    // Metrics should be identical
    expect(r1.metrics.totalRealizedR).toBe(r2.metrics.totalRealizedR);
    expect(r1.metrics.tpHits).toBe(r2.metrics.tpHits);
    expect(r1.decisions.map((d) => d.decision)).toEqual(r2.decisions.map((d) => d.decision));
  });

  it('TC-RE38: single candle replay completes in one step', () => {
    const candles = makeCandles(1);
    const { session } = createReplaySession({ symbol: 'BTC', timeframe: '1H', candles });
    const { session: done, stepsRun } = runReplaySession(session!);
    expect(done.status).toBe('COMPLETED');
    expect(stepsRun).toBe(1);
  });
});

// ── pauseReplaySession ────────────────────────────────────────────────────────

describe('pauseReplaySession', () => {
  it('TC-RE24: pause RUNNING session → PAUSED', () => {
    const { session } = createReplaySession({ symbol: 'BTC', timeframe: '4H', candles: makeCandles(10) });
    const { session: running } = stepReplaySession(session!);
    const { session: paused }  = pauseReplaySession(running);
    expect(paused.status).toBe('PAUSED');
  });

  it('TC-RE25: pause COMPLETED session → no-op', () => {
    const { session } = createReplaySession({ symbol: 'BTC', timeframe: '4H', candles: makeCandles(2) });
    const { session: done } = runReplaySession(session!);
    const { session: tried } = pauseReplaySession(done);
    expect(tried.status).toBe('COMPLETED');
  });

  it('TC-RE24b: paused session can be resumed via step', () => {
    const { session } = createReplaySession({ symbol: 'BTC', timeframe: '4H', candles: makeCandles(5) });
    const { session: running } = stepReplaySession(session!);
    const { session: paused }  = pauseReplaySession(running);
    const { session: resumed } = stepReplaySession(paused);
    expect(resumed.status === 'RUNNING' || resumed.status === 'COMPLETED').toBe(true);
    expect(resumed.currentIndex).toBeGreaterThan(running.currentIndex);
  });
});

// ── resetReplaySession ────────────────────────────────────────────────────────

describe('resetReplaySession', () => {
  it('TC-RE26: reset returns session to IDLE with index = -1', () => {
    const { session } = createReplaySession({ symbol: 'BTC', timeframe: '4H', candles: makeCandles(5) });
    const { session: ran }   = runReplaySession(session!);
    const { session: reset } = resetReplaySession(ran);
    expect(reset.status).toBe('IDLE');
    expect(reset.currentIndex).toBe(-1);
    expect(reset.currentCandle).toBeNull();
  });

  it('TC-RE27: reset preserves original candle array', () => {
    const candles = makeCandles(5);
    const { session } = createReplaySession({ symbol: 'BTC', timeframe: '4H', candles });
    const { session: ran }   = runReplaySession(session!);
    const { session: reset } = resetReplaySession(ran);
    expect(reset.candles).toHaveLength(5);
    expect(reset.candles[0]).toEqual(candles[0]);
  });

  it('TC-RE27b: reset clears decisions, positions, and metrics', () => {
    const { session } = createReplaySession({ symbol: 'BTC', timeframe: '4H', candles: makeBullCandles(8) });
    const { session: ran }   = runReplaySession(session!);
    const { session: reset } = resetReplaySession(ran);
    expect(reset.decisions).toHaveLength(0);
    expect(reset.simulatedPositions).toHaveLength(0);
    expect(reset.metrics.totalRealizedR).toBe(0);
  });
});

// ── computeReplayMetrics ──────────────────────────────────────────────────────

describe('computeReplayMetrics', () => {
  it('TC-RE28: no trades → zero realized R and zero win rate', () => {
    const m = computeReplayMetrics([], [], [], 10);
    expect(m.totalRealizedR).toBe(0);
    expect(m.winRate).toBe(0);
    expect(m.tpHits).toBe(0);
  });

  it('TC-RE29: win rate = 1 win / 2 closed = 50%', () => {
    const positions: ReplaySimulatedPosition[] = [
      { positionId: 'a', openIndex: 0, closeIndex: 1, direction: 'LONG', entryPrice: 100,
        stopLoss: 99, takeProfit: 102, exitPrice: 102, realizedR: 2, finalR: 0.5,
        status: 'CLOSED_TP', closeReason: 'TAKE_PROFIT', openTs: '', closeTs: '' },
      { positionId: 'b', openIndex: 2, closeIndex: 3, direction: 'LONG', entryPrice: 100,
        stopLoss: 99, takeProfit: 102, exitPrice: 99, realizedR: -1, finalR: 0.5,
        status: 'CLOSED_SL', closeReason: 'STOP_LOSS', openTs: '', closeTs: '' },
    ];
    const m = computeReplayMetrics([], positions, [], 10);
    expect(m.winRate).toBe(50);
    expect(m.tpHits).toBe(1);
    expect(m.slHits).toBe(1);
    expect(m.totalRealizedR).toBe(1);
  });

  it('TC-RE30: max drawdown tracks peak-to-trough correctly', () => {
    const positions: ReplaySimulatedPosition[] = [
      { positionId: 'a', openIndex: 0, closeIndex: 1, direction: 'LONG', entryPrice: 100,
        stopLoss: 99, takeProfit: 102, exitPrice: 102, realizedR: 2, finalR: 1,
        status: 'CLOSED_TP', closeReason: null, openTs: '', closeTs: '' },
      { positionId: 'b', openIndex: 2, closeIndex: 3, direction: 'LONG', entryPrice: 100,
        stopLoss: 99, takeProfit: 102, exitPrice: 99, realizedR: -1, finalR: 1,
        status: 'CLOSED_SL', closeReason: null, openTs: '', closeTs: '' },
      { positionId: 'c', openIndex: 4, closeIndex: 5, direction: 'LONG', entryPrice: 100,
        stopLoss: 99, takeProfit: 102, exitPrice: 99, realizedR: -1, finalR: 1,
        status: 'CLOSED_SL', closeReason: null, openTs: '', closeTs: '' },
    ];
    const m = computeReplayMetrics([], positions, [], 10);
    // Peak = 2R after first trade; then drops to 2-1=1, then to 1-1=0 → drawdown = 2
    expect(m.maxDrawdownR).toBeCloseTo(2.0);
    expect(m.peakR).toBeCloseTo(2.0);
  });
});

// ── computeOpportunityCost ────────────────────────────────────────────────────

describe('computeOpportunityCost', () => {
  it('TC-RE31: measures missed TP for blocked LONG', () => {
    const entry   = 100;
    const riskDist = entry * 0.01;
    const tp      = entry + riskDist * 2;   // 102

    const decisions: ReplayDecisionRecord[] = [{
      index: 0, candle: { timestamp: 1000, open: 100, high: 101, low: 99, close: 100, volume: 100 },
      decision: 'LONG', confidence: 65,  // below MIN_CONFIDENCE → blocked
      riskApproved: false, riskDecision: 'BLOCKED', finalR: 0,
      positionOpened: false, positionId: null, riskVetoReason: 'Confidence below threshold',
      ts: '',
    }];

    // Next candle hits the TP
    const candles: ReplayCandle[] = [
      { timestamp: 1000, open: 100, high: 101,   low: 99,  close: 100, volume: 100 },
      { timestamp: 2000, open: 100, high: tp + 1, low: 99,  close: 102, volume: 100 },
    ];

    const cost = computeOpportunityCost(decisions, candles);
    expect(cost).toBeGreaterThan(0);
  });

  it('TC-RE31b: no opportunity cost for WAIT that would have hit SL', () => {
    const entry    = 100;
    const riskDist = entry * 0.01;
    const sl       = entry - riskDist;  // 99

    const decisions: ReplayDecisionRecord[] = [{
      index: 0, candle: { timestamp: 1000, open: 100, high: 101, low: 99.5, close: 100, volume: 100 },
      decision: 'LONG', confidence: 60,
      riskApproved: false, riskDecision: 'BLOCKED', finalR: 0,
      positionOpened: false, positionId: null, riskVetoReason: 'test',
      ts: '',
    }];

    const candles: ReplayCandle[] = [
      { timestamp: 1000, open: 100, high: 101, low: 99.5, close: 100, volume: 100 },
      { timestamp: 2000, open: 100, high: 100.5, low: sl - 0.1, close: 99, volume: 100 },
    ];

    expect(computeOpportunityCost(decisions, candles)).toBe(0);
  });
});

// ── Quality scores ────────────────────────────────────────────────────────────

describe('Quality score functions', () => {
  it('TC-RE33a: computeDecisionQualityScore: all TP → 100', () => {
    const positions: ReplaySimulatedPosition[] = [
      { positionId: 'x', openIndex: 0, closeIndex: 1, direction: 'LONG', entryPrice: 100,
        stopLoss: 99, takeProfit: 102, exitPrice: 102, realizedR: 2, finalR: 0.5,
        status: 'CLOSED_TP', closeReason: null, openTs: '', closeTs: '' },
    ];
    const decisions: ReplayDecisionRecord[] = [{
      index: 0, candle: makeCandles(1)[0], decision: 'LONG', confidence: 80,
      riskApproved: true, riskDecision: 'APPROVED', finalR: 0.5,
      positionOpened: true, positionId: 'x', riskVetoReason: null, ts: '',
    }];
    expect(computeDecisionQualityScore(decisions, positions)).toBe(100);
  });

  it('TC-RE33b: computeDecisionQualityScore: all SL → 0', () => {
    const positions: ReplaySimulatedPosition[] = [
      { positionId: 'y', openIndex: 0, closeIndex: 1, direction: 'LONG', entryPrice: 100,
        stopLoss: 99, takeProfit: 102, exitPrice: 99, realizedR: -1, finalR: 0.5,
        status: 'CLOSED_SL', closeReason: null, openTs: '', closeTs: '' },
    ];
    const decisions: ReplayDecisionRecord[] = [{
      index: 0, candle: makeCandles(1)[0], decision: 'LONG', confidence: 80,
      riskApproved: true, riskDecision: 'APPROVED', finalR: 0.5,
      positionOpened: true, positionId: 'y', riskVetoReason: null, ts: '',
    }];
    expect(computeDecisionQualityScore(decisions, positions)).toBe(0);
  });

  it('TC-RE34: computeRiskQualityScore: all approved → TP → 100', () => {
    const positions: ReplaySimulatedPosition[] = [
      { positionId: 'z', openIndex: 0, closeIndex: 1, direction: 'LONG', entryPrice: 100,
        stopLoss: 99, takeProfit: 102, exitPrice: 102, realizedR: 2, finalR: 0.5,
        status: 'CLOSED_TP', closeReason: null, openTs: '', closeTs: '' },
    ];
    const decisions: ReplayDecisionRecord[] = [{
      index: 0, candle: makeCandles(1)[0], decision: 'LONG', confidence: 80,
      riskApproved: true, riskDecision: 'APPROVED', finalR: 0.5,
      positionOpened: true, positionId: 'z', riskVetoReason: null, ts: '',
    }];
    expect(computeRiskQualityScore(decisions, positions)).toBe(100);
  });

  it('TC-RE35: computeLifecycleQualityScore: no positions → 100', () => {
    expect(computeLifecycleQualityScore([])).toBe(100);
  });

  it('TC-RE35b: computeLifecycleQualityScore: all OPEN_AT_END → penalized', () => {
    const positions: ReplaySimulatedPosition[] = [
      { positionId: 'a', openIndex: 0, closeIndex: null, direction: 'LONG', entryPrice: 100,
        stopLoss: 99, takeProfit: 102, exitPrice: null, realizedR: 0, finalR: 0.5,
        status: 'OPEN_AT_END', closeReason: null, openTs: '', closeTs: null },
    ];
    expect(computeLifecycleQualityScore(positions)).toBeLessThan(100);
  });

  it('TC-RE36: computeMemoryQualityScore: no actionable decisions → 50', () => {
    const waitOnly: ReplayDecisionRecord[] = [{
      index: 0, candle: makeCandles(1)[0], decision: 'WAIT', confidence: 55,
      riskApproved: false, riskDecision: null, finalR: 0,
      positionOpened: false, positionId: null, riskVetoReason: null, ts: '',
    }];
    expect(computeMemoryQualityScore(waitOnly)).toBe(50);
  });
});

// ── Status transitions ────────────────────────────────────────────────────────

describe('Replay status transitions', () => {
  it('TC-RE37: IDLE → RUNNING → COMPLETED full lifecycle', () => {
    const { session } = createReplaySession({ symbol: 'BTC', timeframe: '4H', candles: makeCandles(3) });
    expect(session!.status).toBe('IDLE');

    const { session: s1 } = stepReplaySession(session!);
    expect(s1.status).toBe('RUNNING');

    const { session: done } = runReplaySession(s1);
    expect(done.status).toBe('COMPLETED');
  });

  it('TC-RE37b: RUNNING → PAUSED → RUNNING → COMPLETED', () => {
    const candles = makeCandles(10);
    const { session } = createReplaySession({ symbol: 'BTC', timeframe: '4H', candles });
    const { session: running } = runReplaySession(session!, 3);
    const { session: paused }  = pauseReplaySession(running);
    expect(paused.status).toBe('PAUSED');
    const { session: done } = runReplaySession(paused);
    expect(done.status).toBe('COMPLETED');
    expect(done.decisions).toHaveLength(10);
  });

  it('TC-RE37c: COMPLETED → IDLE after reset', () => {
    const { session } = createReplaySession({ symbol: 'BTC', timeframe: '4H', candles: makeCandles(2) });
    const { session: done }  = runReplaySession(session!);
    const { session: reset } = resetReplaySession(done);
    expect(reset.status).toBe('IDLE');
  });
});
