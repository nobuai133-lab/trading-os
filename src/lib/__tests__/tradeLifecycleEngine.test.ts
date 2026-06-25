import { describe, it, expect } from 'vitest';
import {
  createPaperPosition,
  approvePaperPosition,
  openPaperPosition,
  updatePaperPositionMark,
  closePaperPosition,
  partialClosePaperPosition,
  cancelPaperPosition,
  rejectPaperPosition,
  computePositionPnL,
  computeOpenRiskR,
  computeLifecycleState,
  computePositionDuration,
  validatePositionTransition,
} from '@/lib/tradeLifecycleEngine';
import type { CreatePaperPositionInput, PaperPosition } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE: CreatePaperPositionInput = {
  signalId:   's1',
  symbol:     'BTCUSDT',
  timeframe:  '4H',
  direction:  'LONG',
  entryPrice: 65_000,
  stopLoss:   64_000,   // 1000 risk distance
  tp1:        66_000,   // 1R
  tp2:        67_000,   // 2R
  tp3:        69_000,   // 4R
  quantity:   1.0,
  baseRiskR:  0.75,
  finalRiskR: 0.75,
  memoryHash: null,
  setupHash:  null,
};

function make(overrides: Partial<CreatePaperPositionInput> = {}): PaperPosition {
  const { position, error } = createPaperPosition({ ...BASE, ...overrides }, 'p1');
  if (error || !position) throw new Error(error ?? 'create failed');
  return position;
}

function makeOpen(overrides: Partial<CreatePaperPositionInput> = {}): PaperPosition {
  const created  = make(overrides);
  const { position: approved } = approvePaperPosition(created);
  const { position: opened }   = openPaperPosition(approved!, 65_000);
  if (!opened) throw new Error('open failed');
  return opened;
}

// ── createPaperPosition ───────────────────────────────────────────────────────

describe('createPaperPosition', () => {
  it('TC-LS01: creates position in PENDING_APPROVAL status', () => {
    const p = make();
    expect(p.status).toBe('PENDING_APPROVAL');
    expect(p.positionId).toBe('p1');
    expect(p.direction).toBe('LONG');
    expect(p.unrealizedR).toBe(0);
    expect(p.realizedR).toBe(0);
  });

  it('TC-LS02: zero quantity returns error', () => {
    const { position, error } = createPaperPosition({ ...BASE, quantity: 0 }, 'p1');
    expect(position).toBeNull();
    expect(error).toMatch(/Quantity/);
  });

  it('TC-LS03: entryPrice equals stopLoss returns error', () => {
    const { position, error } = createPaperPosition({ ...BASE, stopLoss: 65_000 }, 'p1');
    expect(position).toBeNull();
    expect(error).toMatch(/equal/);
  });

  it('TC-LS04: zero entry price returns error', () => {
    const { position, error } = createPaperPosition({ ...BASE, entryPrice: 0 }, 'p1');
    expect(position).toBeNull();
    expect(error).toMatch(/Entry price/);
  });

  it('TC-LS05: negative finalRiskR returns error', () => {
    const { position, error } = createPaperPosition({ ...BASE, finalRiskR: -0.5 }, 'p1');
    expect(position).toBeNull();
    expect(error).toMatch(/risk R/);
  });

  it('TC-LS06: audit trail has CREATED event on construction', () => {
    const p = make();
    expect(p.auditTrail).toHaveLength(1);
    expect(p.auditTrail[0].event).toBe('CREATED');
  });
});

// ── LONG position P&L ─────────────────────────────────────────────────────────

describe('LONG position P&L', () => {
  it('TC-LS07: unrealized profit — price above entry', () => {
    const { position } = updatePaperPositionMark(makeOpen(), 66_000);
    // (66000-65000)/1000 = 1.0R
    expect(position!.unrealizedR).toBeCloseTo(1.0);
  });

  it('TC-LS08: unrealized loss — price below entry', () => {
    const { position } = updatePaperPositionMark(makeOpen(), 64_500);
    // (64500-65000)/1000 = -0.5R
    expect(position!.unrealizedR).toBeCloseTo(-0.5);
  });

  it('TC-LS09: breakeven — price equals entry', () => {
    const { position } = updatePaperPositionMark(makeOpen(), 65_000);
    expect(position!.unrealizedR).toBeCloseTo(0);
  });
});

// ── SHORT position P&L ────────────────────────────────────────────────────────

describe('SHORT position P&L', () => {
  // SHORT: entry=65000, sl=66000 (sl above entry), riskDist=1000
  const shortInput: Partial<CreatePaperPositionInput> = {
    direction:  'SHORT',
    entryPrice: 65_000,
    stopLoss:   66_000,  // above entry for short
    tp1:        64_000,
    tp2:        63_000,
    tp3:        61_000,
  };

  it('TC-LS10: unrealized profit — price below entry', () => {
    const opened = makeOpen(shortInput);
    const { position } = updatePaperPositionMark(opened, 64_000);
    // (65000-64000)/1000 = 1.0R
    expect(position!.unrealizedR).toBeCloseTo(1.0);
  });

  it('TC-LS11: unrealized loss — price above entry', () => {
    const opened = makeOpen(shortInput);
    const { position } = updatePaperPositionMark(opened, 65_500);
    // (65000-65500)/1000 = -0.5R
    expect(position!.unrealizedR).toBeCloseTo(-0.5);
  });
});

