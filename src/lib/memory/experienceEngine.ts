// Experience Engine — derives institutional lessons from completed trade history.
// Deterministic rule-based analysis. No ML. No strategy modification.
// Lessons are read-only observations; they do not alter the trade pipeline.

import type { TradeMemoryRecord, ExperienceLesson } from '@/types';

// ── Grouping helpers ──────────────────────────────────────────────────────────

interface GroupStats {
  count:  number;
  wins:   number;
  losses: number;
  totalR: number;
}

function statsFor(records: TradeMemoryRecord[], tokens: string[]): GroupStats {
  const matches = records.filter((r) => tokens.every((t) => r.dna.includes(t)));
  return {
    count:  matches.length,
    wins:   matches.filter((r) => r.outcome === 'WIN').length,
    losses: matches.filter((r) => r.outcome === 'LOSS').length,
    totalR: matches.reduce((s, r) => s + r.resultR, 0),
  };
}

function strength(sampleCount: number): number {
  return Math.min(100, Math.round((sampleCount / 20) * 100));
}

// ── Lesson generators ─────────────────────────────────────────────────────────

function dirRegimeConflicts(records: TradeMemoryRecord[]): ExperienceLesson[] {
  const lessons: ExperienceLesson[] = [];

  const cases: Array<[string, string]> = [
    ['DIR_LONG',  'TREND_BEAR'],
    ['DIR_SHORT', 'TREND_BULL'],
    ['DIR_LONG',  'TREND_RANGE'],
    ['DIR_SHORT', 'TREND_RANGE'],
  ];

  for (const [dir, trend] of cases) {
    const s = statsFor(records, [dir, trend]);
    if (s.count < 3) continue;
    const lossRate = s.losses / s.count;
    if (lossRate < 0.70) continue;

    const dirLabel   = dir.replace('DIR_', '');
    const trendLabel = trend.replace('TREND_', '');
    const avgR       = s.totalR / s.count;

    lessons.push({
      id:         `conflict_${dirLabel}_${trendLabel}`.toLowerCase(),
      condition:  `${dirLabel} in ${trendLabel} regime`,
      action:     'AVOID',
      summary:    `Never ${dirLabel} in ${trendLabel} regime — ${(lossRate * 100).toFixed(0)}% loss rate, avg ${avgR.toFixed(1)}R over ${s.count} trades`,
      winRate:    1 - lossRate,
      tradeCount: s.count,
      totalR:     Math.round(s.totalR * 10) / 10,
      avgR:       Math.round(avgR * 10) / 10,
      strength:   strength(s.count),
      tokens:     [dir, trend],
    });
  }

  return lessons;
}

function gradePerformance(records: TradeMemoryRecord[]): ExperienceLesson[] {
  const lessons: ExperienceLesson[] = [];

  for (const grade of ['A', 'B', 'C', 'D']) {
    const s = statsFor(records, [`GRADE_${grade}`]);
    if (s.count < 3) continue;
    const winRate = s.wins / s.count;
    const avgR    = s.totalR / s.count;

    if ((grade === 'A' || grade === 'B') && winRate >= 0.65) {
      lessons.push({
        id:         `grade_${grade.toLowerCase()}_prefer`,
        condition:  `Grade ${grade} setup`,
        action:     'PREFER',
        summary:    `Grade ${grade} setups: ${(winRate * 100).toFixed(0)}% win rate, avg ${avgR.toFixed(1)}R over ${s.count} trades`,
        winRate,
        tradeCount: s.count,
        totalR:     Math.round(s.totalR * 10) / 10,
        avgR:       Math.round(avgR * 10) / 10,
        strength:   strength(s.count),
        tokens:     [`GRADE_${grade}`],
      });
    }

    if ((grade === 'C' || grade === 'D') && winRate < 0.40) {
      lessons.push({
        id:         `grade_${grade.toLowerCase()}_warn`,
        condition:  `Grade ${grade} setup`,
        action:     'WARN',
        summary:    `Grade ${grade} setups underperform — ${(winRate * 100).toFixed(0)}% win rate, avg ${avgR.toFixed(1)}R over ${s.count} trades`,
        winRate,
        tradeCount: s.count,
        totalR:     Math.round(s.totalR * 10) / 10,
        avgR:       Math.round(avgR * 10) / 10,
        strength:   strength(s.count),
        tokens:     [`GRADE_${grade}`],
      });
    }
  }

  return lessons;
}

