import { describe, it, expect } from 'vitest';
import {
  computePortfolioMetrics,
  computeRiskCooldown,
  computeRiskOffice,
  DEFAULT_RISK_BUDGET,
  type RiskOfficeInput,
} from '@/lib/riskOfficeEngine';
import type { TradeMemoryRecord, RiskBudget, DecisionResult, SimilarityResult } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function rec(overrides: Partial<TradeMemoryRecord> & { id?: string; hoursAgo?: number; dayAgo?: number }): TradeMemoryRecord {
  const offsetMs = overrides.hoursAgo != null
    ? overrides.hoursAgo * 3_600_000
    : overrides.dayAgo != null
      ? overrides.dayAgo * 86_400_000
      : 3_600_000;

  const base: TradeMemoryRecord = {
    tradeId:               overrides.id ?? 't1',
    decisionId:            'd1',
    symbol:                'BTCUSDT',
    timeframe:             '4H',
    regime:                'TRENDING_UP',
    provider:              'binance',
    htfBias:               'BULL',
    ltfBias:               'BULL',
    evidenceGrade:         'A',
    evidenceConfidence:    80,
    evidenceCategories:    [],
    decisionOutcome:       'LONG',
    decisionConfidence:    85,
    decisionWeightedScore: 70,
    direction:             'LONG',
    grade:                 'A',
    rr:                    2.5,
    riskPct:               1.0,
    entry:                 65000,
    sl:                    64000,
    tp1:                   66500,
    tp2:                   68000,
    tp3:                   70000,
    exit:                  66500,
    outcome:               'WIN',
    resultR:               1.5,
    closeReason:           'TP1_HIT',
    openedAt:              new Date(Date.now() - offsetMs - 1800_000).toISOString(),
    closedAt:              new Date(Date.now() - offsetMs).toISOString(),
    durationMs:            1_800_000,
    fingerprint: {
      trend: 'BULL', emaAlignment: 'ALIGNED', htfBias: 'BULL', ltfBias: 'BULL',
      liquiditySweep: true, rangeAcceptance: true, atRangeExtreme: false, hasRetest: false,
      momentum: 'STRONG', volume: 'UNAVAILABLE', rrBucket: 'HIGH', gradeBucket: 'A',
      riskBucket: 'LOW', provider: 'binance', timeframe: '4H', regime: 'TRENDING_UP',
      direction: 'LONG', hash: 'abc123',
    },
    dna: ['TREND_BULL', 'EMA_ALIGNED', 'DIR_LONG'],
    dnaHash: 'abc123456789',
    confidenceBefore: 85,
    confidenceAfter:  90,
    lessons: [],
    tags:    [],
  };
  const { id: _id, hoursAgo: _h, dayAgo: _d, ...rest } = overrides;
  return { ...base, ...rest };
}

function decision(confidence: number, outcome = 'LONG'): DecisionResult {
  return {
    outcome:        outcome as DecisionResult['outcome'],
    confidence,
    weightedScore:  65,
    maxScore:       95,
    weights:        [],
    gates:          [],
    blockingReason: null,
    topSupporting:  [],
    topOpposing:    [],
    nextAction:     'Enter long',
    computedAt:     new Date().toISOString(),
  };
}

function noCooldown() {
  return { active: false, reason: null, type: null, endsAt: null, remainingMinutes: 0 } as const;
}

function input(overrides: Partial<RiskOfficeInput> = {}): RiskOfficeInput {
  return {
    metrics:         computePortfolioMetrics([]),
    budget:          { ...DEFAULT_RISK_BUDGET },
    decision:        decision(92),
    similarity:      null,
    cooldown:        noCooldown(),
    providerHealthy: true,
    kernelHealthy:   true,
    openPositions:   0,
    ...overrides,
  };
}

// ── computePortfolioMetrics ───────────────────────────────────────────────────