// ── closePaperPosition ────────────────────────────────────────────────────────

describe('closePaperPosition', () => {
  it('TC-LS12: stop loss close → negative realizedR', () => {
    const { position } = closePaperPosition(makeOpen(), 64_000, 'STOP_LOSS');
    // (64000-65000)/1000 = -1.0R
    expect(position!.realizedR).toBeCloseTo(-1.0);
    expect(position!.closeReason).toBe('STOP_LOSS');
    expect(position!.status).toBe('CLOSED');
    expect(position!.unrealizedR).toBe(0);
  });

  it('TC-LS13: take profit close → positive realizedR', () => {
    const { position } = closePaperPosition(makeOpen(), 66_500, 'TAKE_PROFIT');
    // (66500-65000)/1000 = 1.5R
    expect(position!.realizedR).toBeCloseTo(1.5);
    expect(position!.closeReason).toBe('TAKE_PROFIT');
  });

  it('TC-LS14: manual close at entry → 0R', () => {
    const { position } = closePaperPosition(makeOpen(), 65_000, 'MANUAL');
    expect(position!.realizedR).toBeCloseTo(0);
    expect(position!.closeReason).toBe('MANUAL');
  });

  it('TC-LS15: risk office kill switch close', () => {
    const { position } = closePaperPosition(makeOpen(), 64_200, 'RISK_OFFICE_KILL_SWITCH');
    expect(position!.closeReason).toBe('RISK_OFFICE_KILL_SWITCH');
    expect(position!.realizedR).toBeCloseTo(-0.8);
  });

  it('TC-LS16: fees reduce realized R', () => {
    const withFees: PaperPosition = { ...makeOpen(), fees: 0.05 };
    const { position } = closePaperPosition(withFees, 66_500, 'TAKE_PROFIT');
    // 1.5R gross - 0.05 fees = 1.45R
    expect(position!.realizedR).toBeCloseTo(1.45);
  });

  it('TC-LS17: slippage reduces realized R', () => {
    const withSlippage: PaperPosition = { ...makeOpen(), slippage: 0.1 };
    const { position } = closePaperPosition(withSlippage, 66_500, 'TAKE_PROFIT');
    // 1.5R gross - 0.1 slippage = 1.4R
    expect(position!.realizedR).toBeCloseTo(1.4);
  });

  it('TC-LS18: zero exit price returns error', () => {
    const { position, error } = closePaperPosition(makeOpen(), 0, 'MANUAL');
    expect(position).toBeNull();
    expect(error).toMatch(/Exit price/);
  });
});

// ── computePositionPnL ────────────────────────────────────────────────────────

describe('computePositionPnL', () => {
  it('TC-LS19: closed position has unrealizedR=0 in P&L', () => {
    const { position } = closePaperPosition(makeOpen(), 66_000, 'TAKE_PROFIT');
    const pnl = computePositionPnL(position!);
    expect(pnl.unrealizedR).toBe(0);
    expect(pnl.realizedR).toBeCloseTo(1.0);
  });

  it('TC-LS20: open position with current price above entry', () => {
    const marked = updatePaperPositionMark(makeOpen(), 66_000).position!;
    const pnl = computePositionPnL(marked);
    expect(pnl.unrealizedR).toBeCloseTo(1.0);
  });
});

// ── validatePositionTransition ────────────────────────────────────────────────

