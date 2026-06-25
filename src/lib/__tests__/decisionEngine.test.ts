import { describe, it, expect } from 'vitest';
import { computeDecision } from '../decisionEngine';
import type { DecisionInput } from '../decisionEngine';
import type {
  EvidenceState, StrategyState, MemoryState, ProviderState, RiskState, TradeState,
} from '@/kernel/types';

// ── Factories ─────────────────────────────────────────────────────────────────

function makeEvidence(overrides: Partial<EvidenceState> = {}): EvidenceState {
  return {
    correlationId: 'cid_test',
    symbol:        'BTCUSDT',
    grade:         'A',
    confidence:    75,
    lastUpdated:   new Date().toISOString(),
    stateVersion:  1n,
    categories: [
      { name: 'Market Structure', score: 20, present: true },
      { name: 'Range Context',    score: 20, present: true },
      { name: 'Liquidity',        score: 20, present: true },
      { name: 'Risk / Reward',    score: 20, present: true },
      { name: 'Regime Alignment', score: 20, present: true },
    ],
    ...overrides,
  };
}

function makeStrategy(overrides: Partial<StrategyState> = {}): StrategyState {
  return {
    symbol:       'BTCUSDT',
    timeframe:    '4H',
    regime:       'TRENDING_UP',
    ema20:        65000,
    ema50:        63000,   // spread = 3.17% > 1% → Momentum present
    atr:          1200,
    confidence:   75,
    htfBias:      'Bullish',
    ltfBias:      'Bullish',
    keyLevels:    [],
    lastAnalyzed: new Date().toISOString(),
    stateVersion: 1n,
    ...overrides,
  };
}

function makeMemory(overrides: Partial<MemoryState> = {}): MemoryState {
  return {
    rangeMemory: {
      rangeId:       'range_1',
      status:        'ACTIVE',
      rangeHigh:     66000,
      rangeLow:      62000,
      freshLiquidity: true,
      reentryAllowed: true,
      tradeCount:    0,
    },
    fingerprint: { id: 'fp_1', alreadyTraded: false },
    cooldown:    { active: false, remainingBars: 0, totalBars: 0 },
    blocked:     false,
    nextRequired: [],
    stateVersion: 1n,
    ...overrides,
  };
}

function makeProvider(overrides: Partial<ProviderState> = {}): ProviderState {
  return {
    activeProvider: 'Kraken',
    providers: [
      { provider: 'Kraken', available: true, overallScore: 90, latency: 120, availability: 99, lastCheck: new Date().toISOString() },
    ],
    failoverLog:  [],
    stateVersion: 1n,
    ...overrides,
  };
}

function makeRisk(overrides: Partial<RiskState> = {}): RiskState {
  return {
    tradingMode:    'PAPER_TRADING',
    killSwitch:     false,
    defaultRiskPct: 1,
    maxRiskPct:     2,
    minRr:          1.5,
    minConfidence:  50,
    activeGates:    [],
    stateVersion:   1n,
    ...overrides,
  };
}

function makeTrade(overrides: Partial<TradeState> = {}): TradeState {
  return {
    phase:        'SETUP_DETECTED',
    tp1Hit:       false,
    tp2Hit:       false,
    tp3Hit:       false,
    stateVersion: 1n,
    direction:    'LONG',
    ...overrides,
  };
}

function makeInput(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    evidence: makeEvidence(),
    strategy: makeStrategy(),
    memory:   makeMemory(),
    provider: makeProvider(),
    risk:     makeRisk(),
    trade:    makeTrade(),
    ...overrides,
  };
}

// ── Test cases ────────────────────────────────────────────────────────────────

