// Similarity Engine — compares two setup DNA arrays and returns 0–100 similarity.
// Uses weighted categorical token matching with partial credit for adjacent ordinals.
// No ML, no embeddings — deterministic weighted rules.

import { tokenByPrefix } from './memoryDNA';

// ── Category → DNA prefix mapping ────────────────────────────────────────────

const CATEGORIES: Array<{ key: string; prefix: string; weight: number }> = [
  { key: 'direction',  prefix: 'DIR_',   weight: 20 },
  { key: 'trend',      prefix: 'TREND_', weight: 18 },
  { key: 'grade',      prefix: 'GRADE_', weight: 15 },
  { key: 'liquidity',  prefix: 'LIQ_',   weight: 14 },
  { key: 'htfBias',    prefix: 'HTF_',   weight: 10 },
  { key: 'momentum',   prefix: 'MOM_',   weight: 9  },
  { key: 'acceptance', prefix: 'ACC_',   weight: 7  },
  { key: 'ema',        prefix: 'EMA_',   weight: 7  },
]; // sum = 100

// ── Partial credit tables ─────────────────────────────────────────────────────

const MOMENTUM_ORDER = ['MOM_WEAK', 'MOM_MEDIUM', 'MOM_STRONG', 'MOM_UNKNOWN'];
const GRADE_ORDER    = ['GRADE_D', 'GRADE_C', 'GRADE_B', 'GRADE_A'];

function tokenScore(a: string, b: string, key: string): number {
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;

  if (key === 'momentum') {
    const ai = MOMENTUM_ORDER.indexOf(a);
    const bi = MOMENTUM_ORDER.indexOf(b);
    if (ai >= 0 && bi >= 0 && Math.abs(ai - bi) === 1) return 0.5;
  }

  if (key === 'grade') {
    const ai = GRADE_ORDER.indexOf(a);
    const bi = GRADE_ORDER.indexOf(b);
    if (ai >= 0 && bi >= 0 && Math.abs(ai - bi) === 1) return 0.5;
  }

  return 0.0;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeSimilarity(queryDNA: string[], targetDNA: string[]): number {
  let totalWeight  = 0;
  let weightedSum  = 0;

  for (const { key, prefix, weight } of CATEGORIES) {
    const qa = tokenByPrefix(queryDNA, prefix);
    const ta = tokenByPrefix(targetDNA, prefix);
    if (!qa || !ta) continue;

    totalWeight += weight;
    weightedSum += weight * tokenScore(qa, ta, key);
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 100);
}

// ── Similarity explanation ────────────────────────────────────────────────────

// Returns the DNA tokens shared between queryDNA and the nearest loser DNAs,
// translated into human-readable warning strings.
export function buildSimilarityWarnings(
  queryDNA:     string[],
  loserDNAs:    string[][],
  threshold:    number = 60,  // only explain losers with similarity >= threshold
): string[] {
  if (loserDNAs.length === 0) return [];

  const tokenCount = new Map<string, number>();
  const relevant   = loserDNAs.filter((_, i) => i < 5); // cap at 5

  for (const dna of relevant) {
    for (const t of dna) {
      if (queryDNA.includes(t)) {
        tokenCount.set(t, (tokenCount.get(t) ?? 0) + 1);
      }
    }
  }

  const majority = Math.ceil(relevant.length * 0.6);
  const warnings: string[] = [];

  for (const [token, count] of tokenCount.entries()) {
    if (count >= majority) {
      const msg = TOKEN_WARNINGS[token];
      if (msg) warnings.push(msg);
    }
  }

  return warnings.slice(0, 5);
}

const TOKEN_WARNINGS: Record<string, string> = {
  'MOM_WEAK':       'Weak momentum — similar losing setups had low EMA spread',
  'ACC_FALSE':      'No range acceptance — entry not near range extreme',
  'LIQ_NONE':       'No liquidity sweep — entry lacks sweep confirmation',
  'TREND_BEAR':     'Bear regime — counter-trend bias conflicts with direction',
  'TREND_RANGE':    'Ranging regime — low directional edge',
  'TREND_UNKNOWN':  'Unknown regime — insufficient market structure',
  'RR_LOW':         'Low R:R ratio — reward profile insufficient',
  'GRADE_C':        'Grade C quality — weak evidence for this setup',
  'GRADE_D':        'Grade D quality — avoid this grade historically',
  'HTF_BEAR':       'Bearish HTF bias — structural headwind',
  'LTF_BEAR':       'Bearish LTF bias — momentum conflict',
  'EMA_MISALIGNED': 'EMA misaligned — trend confirmation absent',
  'EMA_UNKNOWN':    'EMA unknown — trend data unavailable',
  'RET_FALSE':      'No retest confirmation — entry lacks secondary validation',
};
