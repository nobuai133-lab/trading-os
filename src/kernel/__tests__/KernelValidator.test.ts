import { describe, it, expect } from 'vitest';
import { validateEventInput, validateEventChain, validateSingleEvent } from '../KernelValidator';
import type { KernelEvent, KernelEventInput } from '../types';

function makeInput(overrides: Partial<KernelEventInput> = {}): KernelEventInput {
  return {
    correlationId: 'cid_test',
    source:        'test',
    domain:        'trade',
    type:          'SetupDetected',
    payload:       { symbol: 'BTCUSDT' },
    ...overrides,
  };
}

function makeEvent(seq: bigint, previousSeq: bigint, overrides: Partial<KernelEvent> = {}): KernelEvent {
  return {
    id:            `evt_${seq}`,
    seq,
    previousSeq,
    ts:            new Date(Number(seq) * 1000).toISOString(),
    correlationId: 'cid_test',
    sessionId:     'ses_test',
    source:        'test',
    domain:        'trade',
    type:          'SetupDetected',
    version:       1,
    payload:       {},
    ...overrides,
  };
}

describe('validateEventInput', () => {
  it('accepts a valid input', () => {
    const r = validateEventInput(makeInput());
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('rejects missing correlationId', () => {
    const r = validateEventInput(makeInput({ correlationId: '' }));
    expect(r.valid).toBe(false);
    expect(r.errors[0].code).toBe('KERNEL-1001');
  });

  it('rejects missing source', () => {
    const r = validateEventInput(makeInput({ source: '   ' }));
    expect(r.valid).toBe(false);
    expect(r.errors[0].code).toBe('KERNEL-1002');
  });

  it('rejects missing domain', () => {
    const r = validateEventInput(makeInput({ domain: '' as never }));
    expect(r.valid).toBe(false);
    expect(r.errors[0].code).toBe('KERNEL-1003');
  });

  it('rejects missing type', () => {
    const r = validateEventInput(makeInput({ type: '' }));
    expect(r.valid).toBe(false);
    expect(r.errors[0].code).toBe('KERNEL-1004');
  });

  it('rejects array as payload', () => {
    const r = validateEventInput(makeInput({ payload: [] as never }));
    expect(r.valid).toBe(false);
    expect(r.errors[0].code).toBe('KERNEL-1005');
  });

  it('rejects null payload', () => {
    const r = validateEventInput(makeInput({ payload: null as never }));
    expect(r.valid).toBe(false);
  });
});

describe('validateEventChain', () => {
  it('accepts an empty chain', () => {
    expect(validateEventChain([]).valid).toBe(true);
  });

  it('accepts ordered events with correct previousSeq', () => {
    const events = [
      makeEvent(1n, 0n),
      makeEvent(2n, 1n),
      makeEvent(3n, 2n),
    ];
    const r = validateEventChain(events);
    expect(r.valid).toBe(true);
    expect(r.warnings).toHaveLength(0);
  });

  it('detects duplicate IDs', () => {
    const events = [makeEvent(1n, 0n), makeEvent(2n, 1n, { id: 'evt_1' })];
    const r = validateEventChain(events);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.code === 'KERNEL-2001')).toBe(true);
  });

  it('detects duplicate seqs', () => {
    const events = [makeEvent(1n, 0n), makeEvent(1n, 0n, { id: 'evt_dup' })];
    const r = validateEventChain(events);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.code === 'KERNEL-2002')).toBe(true);
  });

  it('detects out-of-order seqs', () => {
    const events = [makeEvent(2n, 1n), makeEvent(1n, 0n)];
    const r = validateEventChain(events);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.code === 'KERNEL-2003')).toBe(true);
  });

  it('warns on previousSeq chain gap', () => {
    const events = [makeEvent(1n, 0n), makeEvent(2n, 0n)]; // previousSeq should be 1n
    const r = validateEventChain(events);
    expect(r.valid).toBe(true);
    expect(r.warnings.some((w) => w.code === 'KERNEL-3001')).toBe(true);
  });

  it('warns on timestamp regression', () => {
    const events = [
      makeEvent(1n, 0n, { ts: '2026-01-02T00:00:00.000Z' }),
      makeEvent(2n, 1n, { ts: '2026-01-01T00:00:00.000Z' }),
    ];
    const r = validateEventChain(events);
    expect(r.warnings.some((w) => w.code === 'KERNEL-3002')).toBe(true);
  });
});

describe('validateSingleEvent', () => {
  it('passes when previousSeq matches', () => {
    const ev = makeEvent(5n, 4n);
    const r  = validateSingleEvent(ev, 4n);
    expect(r.valid).toBe(true);
    expect(r.warnings).toHaveLength(0);
  });

  it('warns when previousSeq mismatches', () => {
    const ev = makeEvent(5n, 3n);
    const r  = validateSingleEvent(ev, 4n);
    expect(r.valid).toBe(true);
    expect(r.warnings.some((w) => w.code === 'KERNEL-3001')).toBe(true);
  });

  it('errors on missing required fields', () => {
    const ev = makeEvent(5n, 4n, { id: '', type: '' });
    const r  = validateSingleEvent(ev, 4n);
    expect(r.valid).toBe(false);
  });
});