describe('computeDecision', () => {

  it('TC01 — LONG: all gates pass, direction LONG', () => {
    const result = computeDecision(makeInput({ trade: makeTrade({ direction: 'LONG' }) }));
    expect(result.outcome).toBe('LONG');
    expect(result.confidence).toBeGreaterThan(50);
    expect(result.blockingReason).toBeNull();
    expect(result.gates.every((g) => g.passed)).toBe(true);
  });

  it('TC02 — SHORT: all gates pass, direction SHORT', () => {
    const result = computeDecision(makeInput({
      trade:    makeTrade({ direction: 'SHORT' }),
      strategy: makeStrategy({ regime: 'TRENDING_DOWN', ema20: 63000, ema50: 65000, htfBias: 'Bearish', ltfBias: 'Bearish' }),
    }));
    expect(result.outcome).toBe('SHORT');
    expect(result.blockingReason).toBeNull();
  });

  it('TC03 — NO_TRADE: evidence grade D', () => {
    const result = computeDecision(makeInput({
      evidence: makeEvidence({ grade: 'D', confidence: 60 }),
    }));
    expect(result.outcome).toBe('NO_TRADE');
    expect(result.blockingReason).toContain('grade D');
    expect(result.gates.find((g) => g.gate === 'G2:Grade')?.passed).toBe(false);
  });

  it('TC04 — NO_TRADE: kill switch active', () => {
    const result = computeDecision(makeInput({ risk: makeRisk({ killSwitch: true }) }));
    expect(result.outcome).toBe('NO_TRADE');
    expect(result.blockingReason).toContain('Kill switch');
    expect(result.gates.find((g) => g.gate === 'G4:KillSwitch')?.passed).toBe(false);
  });

  it('TC05 — NO_TRADE: fingerprint already traded', () => {
    const result = computeDecision(makeInput({
      memory: makeMemory({ fingerprint: { id: 'fp_1', alreadyTraded: true } }),
    }));
    expect(result.outcome).toBe('NO_TRADE');
    expect(result.blockingReason).toContain('fingerprint');
  });

  it('TC06 — WAIT: cooldown active (memory blocked)', () => {
    const result = computeDecision(makeInput({
      memory: makeMemory({
        blocked:     true,
        blockReason: 'Cooldown active',
        cooldown:    { active: true, remainingBars: 3, totalBars: 10 },
      }),
    }));
    expect(result.outcome).toBe('WAIT');
    expect(result.blockingReason).toContain('Cooldown');
  });

  it('TC07 — WAIT: confidence below 30', () => {
    const result = computeDecision(makeInput({
      evidence: makeEvidence({ grade: 'C', confidence: 20 }),
    }));
    expect(result.outcome).toBe('WAIT');
    expect(result.gates.find((g) => g.gate === 'G3:Confidence')?.passed).toBe(false);
  });

  it('TC08 — WAIT: range stale', () => {
    const result = computeDecision(makeInput({
      memory: makeMemory({
        rangeMemory: {
          rangeId: 'range_1', status: 'STALE',
          rangeHigh: 66000, rangeLow: 62000,
          freshLiquidity: false, reentryAllowed: false, tradeCount: 2,
        },
      }),
    }));
    expect(result.outcome).toBe('WAIT');
    expect(result.blockingReason).toContain('stale');
  });

  it('TC09 — HOLD: active trade, no TPs hit', () => {
    const result = computeDecision(makeInput({
      trade: makeTrade({
        phase:  'POSITION_OPEN',
        tp1Hit: false, tp2Hit: false, tp3Hit: false,
      }),
    }));
    expect(result.outcome).toBe('HOLD');
    expect(result.blockingReason).toBeNull();
  });

  it('TC10 — REDUCE_POSITION: active trade, TP3 hit', () => {
    const result = computeDecision(makeInput({
      trade: makeTrade({
        phase:  'TP3_REACHED',
        tp1Hit: true, tp2Hit: true, tp3Hit: true,
      }),
    }));
    expect(result.outcome).toBe('REDUCE_POSITION');
  });

  it('TC11 — NO_TRADE: all providers down', () => {
    const result = computeDecision(makeInput({
      provider: makeProvider({
        providers: [
          { provider: 'Kraken', available: false, overallScore: 0, latency: 0, availability: 0, lastCheck: new Date().toISOString() },
          { provider: 'Binance', available: false, overallScore: 0, latency: 0, availability: 0, lastCheck: new Date().toISOString() },
        ],
      }),
    }));
    expect(result.outcome).toBe('NO_TRADE');
    expect(result.blockingReason).toContain('providers offline');
  });

  it('TC12 — READY: grade B, no direction set (WAIT_CONFIRMATION mode)', () => {
    const result = computeDecision(makeInput({
      evidence: makeEvidence({ grade: 'B', confidence: 55 }),
      trade:    makeTrade({ phase: 'WAIT_CONFIRMATION', direction: undefined }),
    }));
    expect(result.outcome).toBe('READY');
    expect(result.blockingReason).toBeNull();
  });

  // DE-01: WATCHLIST tier → WAIT (G9.6 gate)
  it('DE-01 — WAIT: WATCHLIST tier blocks trade decision', () => {
    const result = computeDecision(makeInput({
      setupTier: 'WATCHLIST',
    }));
    expect(result.outcome).toBe('WAIT');
    expect(result.blockingReason).toContain('WATCHLIST');
    expect(result.gates.find((g) => g.gate === 'G9.6:PriorityTier')?.passed).toBe(false);
  });

  // DE-02: INVALID tier → WAIT (G9.6 gate)
  it('DE-02 — WAIT: INVALID tier blocks trade decision', () => {
    const result = computeDecision(makeInput({
      setupTier: 'INVALID',
    }));
    expect(result.outcome).toBe('WAIT');
    expect(result.blockingReason).toContain('INVALID');
  });

  // DE-03: PRIMARY tier → gate passes, LONG proceeds
  it('DE-03 — LONG: PRIMARY tier passes G9.6', () => {
    const result = computeDecision(makeInput({
      setupTier:   'PRIMARY',
      setupIntent: 'TREND_CONTINUATION',
    }));
    expect(result.outcome).toBe('LONG');
    expect(result.gates.find((g) => g.gate === 'G9.6:PriorityTier')?.passed).toBe(true);
  });

  // DE-04: no tier provided → gate passes (backward compatible)
  it('DE-04 — gate passes when setupTier is absent (backward compat)', () => {
    const result = computeDecision(makeInput());
    expect(result.outcome).toBe('LONG');
    expect(result.gates.find((g) => g.gate === 'G9.6:PriorityTier')?.passed).toBe(true);
  });

  // DE-05: SECONDARY tier → gate passes but result is WAIT (no full LONG)
  it('DE-05 — SECONDARY tier passes gate but stays LONG (direction still set)', () => {
    const result = computeDecision(makeInput({ setupTier: 'SECONDARY' }));
    // SECONDARY passes the gate; direction determines outcome
    expect(result.gates.find((g) => g.gate === 'G9.6:PriorityTier')?.passed).toBe(true);
    expect(result.outcome).toBe('LONG');  // direction=LONG still produces LONG for SECONDARY
  });

});