describe('computePortfolioMetrics', () => {
  it('PM-01: empty records → all zeros', () => {
    const m = computePortfolioMetrics([]);
    expect(m.dailyPnlR).toBe(0);
    expect(m.dailyLossR).toBe(0);
    expect(m.consecutiveLosses).toBe(0);
    expect(m.consecutiveWins).toBe(0);
    expect(m.tradeCountToday).toBe(0);
  });

  it('PM-02: daily loss from same-day records', () => {
    const r1 = rec({ id: 't1', outcome: 'LOSS', resultR: -1.5, hoursAgo: 1 });
    const r2 = rec({ id: 't2', outcome: 'LOSS', resultR: -1.0, hoursAgo: 2 });
    const m  = computePortfolioMetrics([r1, r2]);
    expect(m.dailyLossR).toBeCloseTo(2.5);
    expect(m.dailyPnlR).toBeCloseTo(-2.5);
    expect(m.tradeCountToday).toBe(2);
  });

  it('PM-03: excludes yesterday from daily metric', () => {
    const r = rec({ id: 't1', outcome: 'LOSS', resultR: -2.0, dayAgo: 1.5 });
    const m = computePortfolioMetrics([r]);
    expect(m.dailyLossR).toBe(0);
    expect(m.tradeCountToday).toBe(0);
  });

  it('PM-04: weekly loss spans multiple days', () => {
    const r1 = rec({ id: 't1', outcome: 'LOSS', resultR: -2, dayAgo: 2 });
    const r2 = rec({ id: 't2', outcome: 'LOSS', resultR: -3, dayAgo: 3 });
    const m  = computePortfolioMetrics([r1, r2]);
    expect(m.weeklyLossR).toBeCloseTo(5);
  });

  it('PM-05: consecutive losses counted from most recent', () => {
    const records = [
      rec({ id: 't1', outcome: 'LOSS', resultR: -1, hoursAgo: 1 }),
      rec({ id: 't2', outcome: 'LOSS', resultR: -1, hoursAgo: 2 }),
      rec({ id: 't3', outcome: 'WIN',  resultR:  2, hoursAgo: 3 }),
    ];
    const m = computePortfolioMetrics(records);
    expect(m.consecutiveLosses).toBe(2);
    expect(m.consecutiveWins).toBe(0);
  });

  it('PM-06: consecutive wins counted from most recent', () => {
    const records = [
      rec({ id: 't1', outcome: 'WIN',  resultR: 1.5, hoursAgo: 1 }),
      rec({ id: 't2', outcome: 'WIN',  resultR: 2.0, hoursAgo: 2 }),
      rec({ id: 't3', outcome: 'WIN',  resultR: 1.0, hoursAgo: 3 }),
      rec({ id: 't4', outcome: 'LOSS', resultR: -1,  hoursAgo: 4 }),
    ];
    const m = computePortfolioMetrics(records);
    expect(m.consecutiveWins).toBe(3);
    expect(m.consecutiveLosses).toBe(0);
  });

  it('PM-07: BREAK_EVEN resets streak', () => {
    const records = [
      rec({ id: 't1', outcome: 'LOSS',       resultR: -1, hoursAgo: 1 }),
      rec({ id: 't2', outcome: 'BREAK_EVEN', resultR:  0, hoursAgo: 2 }),
      rec({ id: 't3', outcome: 'LOSS',       resultR: -1, hoursAgo: 3 }),
    ];
    const m = computePortfolioMetrics(records);
    expect(m.consecutiveLosses).toBe(1); // only t1, stopped at BE
  });
});

// ── computeRiskCooldown ───────────────────────────────────────────────────────

describe('computeRiskCooldown', () => {
  it('CD-01: no records → no cooldown', () => {
    const cd = computeRiskCooldown([], DEFAULT_RISK_BUDGET);
    expect(cd.active).toBe(false);
  });

  it('CD-02: recent loss → loss cooldown active', () => {
    const r  = rec({ id: 't1', outcome: 'LOSS', hoursAgo: 0.15 }); // 9 min ago
    const cd = computeRiskCooldown([r], DEFAULT_RISK_BUDGET);
    expect(cd.active).toBe(true);
    expect(cd.type).toBe('LOSS');
    expect(cd.remainingMinutes).toBeGreaterThan(0);
    expect(cd.remainingMinutes).toBeLessThanOrEqual(30);
  });

  it('CD-03: expired loss cooldown → not active', () => {
    const r  = rec({ id: 't1', outcome: 'LOSS', hoursAgo: 1 }); // 60 min > 30 min limit
    const cd = computeRiskCooldown([r], DEFAULT_RISK_BUDGET);
    expect(cd.active).toBe(false);
  });

  it('CD-04: win streak at max → win cooldown active', () => {
    const budget: RiskBudget = { ...DEFAULT_RISK_BUDGET, maxConsecutiveWins: 3, cooldownAfterWinMin: 15 };
    const records = [
      rec({ id: 't1', outcome: 'WIN', hoursAgo: 0.05 }),
      rec({ id: 't2', outcome: 'WIN', hoursAgo: 1 }),
      rec({ id: 't3', outcome: 'WIN', hoursAgo: 2 }),
    ];
    const cd = computeRiskCooldown(records, budget);
    expect(cd.active).toBe(true);
    expect(cd.type).toBe('WIN');
  });

  it('CD-05: win cooldown does not fire below max consecutive', () => {
    const budget: RiskBudget = { ...DEFAULT_RISK_BUDGET, maxConsecutiveWins: 3, cooldownAfterWinMin: 15 };
    const records = [
      rec({ id: 't1', outcome: 'WIN', hoursAgo: 0.05 }),
      rec({ id: 't2', outcome: 'WIN', hoursAgo: 1 }),
    ];
    const cd = computeRiskCooldown(records, budget);
    expect(cd.active).toBe(false);
  });
});

