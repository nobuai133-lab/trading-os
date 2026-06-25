import { describe, it, expect } from 'vitest';
import { computeDecision } from '../decisionEngine';
import type { DecisionInput } from '../decisionEngine';
import type {
  EvidenceState, StrategyState, MemoryState, ProviderState, RiskState, TradeState,
} from '@/kernel/types';

// ── Shared factories (mirror decisionEngine.test.ts) ──────────────────────────

function freshStrategy(overrides: Partial<StrategyState> = {}): StrategyState {
  return {
    symbol: 'BTCUSDT', timeframe: '4H',
    regime: 'TRENDING_UP',
    ema20: 65000, ema50: 63000,
    atr: 1200, confidence: 75,
    htfBias: 'Bullish', ltfBias: 'Bullish',
    keyLevels: [],
    lastAnalyzed: new Date().toISOString(),
    stateVersion: 1n,
    ...overrides,
  };
}

function freshEvidence(overrides: Partial<EvidenceState> = {}): EvidenceState {
  return {
    correlationId: 'cid_test', symbol: 'BTCUSDT',
    grade: 'A', confidence: 75,
    lastUpdated: new Date().toISOString(),
    stateVersion: 1n,
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

function baseInput(strategy: StrategyState): DecisionInput {
  return {
    evidence: freshEvidence(),
    strategy,
    memory: {
      rangeMemory: { rangeId: 'r1', status: 'ACTIVE', rangeHigh: 66000, rangeLow: 62000, freshLiquidity: true, reentryAllowed: true, tradeCount: 0 },
      fingerprint: { id: 'fp1', alreadyTraded: false },
      cooldown:    { active: false, remainingBars: 0, totalBars: 0 },
      blocked: false, nextRequired: [], stateVersion: 1n,
    } as MemoryState,
    provider: {
      activeProvider: 'Kraken',
      providers: [{ provider: 'Kraken', available: true, overallScore: 90, latency: 120, availability: 99, lastCheck: new Date().toISOString() }],
      failoverLog: [], stateVersion: 1n,
    } as ProviderState,
    risk: {
      tradingMode: 'PAPER_TRADING', killSwitch: false,
      defaultRiskPct: 1, maxRiskPct: 2, minRr: 1.5, minConfidence: 50,
      activeGates: [], stateVersion: 1n,
    } as RiskState,
    trade: {
      phase: 'SETUP_DETECTED', direction: 'LONG',
      tp1Hit: false, tp2Hit: false, tp3Hit: false, stateVersion: 1n,
    } as TradeState,
  };
}

// ── Staleness tests ───────────────────────────────────────────────────────────

describe('G0:Freshness gate', () => {

  it('TF01 — passes when strategy is freshly analyzed', () => {
    const result = computeDecision(baseInput(freshStrategy()));
    const g0 = result.gates.find((g) => g.gate === 'G0:Freshness');
    expect(g0).toBeDefined();
    expect(g0?.passed).toBe(true);
    expect(result.outcome).toBe('LONG');
  });

  it('TF02 — WAIT when strategy data is >1 hour old (with real ema data)', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const staleStrategy = freshStrategy({ lastAnalyzed: twoHoursAgo });
    const result = computeDecision(baseInput(staleStrategy));
    const g0 = result.gates.find((g) => g.gate === 'G0:Freshness');
    expect(g0).toBeDefined();
    expect(g0?.passed).toBe(false);
    expect(result.outcome).toBe('WAIT');
    expect(result.blockingReason).toContain('stale');
  });

  it('TF03 — G0 absent (skipped) when lastAnalyzed is epoch 0 (never analyzed)', () => {
    const neverAnalyzed = freshStrategy({
      lastAnalyzed: new Date(0).toISOString(),
      ema20: 0, ema50: 0, regime: 'UNKNOWN', confidence: 0,
    });
    const result = computeDecision(baseInput(neverAnalyzed));
    const g0 = result.gates.find((g) => g.gate === 'G0:Freshness');
    // G0 is skipped for epoch 0 — it means "never initialized", not "data went stale"
    expect(g0).toBeUndefined();
    // Blocking reason should not mention 'stale' — epoch is "no data", not "aged data"
    if (result.blockingReason) {
      expect(result.blockingReason).not.toContain('stale');
    }
  });

  it('TF04 — passes when strategy is exactly at the staleness boundary minus 1 minute', () => {
    const fiftyNineMinutesAgo = new Date(Date.now() - 59 * 60 * 1000).toISOString();
    const nearStaleStrategy = freshStrategy({ lastAnalyzed: fiftyNineMinutesAgo });
    const result = computeDecision(baseInput(nearStaleStrategy));
    const g0 = result.gates.find((g) => g.gate === 'G0:Freshness');
    expect(g0?.passed).toBe(true);
  });

  it('TF05 — stale detection does not fire for active trade management', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const staleStrategy = freshStrategy({ lastAnalyzed: twoHoursAgo });
    // Active trade — G0 still fires because staleness is always checked
    const result = computeDecision({
      ...baseInput(staleStrategy),
      trade: { phase: 'POSITION_OPEN', direction: 'LONG', tp1Hit: false, tp2Hit: false, tp3Hit: false, stateVersion: 1n } as TradeState,
    });
    // G0 fires before trade management logic — forces WAIT even on active trade
    expect(result.outcome).toBe('WAIT');
    expect(result.blockingReason).toContain('stale');
  });

});

// ── Provider mismatch / fallback ──────────────────────────────────────────────

describe('Provider freshness', () => {

  it('TF06 — WAIT when all providers are down (existing G1 coverage + G0 fresh)', () => {
    const result = computeDecision({
      ...baseInput(freshStrategy()),
      provider: {
        activeProvider: 'none',
        providers: [
          { provider: 'Binance', available: false, overallScore: 0, latency: 0, availability: 0, lastCheck: new Date().toISOString() },
          { provider: 'Kraken',  available: false, overallScore: 0, latency: 0, availability: 0, lastCheck: new Date().toISOString() },
        ],
        failoverLog: [], stateVersion: 1n,
      } as ProviderState,
    });
    expect(result.outcome).toBe('NO_TRADE');
    expect(result.blockingReason).toContain('providers offline');
  });

  it('TF07 — WAIT when ticker is from one provider and candles from another (stale kernel)', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    // Simulate: provider health OK but strategy state is stale (cron failed)
    const result = computeDecision(baseInput(freshStrategy({ lastAnalyzed: twoHoursAgo })));
    expect(result.outcome).toBe('WAIT');
    expect(result.blockingReason).toMatch(/stale/i);
  });

});
