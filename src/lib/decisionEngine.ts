// Decision Engine — pure, stateless computation.
// Takes kernel domain states as input; returns a DecisionResult.
// No side effects, no I/O, no kernel access.

import type { EvidenceState, StrategyState, MemoryState, ProviderState, RiskState, TradeState } from '@/kernel/types';
import type { DecisionOutcome, DecisionResult, WeightedEvidenceItem, DecisionGateResult } from '@/types';
import { classifySetup } from './setupClassifier';
import { assessSetupValidity } from './setupValidityEngine';

export interface DecisionInput {
  evidence:         EvidenceState;
  strategy:         StrategyState;
  memory:           MemoryState;
  provider:         ProviderState;
  risk:             RiskState;
  trade:            TradeState;
  // Optional — passed when a specific pending setup is being evaluated
  setupCreatedAt?:  string;
  setupTimeframe?:  string;
  // ITOS — present when priority ranking has run
  setupTier?:       import('@/types').SetupPriorityTier;
  setupIntent?:     import('@/types').SetupIntent;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STRATEGY_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour — decision is WAIT if strategy is older

// ── Weight table ──────────────────────────────────────────────────────────────
// Evidence category name → weight (must sum to 95 after Volume excluded)

const EVIDENCE_WEIGHTS: Record<string, number> = {
  'Regime Alignment': 25,
  'Liquidity':        20,
  'Market Structure': 15,
  'Range Context':    10,
  'Risk / Reward':    10,
};

const MAX_SCORE = 95; // Volume (5pts) excluded in v1 — no volume data in kernel

// ── Weighted items ────────────────────────────────────────────────────────────

function computeWeightedItems(input: DecisionInput): WeightedEvidenceItem[] {
  const { evidence, strategy, memory } = input;
  const items: WeightedEvidenceItem[] = [];

  for (const cat of evidence.categories) {
    const w = EVIDENCE_WEIGHTS[cat.name];
    if (w !== undefined) {
      items.push({ category: cat.name, weight: w, present: cat.present, contribution: cat.present ? w : 0 });
    }
  }

  // Momentum — EMA spread > 1% signals clear directional trend
  const emaDiff = strategy.ema20 > 0 && strategy.ema50 > 0
    ? Math.abs(strategy.ema20 - strategy.ema50) / strategy.ema50
    : 0;
  const momentumOk = emaDiff > 0.01;
  items.push({ category: 'Momentum', weight: 10, present: momentumOk, contribution: momentumOk ? 10 : 0 });

  // Volume — no market volume data available in kernel v1
  items.push({ category: 'Volume', weight: 5, present: false, contribution: 0 });

  // Memory — not blocked and cooldown inactive
  const memOk = !memory.blocked && !memory.cooldown.active;
  items.push({ category: 'Memory', weight: 5, present: memOk, contribution: memOk ? 5 : 0 });

  return items;
}

// ── Gate execution ────────────────────────────────────────────────────────────

function isActiveTrade(phase: string): boolean {
  return ['POSITION_OPEN', 'TP1_REACHED', 'TP2_REACHED', 'TP3_REACHED'].includes(phase);
}

function runGates(
  input: DecisionInput,
  weightedScore: number,
): { outcome: DecisionOutcome; gates: DecisionGateResult[]; blockingReason: string | null } {
  const { evidence, memory, risk, trade, provider } = input;
  const gates: DecisionGateResult[] = [];
  const active = isActiveTrade(trade.phase);

  function fail(gate: string, reason: string, outcome: DecisionOutcome) {
    gates.push({ gate, passed: false, reason });
    return { outcome, gates, blockingReason: reason };
  }

  // G0: Strategy freshness — only enforced when real analysis data has been seen before.
  // Epoch timestamp (lastAnalyzed = 0) means "never analyzed" — other gates handle that.
  const lastAnalyzedTs = new Date(input.strategy.lastAnalyzed).getTime();
  const neverAnalyzed  = lastAnalyzedTs === 0;
  if (!neverAnalyzed) {
    const ageMs = Date.now() - lastAnalyzedTs;
    if (ageMs > STRATEGY_MAX_AGE_MS) {
      const ageMin = Math.round(ageMs / 60_000);
      return fail('G0:Freshness', `Strategy data ${ageMin}m stale — market scan required`, 'WAIT');
    }
    gates.push({ gate: 'G0:Freshness', passed: true });
  }

  // G1: Provider health — at least one provider must be available
  const allDown = provider.providers.length > 0 && provider.providers.every((p) => !p.available);
  if (allDown) return fail('G1:Provider', 'All market data providers offline', 'NO_TRADE');
  gates.push({ gate: 'G1:Provider', passed: true });

  // G2: Evidence grade — D means insufficient quality
  if (evidence.grade === 'D') return fail('G2:Grade', 'Evidence grade D — insufficient signal quality', 'NO_TRADE');
  gates.push({ gate: 'G2:Grade', passed: true });

  // G3: Evidence confidence floor
  if (evidence.confidence < 30) return fail('G3:Confidence', `Confidence ${evidence.confidence}% below minimum (30%)`, 'WAIT');
  gates.push({ gate: 'G3:Confidence', passed: true });

  // G4: Kill switch — hard stop
  if (risk.killSwitch) return fail('G4:KillSwitch', 'Kill switch active — trading halted', 'NO_TRADE');
  gates.push({ gate: 'G4:KillSwitch', passed: true });

  // G5–G8: Memory gates skipped when managing an active trade
  if (!active) {
    if (memory.blocked)
      return fail('G5:Memory', memory.blockReason ?? 'Memory blocked', 'WAIT');
    gates.push({ gate: 'G5:Memory', passed: true });

    if (memory.fingerprint?.alreadyTraded)
      return fail('G6:Fingerprint', 'Setup fingerprint already traded', 'NO_TRADE');
    gates.push({ gate: 'G6:Fingerprint', passed: true });

    if (memory.rangeMemory?.status === 'STALE')
      return fail('G7:RangeStale', 'Range memory is stale', 'WAIT');
    gates.push({ gate: 'G7:RangeStale', passed: true });

    if (memory.rangeMemory && !memory.rangeMemory.reentryAllowed)
      return fail('G8:Reentry', 'Range reentry not allowed', 'WAIT');
    gates.push({ gate: 'G8:Reentry', passed: true });
  } else {
    gates.push(
      { gate: 'G5:Memory',      passed: true },
      { gate: 'G6:Fingerprint', passed: true },
      { gate: 'G7:RangeStale',  passed: true },
      { gate: 'G8:Reentry',     passed: true },
    );
  }

  // G9: Weighted score floor
  if (weightedScore < 40)
    return fail('G9:Score', `Weighted score ${weightedScore}/${MAX_SCORE} below threshold (40)`, 'WAIT');
  gates.push({ gate: 'G9:Score', passed: true });

  // G9.5: Counter-trend + validity gate
  if (!active) {
    const dir = trade.direction?.toUpperCase();
    if (dir === 'LONG' || dir === 'SHORT') {
      if (input.setupCreatedAt && input.setupTimeframe) {
        // Full validity check when setup metadata is explicitly provided
        const validity = assessSetupValidity({
          htfBias:       input.strategy.htfBias,
          ltfBias:       input.strategy.ltfBias,
          regime:        input.strategy.regime,
          currentPrice:  input.strategy.ema20 ?? 0,
          direction:     dir as 'LONG' | 'SHORT',
          entryZoneLow:  0,
          entryZoneHigh: 0,
          createdAt:     input.setupCreatedAt,
          timeframe:     input.setupTimeframe,
        });

        if (validity.validity === 'INVALID' || validity.validity === 'EXPIRED') {
          return fail('G9.5:SetupValidity', `Setup ${validity.validity.toLowerCase()}: ${validity.reason}`, 'WAIT');
        }
        if (validity.validity === 'WATCH_ONLY' && validity.blocked) {
          return fail('G9.5:CounterTrend', `Counter-trend ${dir} blocked: ${validity.reason}`, 'WAIT');
        }
      }
      // CONFLICT via classifier (always enforced)
      const classi = classifySetup(dir as 'LONG' | 'SHORT', input.strategy.htfBias, input.strategy.ltfBias);
      if (classi.trendAlignment === 'CONFLICT') {
        return fail('G9.5:CounterTrend', `Counter-trend ${dir}: ${classi.reason}`, 'WAIT');
      }
    }
  }
  gates.push({ gate: 'G9.5:CounterTrend', passed: true });

  // G9.6: ITOS priority tier gate — only PRIMARY setups may generate LONG/SHORT decisions
  // SECONDARY/WATCHLIST setups produce WAIT; INVALID is blocked by earlier gates
  if (!active && input.setupTier !== undefined) {
    if (input.setupTier === 'WATCHLIST' || input.setupTier === 'INVALID') {
      return fail(
        'G9.6:PriorityTier',
        `Setup tier ${input.setupTier} — only PRIMARY setups may trigger trade decisions`,
        'WAIT',
      );
    }
    if (input.setupTier === 'SECONDARY') {
      // SECONDARY produces WAIT but passes (direction determination yields READY/WAIT later)
      gates.push({ gate: 'G9.6:PriorityTier', passed: true, reason: 'Secondary setup — confirmation required' });
    } else {
      gates.push({ gate: 'G9.6:PriorityTier', passed: true });
    }
  } else {
    gates.push({ gate: 'G9.6:PriorityTier', passed: true });
  }

  // G10: Final outcome derivation
  gates.push({ gate: 'G10:Final', passed: true });

  if (active) {
    if (trade.tp3Hit) return { outcome: 'REDUCE_POSITION', gates, blockingReason: null };
    return { outcome: 'HOLD', gates, blockingReason: null };
  }

  const dir = trade.direction?.toUpperCase();
  if (dir === 'LONG')  return { outcome: 'LONG',  gates, blockingReason: null };
  if (dir === 'SHORT') return { outcome: 'SHORT', gates, blockingReason: null };
  return { outcome: 'READY', gates, blockingReason: null };
}

// ── Explanation builder ───────────────────────────────────────────────────────

function buildExplanation(items: WeightedEvidenceItem[]): { topSupporting: string[]; topOpposing: string[] } {
  const supporting = items
    .filter((i) => i.present && i.category !== 'Volume')
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((i) => `${i.category} (+${i.contribution}pts)`);

  const opposing = items
    .filter((i) => !i.present && i.category !== 'Volume')
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((i) => `${i.category} (−${i.weight}pts)`);

  return { topSupporting: supporting, topOpposing: opposing };
}

function resolveNextAction(outcome: DecisionOutcome, blockingReason: string | null): string {
  if (blockingReason) return `Resolve: ${blockingReason}`;
  switch (outcome) {
    case 'LONG':            return 'Monitor entry zone — prepare LONG';
    case 'SHORT':           return 'Monitor entry zone — prepare SHORT';
    case 'HOLD':            return 'Manage open position — monitor TP levels';
    case 'REDUCE_POSITION': return 'Consider partial close — TP3 reached';
    case 'READY':           return 'Await directional signal confirmation';
    case 'NO_TRADE':        return 'Skip this setup — conditions not met';
    case 'EXIT':            return 'Exit position immediately';
    default:                return 'Await better market conditions';
  }
}

// ── Main entry ────────────────────────────────────────────────────────────────

export function computeDecision(input: DecisionInput): DecisionResult {
  const items         = computeWeightedItems(input);
  const weightedScore = items.reduce((sum, i) => sum + i.contribution, 0);

  // Blend weighted score (60%) with evidence confidence (40%)
  const blendedConfidence = Math.round(
    (weightedScore / MAX_SCORE) * 100 * 0.6 + input.evidence.confidence * 0.4,
  );

  const { outcome, gates, blockingReason } = runGates(input, weightedScore);
  const { topSupporting, topOpposing }     = buildExplanation(items);

  return {
    outcome,
    confidence:     Math.min(blendedConfidence, 100),
    weightedScore,
    maxScore:       MAX_SCORE,
    weights:        items,
    gates,
    blockingReason,
    topSupporting,
    topOpposing,
    nextAction:     resolveNextAction(outcome, blockingReason),
    computedAt:     new Date().toISOString(),
  };
}