// ── computeRiskOffice ─────────────────────────────────────────────────────────

describe('computeRiskOffice', () => {
  it('RO-01: approves healthy trade with good confidence', () => {
    const r = computeRiskOffice(input());
    expect(r.decision).toBe('APPROVED');
    expect(r.riskState).toBe('NORMAL');
    expect(r.killSwitchActive).toBe(false);
    expect(r.positionSize.finalR).toBeGreaterThan(0);
  });

  it('RO-02: confidence ≥95% → 1.0R base', () => {
    const r = computeRiskOffice(input({ decision: decision(96) }));
    expect(r.positionSize.baseR).toBe(1.0);
    expect(r.positionSize.finalR).toBe(1.0);
  });

  it('RO-03: confidence 90–94% → 0.75R base', () => {
    const r = computeRiskOffice(input({ decision: decision(92) }));
    expect(r.positionSize.baseR).toBe(0.75);
  });

  it('RO-04: confidence 80–89% → 0.5R base', () => {
    const r = computeRiskOffice(input({ decision: decision(85) }));
    expect(r.positionSize.baseR).toBe(0.5);
  });

  it('RO-05: confidence 70–79% → 0.25R base', () => {
    const r = computeRiskOffice(input({ decision: decision(75) }));
    expect(r.positionSize.baseR).toBe(0.25);
  });

  it('RO-06: confidence <70% → BLOCKED (0R)', () => {
    const r = computeRiskOffice(input({ decision: decision(65) }));
    expect(r.decision).toBe('BLOCKED');
    expect(r.positionSize.finalR).toBe(0);
    expect(r.vetos.some((v) => v.code === 'BLOCK_LOW_CONF')).toBe(true);
  });

  it('RO-07: daily loss limit → kill switch BLOCKED', () => {
    const metrics = computePortfolioMetrics([
      rec({ id: 't1', outcome: 'LOSS', resultR: -3.5, hoursAgo: 1 }),
    ]);
    const r = computeRiskOffice(input({ metrics }));
    expect(r.decision).toBe('BLOCKED');
    expect(r.killSwitchActive).toBe(true);
    expect(r.killSwitchReasons.some((s) => s.includes('Daily loss'))).toBe(true);
  });

  it('RO-08: weekly loss limit → kill switch BLOCKED', () => {
    const records = Array.from({ length: 4 }, (_, i) =>
      rec({ id: `t${i}`, outcome: 'LOSS', resultR: -2.5, dayAgo: 2 }),
    );
    const metrics = computePortfolioMetrics(records);
    const r = computeRiskOffice(input({ metrics }));
    expect(r.killSwitchActive).toBe(true);
    expect(r.killSwitchReasons.some((s) => s.includes('Weekly loss'))).toBe(true);
  });

  it('RO-09: consecutive losses limit → kill switch BLOCKED', () => {
    const records = [
      rec({ id: 't1', outcome: 'LOSS', resultR: -1, hoursAgo: 1 }),
      rec({ id: 't2', outcome: 'LOSS', resultR: -1, hoursAgo: 2 }),
      rec({ id: 't3', outcome: 'LOSS', resultR: -1, hoursAgo: 3 }),
    ];
    const metrics = computePortfolioMetrics(records);
    const r = computeRiskOffice(input({ metrics }));
    expect(r.decision).toBe('BLOCKED');
    expect(r.killSwitchActive).toBe(true);
    expect(r.killSwitchReasons.some((s) => s.includes('consecutive losses'))).toBe(true);
  });

  it('RO-10: provider down → BLOCKED', () => {
    const r = computeRiskOffice(input({ providerHealthy: false }));
    expect(r.decision).toBe('BLOCKED');
    expect(r.killSwitchActive).toBe(true);
    expect(r.vetos.some((v) => v.code === 'KS_PROVIDER')).toBe(true);
  });

  it('RO-11: kernel unhealthy → EMERGENCY_STOP', () => {
    const r = computeRiskOffice(input({ kernelHealthy: false }));
    expect(r.riskState).toBe('EMERGENCY_STOP');
    expect(r.decision).toBe('BLOCKED');
  });

  it('RO-12: two kill switch conditions → EMERGENCY_STOP', () => {
    // daily loss AND kernel down
    const metrics = computePortfolioMetrics([
      rec({ id: 't1', outcome: 'LOSS', resultR: -4, hoursAgo: 1 }),
    ]);
    const r = computeRiskOffice(input({ metrics, kernelHealthy: false }));
    expect(r.riskState).toBe('EMERGENCY_STOP');
  });

  it('RO-13: active cooldown → BLOCKED', () => {
    const cooldown = {
      active: true,
      reason: 'Loss cooldown — 20m remaining',
      type:   'LOSS' as const,
      endsAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      remainingMinutes: 20,
    };
    const r = computeRiskOffice(input({ cooldown }));
    expect(r.decision).toBe('BLOCKED');
    expect(r.vetos.some((v) => v.code === 'BLOCK_COOLDOWN')).toBe(true);
  });

  it('RO-14: NO_TRADE outcome → BLOCKED', () => {
    const r = computeRiskOffice(input({ decision: decision(85, 'NO_TRADE') }));
    expect(r.decision).toBe('BLOCKED');
    expect(r.vetos.some((v) => v.code === 'BLOCK_NO_TRADE')).toBe(true);
  });

  it('RO-15: WAIT outcome → BLOCKED', () => {
    const r = computeRiskOffice(input({ decision: decision(82, 'WAIT') }));
    expect(r.decision).toBe('BLOCKED');
    expect(r.vetos.some((v) => v.code === 'BLOCK_WAIT')).toBe(true);
  });

  it('RO-16: negative memory edge → REDUCED with ×0.75 multiplier', () => {
    const similarity: SimilarityResult = {
      winningSimilarity: 30, losingSimilarity: 60,
      nearestWinner: null, nearestLoser: null,
      topWinners: [], topLosers: [], sampleSize: 5,
      similarityConfidence: 70, calibratedDecisionConfidence: 80, warnings: [],
    };
    const r = computeRiskOffice(input({ decision: decision(96), similarity }));
    // baseR=1.0, memMult=0.75, stateMult=1.0 → rawFinalR=0.75
    expect(r.positionSize.memoryEdgeMultiplier).toBe(0.75);
    expect(r.decision).toBe('REDUCED');
    expect(r.positionSize.finalR).toBeCloseTo(0.75);
  });

  it('RO-17: daily budget ≥70% consumed → CAUTION, size reduced', () => {
    // 2.2R / 3.0R max = 73% used
    const metrics = computePortfolioMetrics([
      rec({ id: 't1', outcome: 'LOSS', resultR: -2.2, hoursAgo: 1 }),
    ]);
    const r = computeRiskOffice(input({ metrics }));
    expect(r.riskState).toBe('CAUTION');
    expect(r.positionSize.riskStateMultiplier).toBe(0.75);
  });

  it('RO-18: consecutive wins at max → WARN_OVERCONF veto', () => {
    const records = Array.from({ length: 6 }, (_, i) =>
      rec({ id: `t${i}`, outcome: 'WIN', resultR: 1.5, hoursAgo: i + 1 }),
    );
    const metrics = computePortfolioMetrics(records);
    const r = computeRiskOffice(input({ metrics }));
    expect(r.vetos.some((v) => v.code === 'WARN_OVERCONF')).toBe(true);
  });

  it('RO-19: max concurrent positions → BLOCKED', () => {
    const r = computeRiskOffice(input({ openPositions: 2 }));
    expect(r.decision).toBe('BLOCKED');
    expect(r.vetos.some((v) => v.code === 'BLOCK_EXPOSURE')).toBe(true);
  });

  it('RO-20: null decision → BLOCKED', () => {
    const r = computeRiskOffice(input({ decision: null }));
    expect(r.decision).toBe('BLOCKED');
    expect(r.vetos.some((v) => v.code === 'BLOCK_NO_DECISION')).toBe(true);
  });

  it('RO-21: high confidence + strong memory edge → APPROVED at 1.0R', () => {
    const similarity: SimilarityResult = {
      winningSimilarity: 85, losingSimilarity: 20,
      nearestWinner: null, nearestLoser: null,
      topWinners: [], topLosers: [], sampleSize: 10,
      similarityConfidence: 90, calibratedDecisionConfidence: 95, warnings: [],
    };
    const r = computeRiskOffice(input({ decision: decision(96), similarity }));
    // edge=65 >20 → memMult=1.0, baseR=1.0, stateMult=1.0
    expect(r.decision).toBe('APPROVED');
    expect(r.positionSize.finalR).toBe(1.0);
    expect(r.positionSize.memoryEdgeMultiplier).toBe(1.0);
  });
});