describe('validatePositionTransition', () => {
  it('TC-LS21: PENDING_APPROVAL → APPROVED is valid', () => {
    expect(validatePositionTransition('PENDING_APPROVAL', 'APPROVED').valid).toBe(true);
  });

  it('TC-LS22: APPROVED → OPEN is valid', () => {
    expect(validatePositionTransition('APPROVED', 'OPEN').valid).toBe(true);
  });

  it('TC-LS23: OPEN → CLOSED is valid', () => {
    expect(validatePositionTransition('OPEN', 'CLOSED').valid).toBe(true);
  });

  it('TC-LS24: PENDING_APPROVAL → OPEN is invalid (must go through APPROVED)', () => {
    const r = validatePositionTransition('PENDING_APPROVAL', 'OPEN');
    expect(r.valid).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it('TC-LS25: CLOSED → OPEN is invalid (terminal state)', () => {
    expect(validatePositionTransition('CLOSED', 'OPEN').valid).toBe(false);
  });

  it('TC-LS26: REJECTED → APPROVED is invalid (terminal state)', () => {
    expect(validatePositionTransition('REJECTED', 'APPROVED').valid).toBe(false);
  });

  it('TC-LS27: CANCELLED → any is invalid (terminal state)', () => {
    expect(validatePositionTransition('CANCELLED', 'OPEN').valid).toBe(false);
    expect(validatePositionTransition('CANCELLED', 'APPROVED').valid).toBe(false);
  });
});

// ── computeOpenRiskR ──────────────────────────────────────────────────────────

describe('computeOpenRiskR', () => {
  it('TC-LS28: sums finalRiskR of open positions', () => {
    const p1 = { ...makeOpen(), finalRiskR: 0.5 };
    const p2 = { ...makeOpen(), positionId: 'p2', finalRiskR: 0.75 };
    expect(computeOpenRiskR([p1, p2])).toBeCloseTo(1.25);
  });

  it('TC-LS29: excludes closed positions from exposure', () => {
    const open   = makeOpen();
    const { position: closed } = closePaperPosition(makeOpen(), 66_000, 'TAKE_PROFIT');
    expect(computeOpenRiskR([open, closed!])).toBeCloseTo(open.finalRiskR);
  });
});

// ── computePositionDuration ───────────────────────────────────────────────────

describe('computePositionDuration', () => {
  it('TC-LS30: returns 0 for position not yet opened', () => {
    const pending = make();
    expect(computePositionDuration(pending)).toBe(0);
  });

  it('TC-LS31: returns correct duration in ms for open position', () => {
    const openedAt = new Date(Date.now() - 3_600_000); // 1hr ago
    const p: PaperPosition = { ...makeOpen(), openedAt: openedAt.toISOString() };
    const duration = computePositionDuration(p, new Date());
    expect(duration).toBeGreaterThanOrEqual(3_590_000);
    expect(duration).toBeLessThanOrEqual(3_610_000);
  });
});

// ── computeLifecycleState ─────────────────────────────────────────────────────

describe('computeLifecycleState', () => {
  it('TC-LS32: returns current position status', () => {
    expect(computeLifecycleState(make())).toBe('PENDING_APPROVAL');
    expect(computeLifecycleState(makeOpen())).toBe('OPEN');
  });
});

// ── Partial state ─────────────────────────────────────────────────────────────

describe('partialClosePaperPosition', () => {
  it('TC-LS33: OPEN → PARTIAL transition is valid', () => {
    const { position, error } = partialClosePaperPosition(makeOpen(), 66_000, 'TP1_HIT');
    expect(error).toBeNull();
    expect(position!.status).toBe('PARTIAL');
  });

  it('TC-LS34: partial close accumulates realized R', () => {
    const { position: partial } = partialClosePaperPosition(makeOpen(), 66_000, 'TP1_HIT');
    // partial: 1R at exit=66000, 50% contribution = 0.5R
    expect(partial!.realizedR).toBeCloseTo(0.5);
    // Then full close
    const { position: closed } = closePaperPosition(partial!, 67_000, 'TAKE_PROFIT');
    // gross close = (67000-65000)/1000 = 2R, plus partial 0.5R = 2.5R
    expect(closed!.realizedR).toBeCloseTo(2.5);
  });
});

// ── Audit trail ───────────────────────────────────────────────────────────────

describe('audit trail', () => {
  it('TC-LS35: events accumulate through full lifecycle', () => {
    const created  = make();
    const { position: approved } = approvePaperPosition(created);
    const { position: opened }   = openPaperPosition(approved!, 65_000);
    const { position: closed }   = closePaperPosition(opened!, 66_000, 'TAKE_PROFIT');

    const events = closed!.auditTrail.map((e) => e.event);
    expect(events).toContain('CREATED');
    expect(events).toContain('APPROVED');
    expect(events).toContain('OPENED');
    expect(events).toContain('CLOSED');
    expect(closed!.auditTrail.length).toBeGreaterThanOrEqual(4);
  });

  it('TC-LS36: cancel adds CANCELLED audit event', () => {
    const { position } = cancelPaperPosition(make(), 'test reason');
    const events = position!.auditTrail.map((e) => e.event);
    expect(events).toContain('CANCELLED');
  });

  it('TC-LS37: reject adds REJECTED audit event', () => {
    const { position } = rejectPaperPosition(make(), 'risk office blocked');
    const events = position!.auditTrail.map((e) => e.event);
    expect(events).toContain('REJECTED');
  });
});

// ── updatePaperPositionMark edge cases ────────────────────────────────────────

describe('updatePaperPositionMark edge cases', () => {
  it('TC-LS38: cannot mark a closed position', () => {
    const { position: closed } = closePaperPosition(makeOpen(), 66_000, 'TAKE_PROFIT');
    const { position, error }  = updatePaperPositionMark(closed!, 67_000);
    expect(position).toBeNull();
    expect(error).toMatch(/CLOSED/);
  });

  it('TC-LS39: zero current price returns error', () => {
    const { position, error } = updatePaperPositionMark(makeOpen(), 0);
    expect(position).toBeNull();
    expect(error).toMatch(/positive/);
  });

  it('TC-LS40: mark does not change status', () => {
    const { position } = updatePaperPositionMark(makeOpen(), 64_500);
    expect(position!.status).toBe('OPEN');
  });
});
