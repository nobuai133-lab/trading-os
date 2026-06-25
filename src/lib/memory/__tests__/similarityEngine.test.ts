import { describe, it, expect } from 'vitest';
import { computeSimilarity, buildSimilarityWarnings } from '../similarityEngine';

const LONG_BULL_A: string[] = [
  'TREND_BULL', 'EMA_ALIGNED', 'HTF_BULL', 'LTF_BULL',
  'LIQ_SWEEP', 'ACC_TRUE', 'RET_FALSE',
  'MOM_STRONG', 'VOL_UNAVAILABLE', 'RR_HIGH',
  'GRADE_A', 'RISK_MEDIUM', 'DIR_LONG', 'TF_4H',
];

const SHORT_BEAR_B: string[] = [
  'TREND_BEAR', 'EMA_ALIGNED', 'HTF_BEAR', 'LTF_BEAR',
  'LIQ_SWEEP', 'ACC_TRUE', 'RET_FALSE',
  'MOM_STRONG', 'VOL_UNAVAILABLE', 'RR_HIGH',
  'GRADE_B', 'RISK_MEDIUM', 'DIR_SHORT', 'TF_4H',
];

const LONG_BULL_B: string[] = [
  'TREND_BULL', 'EMA_ALIGNED', 'HTF_BULL', 'LTF_BULL',
  'LIQ_SWEEP', 'ACC_TRUE', 'RET_FALSE',
  'MOM_STRONG', 'VOL_UNAVAILABLE', 'RR_HIGH',
  'GRADE_B', 'RISK_MEDIUM', 'DIR_LONG', 'TF_4H',
];

describe('computeSimilarity', () => {
  it('TC-SIM01 — identical DNA → 100%', () => {
    expect(computeSimilarity(LONG_BULL_A, LONG_BULL_A)).toBe(100);
  });

  it('TC-SIM02 — direction flip lowers similarity significantly', () => {
    const sim = computeSimilarity(LONG_BULL_A, SHORT_BEAR_B);
    // direction (20), trend (18), htfBias (10) all mismatch → should be < 50
    expect(sim).toBeLessThan(50);
  });

  it('TC-SIM03 — same direction + trend, adjacent grade (A vs B) → high similarity with partial credit', () => {
    const sim = computeSimilarity(LONG_BULL_A, LONG_BULL_B);
    // Only grade differs: A vs B → 0.5 partial credit; everything else matches
    expect(sim).toBeGreaterThan(90);
    expect(sim).toBeLessThan(100);
  });

  it('TC-SIM04 — regime mismatch (BULL vs RANGE) drops score', () => {
    const rangeDNA = LONG_BULL_A.map((t) => t === 'TREND_BULL' ? 'TREND_RANGE' : t);
    const sim = computeSimilarity(LONG_BULL_A, rangeDNA);
    expect(sim).toBeLessThan(85);
  });

  it('TC-SIM05 — momentum adjacency: STRONG vs MEDIUM → partial credit (not 0)', () => {
    const mediumDNA = LONG_BULL_A.map((t) => t === 'MOM_STRONG' ? 'MOM_MEDIUM' : t);
    const simPartial = computeSimilarity(LONG_BULL_A, mediumDNA);
    const noDNA      = LONG_BULL_A.map((t) => t === 'MOM_STRONG' ? 'MOM_WEAK' : t);
    const simNone    = computeSimilarity(LONG_BULL_A, noDNA);
    expect(simPartial).toBeGreaterThan(simNone);
  });

  it('TC-SIM06 — empty DNA arrays → 0%', () => {
    expect(computeSimilarity([], [])).toBe(0);
    expect(computeSimilarity(LONG_BULL_A, [])).toBe(0);
  });

  it('TC-SIM07 — symmetry: similarity(A, B) === similarity(B, A)', () => {
    const ab = computeSimilarity(LONG_BULL_A, SHORT_BEAR_B);
    const ba = computeSimilarity(SHORT_BEAR_B, LONG_BULL_A);
    expect(ab).toBe(ba);
  });
});

describe('buildSimilarityWarnings', () => {
  it('TC-SIM08 — identifies shared weak-momentum token with majority losers', () => {
    const weakLoserDNAs = [
      LONG_BULL_A.map((t) => (t === 'MOM_STRONG' ? 'MOM_WEAK' : t)),
      LONG_BULL_A.map((t) => (t === 'MOM_STRONG' ? 'MOM_WEAK' : t)),
      LONG_BULL_A.map((t) => (t === 'MOM_STRONG' ? 'MOM_WEAK' : t)),
    ];
    const queryDNA = LONG_BULL_A.map((t) => (t === 'MOM_STRONG' ? 'MOM_WEAK' : t));
    const warnings = buildSimilarityWarnings(queryDNA, weakLoserDNAs);
    expect(warnings.some((w) => w.toLowerCase().includes('momentum'))).toBe(true);
  });

  it('TC-SIM09 — empty loser list → no warnings', () => {
    const warnings = buildSimilarityWarnings(LONG_BULL_A, []);
    expect(warnings).toHaveLength(0);
  });
});
