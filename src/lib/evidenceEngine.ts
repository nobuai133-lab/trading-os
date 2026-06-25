// Evidence Engine — pure category evaluation and confidence scoring.
// Implements constitution/03-Evidence-Engine.md 5-category model.
// No side effects: takes inputs, returns scored result.

import type { WebhookSignal }                  from './signalProvider';
import type { StrategyState, MemoryState }      from '@/kernel/types';
import type { EvidenceCategory }                from '@/kernel/types';

export type EvidenceGrade = 'A' | 'B' | 'C' | 'D';

export interface EvidenceResult {
  grade:      EvidenceGrade;
  confidence: number;
  categories: EvidenceCategory[];
}

export interface EvidenceInput {
  signal:   WebhookSignal;
  strategy: StrategyState;
  memory:   MemoryState;
}

// ── Category evaluators ────────────────────────────────────────────────────────

function evalMarketStructure(signal: WebhookSignal, s: StrategyState): EvidenceCategory {
  const dir = signal.direction?.toUpperCase();
  const htfAligned = dir === 'LONG'
    ? s.htfBias?.toLowerCase().includes('bull') || s.htfBias === 'Long'
    : s.htfBias?.toLowerCase().includes('bear') || s.htfBias === 'Short';

  const ltfAligned = dir === 'LONG'
    ? s.ltfBias?.toLowerCase().includes('bull') || s.ltfBias === 'Long'
    : s.ltfBias?.toLowerCase().includes('bear') || s.ltfBias === 'Short';

  const emaAligned = s.ema20 > 0 && s.ema50 > 0 && (
    dir === 'LONG'  ? s.ema20 > s.ema50 :
    dir === 'SHORT' ? s.ema20 < s.ema50 : false
  );

  const checks = [htfAligned, ltfAligned, emaAligned].filter(Boolean).length;
  const present = checks >= 2; // at least 2 of 3 structure checks pass
  const score   = present ? 20 : 0;

  return {
    name:    'Market Structure',
    score,
    present,
    note: present
      ? `HTF ${s.htfBias}, LTF ${s.ltfBias}, EMA ${emaAligned ? 'aligned' : 'misaligned'}`
      : `Insufficient alignment (${checks}/3 checks passed)`,
  };
}

function evalRangeContext(signal: WebhookSignal, mem: MemoryState): EvidenceCategory {
  const r = mem.rangeMemory;
  if (!r) return { name: 'Range Context', score: 0, present: false, note: 'No range memory' };

  const notStale     = r.status !== 'STALE';
  const freshLiq     = r.freshLiquidity;
  const reentryOk    = r.reentryAllowed;
  const dir          = signal.direction?.toUpperCase();
  const entryLow     = signal.entryZoneLow  ?? signal.entryPrice;
  const entryHigh    = signal.entryZoneHigh ?? signal.entryPrice;

  // Check if entry zone is near range extreme (within 3% of boundary)
  const atExtreme = entryLow !== undefined && entryHigh !== undefined && (
    dir === 'LONG'  ? entryLow  <= r.rangeLow  * 1.03  :
    dir === 'SHORT' ? entryHigh >= r.rangeHigh * 0.97 : false
  );

  const checks = [notStale, freshLiq, reentryOk, atExtreme].filter(Boolean).length;
  const present = checks >= 3;
  const score   = present ? 20 : 0;

  return {
    name:    'Range Context',
    score,
    present,
    note: present
      ? `Range ${r.status}, fresh: ${freshLiq}, reentry: ${reentryOk}, at extreme: ${atExtreme}`
      : `Range context weak (${checks}/4 checks)`,
  };
}

function evalLiquidity(signal: WebhookSignal): EvidenceCategory {
  const note       = (signal.note ?? '').toLowerCase();
  const thesisType = (signal.thesisType ?? '').toLowerCase();

  // Check for liquidity sweep evidence in signal note or thesis type
  const sweepMentioned  = note.includes('sweep') || note.includes('liquidity') || thesisType.includes('liquidity');
  const rrOk            = (signal.rr ?? 0) >= 1.5;
  const slDefined       = signal.sl !== undefined && signal.sl > 0;

  const checks = [sweepMentioned, rrOk, slDefined].filter(Boolean).length;
  const present = checks >= 2;
  const score   = present ? 20 : 0;

  return {
    name:    'Liquidity',
    score,
    present,
    note: present
      ? `Sweep evidence: ${sweepMentioned}, RR ${signal.rr?.toFixed(2) ?? 'N/A'}`
      : `Insufficient liquidity evidence (${checks}/3 checks)`,
  };
}

