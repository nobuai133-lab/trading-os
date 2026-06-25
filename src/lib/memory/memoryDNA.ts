// Setup DNA Engine — compact token-array encoding of a SetupFingerprintData.
// DNA is human-readable, deterministic, and designed for fast similarity search.
// Same fingerprint → same DNA tokens → same hash.

import { createHash }       from 'crypto';
import type { SetupFingerprintData } from '@/types';

// ── Token encoding ────────────────────────────────────────────────────────────

export function generateDNA(fp: SetupFingerprintData): string[] {
  return [
    `TREND_${fp.trend}`,
    `EMA_${fp.emaAlignment}`,
    `HTF_${fp.htfBias}`,
    `LTF_${fp.ltfBias}`,
    fp.liquiditySweep  ? 'LIQ_SWEEP' : 'LIQ_NONE',
    fp.rangeAcceptance ? 'ACC_TRUE'  : 'ACC_FALSE',
    fp.hasRetest       ? 'RET_TRUE'  : 'RET_FALSE',
    `MOM_${fp.momentum}`,
    `VOL_${fp.volume}`,
    `RR_${fp.rrBucket}`,
    `GRADE_${fp.gradeBucket}`,
    `RISK_${fp.riskBucket}`,
    `DIR_${fp.direction}`,
    `TF_${normalizeTF(fp.timeframe)}`,
  ];
}

function normalizeTF(tf: string): string {
  const t = tf.toUpperCase().replace(/\s/g, '');
  switch (t) {
    case '1':   case '1M':   return '1M';
    case '5':   case '5M':   return '5M';
    case '15':  case '15M':  return '15M';
    case '60':  case '1H':   return '1H';
    case '240': case '4H':   return '4H';
    case '1D':  case 'D':    return '1D';
    default:                  return 'OTHER';
  }
}

// ── Hash and display ──────────────────────────────────────────────────────────

// Deterministic: sort tokens before hashing so order is irrelevant
export function hashDNA(tokens: string[]): string {
  const sorted = [...tokens].sort().join('|');
  return createHash('sha1').update(sorted).digest('hex').slice(0, 12);
}

export function dnaToString(tokens: string[]): string {
  return tokens.join(' · ');
}

// Return the token for a given category prefix (e.g. 'DIR_' → 'DIR_LONG')
export function tokenByPrefix(dna: string[], prefix: string): string {
  return dna.find((t) => t.startsWith(prefix)) ?? '';
}
