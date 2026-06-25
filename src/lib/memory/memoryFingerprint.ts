// Setup Fingerprint Engine — generates deterministic fingerprints from kernel state.
// Governance rule: same market conditions → same fingerprint hash (immutable identity).

import { createHash }        from 'crypto';
import type { EvidenceState, StrategyState, TradeState, MemoryState } from '@/kernel/types';
import type { SetupFingerprintData }                                    from '@/types';

// ── Classifiers ───────────────────────────────────────────────────────────────

function toTrend(regime: string): SetupFingerprintData['trend'] {
  const r = regime.toUpperCase();
  if (r === 'TRENDING_UP'   || r === 'BULL')        return 'BULL';
  if (r === 'TRENDING_DOWN' || r === 'BEAR')        return 'BEAR';
  if (r === 'RANGING'       || r === 'RANGE')       return 'RANGE';
  return 'UNKNOWN';
}

function toBias(bias: string): 'BULL' | 'BEAR' | 'NEUTRAL' {
  const b = bias.toLowerCase();
  if (b.includes('bull') || b === 'long')  return 'BULL';
  if (b.includes('bear') || b === 'short') return 'BEAR';
  return 'NEUTRAL';
}

function toMomentum(ema20: number, ema50: number): SetupFingerprintData['momentum'] {
  if (ema20 <= 0 || ema50 <= 0) return 'UNKNOWN';
  const spread = Math.abs(ema20 - ema50) / ema50;
  if (spread > 0.03)  return 'STRONG';
  if (spread > 0.01)  return 'MEDIUM';
  return 'WEAK';
}

function toRRBucket(rr: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (rr >= 2.0) return 'HIGH';
  if (rr >= 1.5) return 'MEDIUM';
  return 'LOW';
}

function toRiskBucket(riskPct: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (riskPct > 2.0)  return 'HIGH';
  if (riskPct >= 1.0) return 'MEDIUM';
  return 'LOW';
}

function getCategory(cats: EvidenceState['categories'], name: string) {
  return cats.find((c) => c.name === name);
}

// ── Main export ───────────────────────────────────────────────────────────────

export function generateFingerprint(
  evidence: EvidenceState,
  strategy: StrategyState,
  trade:    TradeState,
  memory:   MemoryState,
  provider: string,
): SetupFingerprintData {
  const direction  = (trade.direction?.toUpperCase() as 'LONG' | 'SHORT') ?? 'LONG';
  const entry = trade.entry ?? 0;
  const sl    = trade.sl    ?? 0;
  const tp1   = trade.tp1   ?? 0;

  const rr = entry > 0 && sl > 0 && tp1 > 0 && entry !== sl
    ? Math.abs(tp1 - entry) / Math.abs(entry - sl)
    : 0;

  const gradeBucket = (['A', 'B', 'C', 'D'].includes(evidence.grade?.toUpperCase())
    ? evidence.grade.toUpperCase()
    : 'D') as 'A' | 'B' | 'C' | 'D';

  const liqCat   = getCategory(evidence.categories, 'Liquidity');
  const rangeCat = getCategory(evidence.categories, 'Range Context');

  const emaAligned = strategy.ema20 > 0 && strategy.ema50 > 0
    ? (direction === 'LONG' ? strategy.ema20 > strategy.ema50 : strategy.ema20 < strategy.ema50)
    : false;

  // Range extreme: entry within 3% of range boundary
  const rm = memory.rangeMemory;
  const atRangeExtreme = rm
    ? (direction === 'LONG'
        ? entry > 0 && entry <= rm.rangeLow  * 1.03
        : entry > 0 && entry >= rm.rangeHigh * 0.97)
    : false;

  // Canonical object — keys sorted for deterministic JSON
  const canonical: Record<string, unknown> = {
    atRangeExtreme,
    direction,
    emaAlignment:    emaAligned ? 'ALIGNED' : (strategy.ema20 > 0 ? 'MISALIGNED' : 'UNKNOWN'),
    gradeBucket,
    hasRetest:       false,             // not available in kernel v1
    htfBias:         toBias(strategy.htfBias),
    liquiditySweep:  liqCat?.present ?? false,
    ltfBias:         toBias(strategy.ltfBias),
    momentum:        toMomentum(strategy.ema20, strategy.ema50),
    provider,
    rangeAcceptance: rangeCat?.present ?? false,
    regime:          strategy.regime,
    riskBucket:      toRiskBucket(trade.riskPct ?? 0),
    rrBucket:        toRRBucket(rr),
    timeframe:       trade.timeframe ?? strategy.timeframe,
    trend:           toTrend(strategy.regime),
    volume:          'UNAVAILABLE',
  };

  const sortedJson = JSON.stringify(canonical, Object.keys(canonical).sort());
  const hash = createHash('sha1').update(sortedJson).digest('hex').slice(0, 16);

  return {
    trend:           canonical.trend           as SetupFingerprintData['trend'],
    emaAlignment:    canonical.emaAlignment     as SetupFingerprintData['emaAlignment'],
    htfBias:         canonical.htfBias          as SetupFingerprintData['htfBias'],
    ltfBias:         canonical.ltfBias          as SetupFingerprintData['ltfBias'],
    liquiditySweep:  canonical.liquiditySweep   as boolean,
    rangeAcceptance: canonical.rangeAcceptance  as boolean,
    atRangeExtreme:  canonical.atRangeExtreme   as boolean,
    hasRetest:       canonical.hasRetest        as boolean,
    momentum:        canonical.momentum         as SetupFingerprintData['momentum'],
    volume:          'UNAVAILABLE',
    rrBucket:        canonical.rrBucket         as SetupFingerprintData['rrBucket'],
    gradeBucket:     canonical.gradeBucket      as SetupFingerprintData['gradeBucket'],
    riskBucket:      canonical.riskBucket       as SetupFingerprintData['riskBucket'],
    provider,
    timeframe:       canonical.timeframe        as string,
    regime:          canonical.regime           as string,
    direction,
    hash,
  };
}
