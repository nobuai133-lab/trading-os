import { describe, it, expect } from 'vitest';
import { validateTradeTransition, getAllowedTransitions } from '../machines/TradeMachine';
import type { TradePhase } from '../types';

describe('TradeMachine — valid forward transitions', () => {
  it('IDLE → SETUP_DETECTED', () => {
    expect(validateTradeTransition('IDLE', 'SETUP_DETECTED').allowed).toBe(true);
  });
  it('SETUP_DETECTED → WAIT_CONFIRMATION', () => {
    expect(validateTradeTransition('SETUP_DETECTED', 'WAIT_CONFIRMATION').allowed).toBe(true);
  });
  it('SETUP_DETECTED → IDLE (abort)', () => {
    expect(validateTradeTransition('SETUP_DETECTED', 'IDLE').allowed).toBe(true);
  });
  it('WAIT_CONFIRMATION → ENTRY_READY', () => {
    expect(validateTradeTransition('WAIT_CONFIRMATION', 'ENTRY_READY').allowed).toBe(true);
  });
  it('WAIT_CONFIRMATION → IDLE (abort)', () => {
    expect(validateTradeTransition('WAIT_CONFIRMATION', 'IDLE').allowed).toBe(true);
  });
  it('ENTRY_READY → POSITION_OPEN', () => {
    expect(validateTradeTransition('ENTRY_READY', 'POSITION_OPEN').allowed).toBe(true);
  });
  it('ENTRY_READY → IDLE (abort)', () => {
    expect(validateTradeTransition('ENTRY_READY', 'IDLE').allowed).toBe(true);
  });
  it('POSITION_OPEN → TP1_REACHED', () => {
    expect(validateTradeTransition('POSITION_OPEN', 'TP1_REACHED').allowed).toBe(true);
  });
  it('POSITION_OPEN → POSITION_CLOSED (SL hit)', () => {
    expect(validateTradeTransition('POSITION_OPEN', 'POSITION_CLOSED').allowed).toBe(true);
  });
  it('TP1_REACHED → TP2_REACHED', () => {
    expect(validateTradeTransition('TP1_REACHED', 'TP2_REACHED').allowed).toBe(true);
  });
  it('TP1_REACHED → POSITION_CLOSED (partial exit)', () => {
    expect(validateTradeTransition('TP1_REACHED', 'POSITION_CLOSED').allowed).toBe(true);
  });
  it('TP2_REACHED → TP3_REACHED', () => {
    expect(validateTradeTransition('TP2_REACHED', 'TP3_REACHED').allowed).toBe(true);
  });
  it('TP2_REACHED → POSITION_CLOSED', () => {
    expect(validateTradeTransition('TP2_REACHED', 'POSITION_CLOSED').allowed).toBe(true);
  });
  it('TP3_REACHED → POSITION_CLOSED', () => {
    expect(validateTradeTransition('TP3_REACHED', 'POSITION_CLOSED').allowed).toBe(true);
  });
  it('POSITION_CLOSED → POST_REVIEW', () => {
    expect(validateTradeTransition('POSITION_CLOSED', 'POST_REVIEW').allowed).toBe(true);
  });
  it('POST_REVIEW → WAIT_NEW_SETUP', () => {
    expect(validateTradeTransition('POST_REVIEW', 'WAIT_NEW_SETUP').allowed).toBe(true);
  });
  it('POST_REVIEW → SETUP_DETECTED (immediate re-entry)', () => {
    expect(validateTradeTransition('POST_REVIEW', 'SETUP_DETECTED').allowed).toBe(true);
  });
  it('WAIT_NEW_SETUP → SETUP_DETECTED', () => {
    expect(validateTradeTransition('WAIT_NEW_SETUP', 'SETUP_DETECTED').allowed).toBe(true);
  });
  it('WAIT_NEW_SETUP → IDLE', () => {
    expect(validateTradeTransition('WAIT_NEW_SETUP', 'IDLE').allowed).toBe(true);
  });
});

describe('TradeMachine — invalid transitions', () => {
  it('IDLE → POSITION_OPEN skips setup', () => {
    const r = validateTradeTransition('IDLE', 'POSITION_OPEN');
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('IDLE');
  });
  it('POSITION_CLOSED → IDLE skips post-review', () => {
    expect(validateTradeTransition('POSITION_CLOSED', 'IDLE').allowed).toBe(false);
  });
  it('TP3_REACHED → TP1_REACHED is backward', () => {
    expect(validateTradeTransition('TP3_REACHED', 'TP1_REACHED').allowed).toBe(false);
  });
  it('POSITION_OPEN → SETUP_DETECTED jumps backward', () => {
    expect(validateTradeTransition('POSITION_OPEN', 'SETUP_DETECTED').allowed).toBe(false);
  });
  it('same-phase transition is invalid', () => {
    const r = validateTradeTransition('IDLE', 'IDLE');
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('Already in phase');
  });
  it('POST_REVIEW → IDLE is not allowed directly', () => {
    expect(validateTradeTransition('POST_REVIEW', 'IDLE').allowed).toBe(false);
  });
});

describe('getAllowedTransitions', () => {
  it('returns expected phases for POSITION_OPEN', () => {
    const allowed = getAllowedTransitions('POSITION_OPEN');
    expect(allowed).toContain('TP1_REACHED');
    expect(allowed).toContain('POSITION_CLOSED');
    expect(allowed).not.toContain('IDLE');
  });
  it('returns empty array for unknown phase', () => {
    expect(getAllowedTransitions('UNKNOWN' as TradePhase)).toEqual([]);
  });
});
