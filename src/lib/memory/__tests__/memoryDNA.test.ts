import { describe, it, expect } from 'vitest';
import { generateDNA, hashDNA, dnaToString, tokenByPrefix } from '../memoryDNA';
import type { SetupFingerprintData } from '@/types';

function makeFingerprint(overrides: Partial<SetupFingerprintData> = {}): SetupFingerprintData {
  return {
    trend:           'BULL',
    emaAlignment:    'ALIGNED',
    htfBias:         'BULL',
    ltfBias:         'BULL',
    liquiditySweep:  true,
    rangeAcceptance: true,
    atRangeExtreme:  false,
    hasRetest:       false,
    momentum:        'STRONG',
    volume:          'UNAVAILABLE',
    rrBucket:        'HIGH',
    gradeBucket:     'A',
    riskBucket:      'MEDIUM',
    provider:        'Kraken',
    timeframe:       '4H',
    regime:          'TRENDING_UP',
    direction:       'LONG',
    hash:            'abc123',
    ...overrides,
  };
}

describe('generateDNA', () => {
  it('TC-DNA01 — produces correct token array for Bull LONG Grade A', () => {
    const dna = generateDNA(makeFingerprint());
    expect(dna).toContain('TREND_BULL');
    expect(dna).toContain('DIR_LONG');
    expect(dna).toContain('GRADE_A');
    expect(dna).toContain('LIQ_SWEEP');
    expect(dna).toContain('MOM_STRONG');
    expect(dna).toContain('ACC_TRUE');
    expect(dna).toContain('EMA_ALIGNED');
    expect(dna).toContain('TF_4H');
    expect(dna).toContain('VOL_UNAVAILABLE');
  });

  it('TC-DNA02 — SHORT Bear produces DIR_SHORT and TREND_BEAR tokens', () => {
    const dna = generateDNA(makeFingerprint({ trend: 'BEAR', direction: 'SHORT', htfBias: 'BEAR', ltfBias: 'BEAR' }));
    expect(dna).toContain('TREND_BEAR');
    expect(dna).toContain('DIR_SHORT');
    expect(dna).toContain('HTF_BEAR');
    expect(dna).toContain('LTF_BEAR');
  });

  it('TC-DNA03 — false flags produce negative tokens', () => {
    const dna = generateDNA(makeFingerprint({ liquiditySweep: false, rangeAcceptance: false, hasRetest: false }));
    expect(dna).toContain('LIQ_NONE');
    expect(dna).toContain('ACC_FALSE');
    expect(dna).toContain('RET_FALSE');
  });

  it('TC-DNA04 — timeframe normalization: 240 → TF_4H', () => {
    const dna = generateDNA(makeFingerprint({ timeframe: '240' }));
    expect(dna).toContain('TF_4H');
  });

  it('TC-DNA05 — timeframe normalization: 60 → TF_1H', () => {
    const dna = generateDNA(makeFingerprint({ timeframe: '60' }));
    expect(dna).toContain('TF_1H');
  });

  it('TC-DNA06 — timeframe normalization: unknown → TF_OTHER', () => {
    const dna = generateDNA(makeFingerprint({ timeframe: 'WEEKLY' }));
    expect(dna).toContain('TF_OTHER');
  });
});

describe('hashDNA', () => {
  it('TC-DNA07 — same tokens produce same hash regardless of order', () => {
    const tokens = ['TREND_BULL', 'DIR_LONG', 'GRADE_A', 'LIQ_SWEEP'];
    const h1 = hashDNA(tokens);
    const h2 = hashDNA([...tokens].reverse());
    expect(h1).toBe(h2);
  });

  it('TC-DNA08 — different tokens produce different hash', () => {
    const h1 = hashDNA(['TREND_BULL', 'DIR_LONG']);
    const h2 = hashDNA(['TREND_BEAR', 'DIR_SHORT']);
    expect(h1).not.toBe(h2);
  });

  it('TC-DNA09 — hash is 12 chars', () => {
    expect(hashDNA(['TREND_BULL'])).toHaveLength(12);
  });
});

describe('helpers', () => {
  it('TC-DNA10 — tokenByPrefix finds correct token', () => {
    const dna = ['TREND_BULL', 'DIR_LONG', 'GRADE_A'];
    expect(tokenByPrefix(dna, 'DIR_')).toBe('DIR_LONG');
    expect(tokenByPrefix(dna, 'GRADE_')).toBe('GRADE_A');
    expect(tokenByPrefix(dna, 'MOM_')).toBe('');
  });

  it('TC-DNA11 — dnaToString joins with separator', () => {
    const s = dnaToString(['TREND_BULL', 'DIR_LONG']);
    expect(s).toBe('TREND_BULL · DIR_LONG');
  });
});