function evalRiskReward(signal: WebhookSignal): EvidenceCategory {
  const rrMet    = (signal.rr ?? 0) >= 1.5;
  const slSet    = signal.sl !== undefined && signal.sl > 0;
  const tp1Set   = signal.tp1 !== undefined && signal.tp1 > 0;
  const tp2Set   = signal.tp2 !== undefined && signal.tp2 > 0;
  const tp3Set   = signal.tp3 !== undefined && signal.tp3 > 0;
  const riskSet  = (signal.riskPct ?? 0) > 0;

  const checks = [rrMet, slSet, tp1Set, tp2Set, tp3Set, riskSet].filter(Boolean).length;
  const present = checks >= 5; // all 6 ideally, 5 minimum
  const score   = present ? 20 : 0;

  return {
    name:    'Risk / Reward',
    score,
    present,
    note: present
      ? `RR ${signal.rr?.toFixed(2)}, SL ${signal.sl}, TP1/2/3 all defined, risk ${signal.riskPct}%`
      : `Incomplete R/R definition (${checks}/6 checks)`,
  };
}

function evalRegimeAlignment(signal: WebhookSignal, s: StrategyState): EvidenceCategory {
  const regimeKnown   = s.regime !== 'UNKNOWN' && s.regime !== '';
  const dir           = signal.direction?.toUpperCase();
  const regimeligned  = regimeKnown && (
    dir === 'LONG'  ? s.regime === 'TRENDING_UP'   || s.regime === 'BULL' :
    dir === 'SHORT' ? s.regime === 'TRENDING_DOWN' || s.regime === 'BEAR' : false
  );
  const atrPct       = s.atr > 0 && s.ema50 > 0 ? (s.atr / s.ema50) * 100 : 0;
  const atrOk        = atrPct === 0 || (atrPct > 0.5 && atrPct < 5); // not zero, not extreme

  const checks = [regimeKnown, regimeligned, atrOk].filter(Boolean).length;
  const present = checks >= 2;
  const score   = present ? 20 : 0;

  return {
    name:    'Regime Alignment',
    score,
    present,
    note: present
      ? `Regime ${s.regime}, aligned: ${regimeligned}, ATR ${atrPct.toFixed(2)}%`
      : `Regime misaligned or unknown (${checks}/3 checks)`,
  };
}

// ── Confidence scoring (constitution §Evidence Scoring) ───────────────────────

function computeConfidence(signal: WebhookSignal, s: StrategyState): number {
  let score = 30; // base

  if (s.regime !== 'UNKNOWN' && s.regime !== '') score += 15;
  if (s.regime === 'TRENDING_UP' || s.regime === 'TRENDING_DOWN') score += 20;

  if (s.ema20 > 0 && s.ema50 > 0) {
    const emaDiff = Math.abs(s.ema20 - s.ema50) / s.ema50;
    if (emaDiff > 0.02)      score += 35;
    else if (emaDiff > 0.01) score += 20;
  }

  // If signal provides a confidence value, blend it in (average)
  if (signal.confidence !== undefined && signal.confidence >= 0) {
    score = Math.round((score + signal.confidence) / 2);
  }

  return Math.min(score, 100);
}

// ── Grade derivation ──────────────────────────────────────────────────────────

function deriveGrade(
  presentCount: number,
  confidence: number,
  signalGrade?: string,
): EvidenceGrade {
  // Signal-provided grade is never upgraded above computed — only kept or downgraded
  let computed: EvidenceGrade;
  if      (presentCount >= 5 && confidence >= 70) computed = 'A';
  else if (presentCount >= 4 && confidence >= 50) computed = 'B';
  else if (presentCount >= 3 && confidence >= 30) computed = 'C';
  else                                            computed = 'D';

  // Accept signal grade if it is more conservative than computed
  const gradeOrder: Record<EvidenceGrade, number> = { A: 4, B: 3, C: 2, D: 1 };
  if (signalGrade && signalGrade in gradeOrder) {
    const sig = signalGrade as EvidenceGrade;
    if (gradeOrder[sig] < gradeOrder[computed]) return sig;
  }

  return computed;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function evaluateEvidence(input: EvidenceInput): EvidenceResult {
  const { signal, strategy, memory } = input;

  const categories = [
    evalMarketStructure(signal, strategy),
    evalRangeContext(signal, memory),
    evalLiquidity(signal),
    evalRiskReward(signal),
    evalRegimeAlignment(signal, strategy),
  ];

  const confidence = computeConfidence(signal, strategy);
  const presentCount = categories.filter((c) => c.present).length;
  const grade = deriveGrade(presentCount, confidence, signal.grade);

  return { grade, confidence, categories };
}