function momentumQuality(records: TradeMemoryRecord[]): ExperienceLesson[] {
  const lessons: ExperienceLesson[] = [];

  const weak = statsFor(records, ['MOM_WEAK']);
  if (weak.count >= 3 && weak.losses / weak.count >= 0.65) {
    const lossRate = weak.losses / weak.count;
    lessons.push({
      id:         'weak_momentum_warn',
      condition:  'Weak momentum (EMA spread < 1%)',
      action:     'WARN',
      summary:    `Weak momentum setups: ${(lossRate * 100).toFixed(0)}% loss rate — wait for stronger EMA separation`,
      winRate:    1 - lossRate,
      tradeCount: weak.count,
      totalR:     Math.round(weak.totalR * 10) / 10,
      avgR:       Math.round((weak.totalR / weak.count) * 10) / 10,
      strength:   strength(weak.count),
      tokens:     ['MOM_WEAK'],
    });
  }

  const strong = statsFor(records, ['MOM_STRONG']);
  if (strong.count >= 3 && strong.wins / strong.count >= 0.70) {
    lessons.push({
      id:         'strong_momentum_prefer',
      condition:  'Strong momentum (EMA spread > 3%)',
      action:     'PREFER',
      summary:    `Strong momentum setups: ${((strong.wins / strong.count) * 100).toFixed(0)}% win rate`,
      winRate:    strong.wins / strong.count,
      tradeCount: strong.count,
      totalR:     Math.round(strong.totalR * 10) / 10,
      avgR:       Math.round((strong.totalR / strong.count) * 10) / 10,
      strength:   strength(strong.count),
      tokens:     ['MOM_STRONG'],
    });
  }

  return lessons;
}

function liquidityEdge(records: TradeMemoryRecord[]): ExperienceLesson[] {
  const lessons: ExperienceLesson[] = [];

  const sweep  = statsFor(records, ['LIQ_SWEEP']);
  const noSweep = statsFor(records, ['LIQ_NONE']);
  if (sweep.count < 3 || noSweep.count < 3) return lessons;

  const sweepWR    = sweep.wins / sweep.count;
  const noSweepWR  = noSweep.wins / noSweep.count;
  const delta = sweepWR - noSweepWR;

  if (delta >= 0.20) {
    lessons.push({
      id:         'liquidity_sweep_prefer',
      condition:  'Liquidity sweep present',
      action:     'PREFER',
      summary:    `Liquidity sweep setups outperform no-sweep by ${(delta * 100).toFixed(0)}% win rate — ${sweep.count} trades`,
      winRate:    sweepWR,
      tradeCount: sweep.count,
      totalR:     Math.round(sweep.totalR * 10) / 10,
      avgR:       Math.round((sweep.totalR / sweep.count) * 10) / 10,
      strength:   strength(Math.min(sweep.count, noSweep.count)),
      tokens:     ['LIQ_SWEEP'],
    });
  }

  return lessons;
}

function rangeAcceptanceEdge(records: TradeMemoryRecord[]): ExperienceLesson[] {
  const lessons: ExperienceLesson[] = [];

  const acc    = statsFor(records, ['ACC_TRUE']);
  const noAcc  = statsFor(records, ['ACC_FALSE']);
  if (acc.count < 3 || noAcc.count < 3) return lessons;

  const accWR   = acc.wins / acc.count;
  const noAccWR = noAcc.wins / noAcc.count;
  const delta   = accWR - noAccWR;

  if (delta >= 0.25) {
    lessons.push({
      id:         'acceptance_prefer',
      condition:  'Range acceptance confirmed',
      action:     'PREFER',
      summary:    `Range acceptance improves win rate by ${(delta * 100).toFixed(0)}% — entry at range extreme ${acc.count} trades`,
      winRate:    accWR,
      tradeCount: acc.count,
      totalR:     Math.round(acc.totalR * 10) / 10,
      avgR:       Math.round((acc.totalR / acc.count) * 10) / 10,
      strength:   strength(Math.min(acc.count, noAcc.count)),
      tokens:     ['ACC_TRUE'],
    });
  }

  return lessons;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function generateLessons(records: TradeMemoryRecord[]): ExperienceLesson[] {
  if (records.length < 3) return [];

  const all = [
    ...dirRegimeConflicts(records),
    ...gradePerformance(records),
    ...momentumQuality(records),
    ...liquidityEdge(records),
    ...rangeAcceptanceEdge(records),
  ];

  // Deduplicate by id, keep highest-strength version
  const seen = new Map<string, ExperienceLesson>();
  for (const l of all) {
    const existing = seen.get(l.id);
    if (!existing || l.strength > existing.strength) {
      seen.set(l.id, l);
    }
  }

  return Array.from(seen.values()).sort(
    (a, b) => b.strength - a.strength || b.tradeCount - a.tradeCount,
  );
}
