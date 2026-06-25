import type {
  TradeDirection, PaperPositionStatus, PaperCloseReason,
  PaperPosition, PositionAuditEvent, CreatePaperPositionInput,
} from '@/types';

// ── State machine ─────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<PaperPositionStatus, PaperPositionStatus[]> = {
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED:         ['OPEN', 'CANCELLED'],
  OPEN:             ['PARTIAL', 'CLOSED', 'ERROR'],
  PARTIAL:          ['CLOSED', 'ERROR'],
  CLOSED:           [],
  REJECTED:         [],
  CANCELLED:        [],
  ERROR:            [],
};

export function validatePositionTransition(
  from: PaperPositionStatus,
  to:   PaperPositionStatus,
): { valid: boolean; reason?: string } {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      valid:  false,
      reason: `Transition ${from} → ${to} is not permitted`,
    };
  }
  return { valid: true };
}

export function isTerminalStatus(status: PaperPositionStatus): boolean {
  return ['CLOSED', 'REJECTED', 'CANCELLED', 'ERROR'].includes(status);
}

// ── Audit trail ───────────────────────────────────────────────────────────────

function audit(
  position: PaperPosition,
  event:    string,
  details:  Record<string, unknown>,
  now:      Date,
): PaperPosition {
  const entry: PositionAuditEvent = { ts: now.toISOString(), event, details };
  return { ...position, auditTrail: [...position.auditTrail, entry] };
}

// ── P&L helpers ───────────────────────────────────────────────────────────────

function riskDist(p: PaperPosition): number {
  return Math.abs(p.entryPrice - p.stopLoss);
}

function calcR(entry: number, exit: number, dist: number, dir: TradeDirection): number {
  if (dist === 0) return 0;
  const raw = dir === 'LONG'
    ? (exit - entry) / dist
    : (entry - exit) / dist;
  return Math.round(raw * 100) / 100;
}

// ── computePositionPnL ────────────────────────────────────────────────────────

export function computePositionPnL(
  position: PaperPosition,
): { unrealizedR: number; realizedR: number; realizedPnL: number } {
  const dist = riskDist(position);

  let unrealizedR = 0;
  if ((position.status === 'OPEN' || position.status === 'PARTIAL') && dist > 0) {
    unrealizedR = calcR(position.entryPrice, position.currentPrice, dist, position.direction);
  }

  const netR = Math.round((position.realizedR - position.fees - position.slippage) * 100) / 100;

  return { unrealizedR, realizedR: netR, realizedPnL: netR };
}

// ── computeOpenRiskR ──────────────────────────────────────────────────────────

export function computeOpenRiskR(positions: PaperPosition[]): number {
  return Math.round(
    positions
      .filter((p) => p.status === 'OPEN' || p.status === 'PARTIAL')
      .reduce((sum, p) => sum + p.finalRiskR, 0) * 100,
  ) / 100;
}

// ── computeLifecycleState ─────────────────────────────────────────────────────

export function computeLifecycleState(position: PaperPosition): PaperPositionStatus {
  return position.status;
}

// ── computePositionDuration ───────────────────────────────────────────────────

export function computePositionDuration(
  position: PaperPosition,
  now: Date = new Date(),
): number {
  if (!position.openedAt) return 0;
  return Math.max(0, now.getTime() - new Date(position.openedAt).getTime());
}

// ── createPaperPosition ───────────────────────────────────────────────────────

export function createPaperPosition(
  input:      CreatePaperPositionInput,
  positionId: string,
  now:        Date = new Date(),
): { position: PaperPosition | null; error: string | null } {
  if (input.quantity <= 0) {
    return { position: null, error: 'Quantity must be positive' };
  }
  if (input.entryPrice <= 0) {
    return { position: null, error: 'Entry price must be positive' };
  }
  if (input.entryPrice === input.stopLoss) {
    return { position: null, error: 'Entry price cannot equal stop loss (zero risk distance)' };
  }
  if (input.finalRiskR <= 0) {
    return { position: null, error: 'Final risk R must be positive' };
  }

  const ts = now.toISOString();
  const position: PaperPosition = {
    positionId,
    signalId:     input.signalId,
    memoryHash:   input.memoryHash,
    setupHash:    input.setupHash,
    symbol:       input.symbol,
    timeframe:    input.timeframe,
    direction:    input.direction,
    entryPrice:   input.entryPrice,
    stopLoss:     input.stopLoss,
    takeProfit:   input.tp1,
    tp1:          input.tp1,
    tp2:          input.tp2,
    tp3:          input.tp3,
    quantity:     input.quantity,
    baseRiskR:    input.baseRiskR,
    finalRiskR:   input.finalRiskR,
    openedAt:     null,
    updatedAt:    ts,
    closedAt:     null,
    status:       'PENDING_APPROVAL',
    currentPrice: input.entryPrice,
    unrealizedR:  0,
    realizedR:    0,
    realizedPnL:  0,
    fees:         0,
    slippage:     0,
    closeReason:  null,
    auditTrail:   [{
      ts,
      event:   'CREATED',
      details: {
        direction:  input.direction,
        entryPrice: input.entryPrice,
        stopLoss:   input.stopLoss,
        finalRiskR: input.finalRiskR,
      },
    }],
  };

  return { position, error: null };
}

// ── approvePaperPosition ──────────────────────────────────────────────────────

export function approvePaperPosition(
  position: PaperPosition,
  now: Date = new Date(),
): { position: PaperPosition | null; error: string | null } {
  const check = validatePositionTransition(position.status, 'APPROVED');
  if (!check.valid) return { position: null, error: check.reason ?? null };

  const updated = audit(
    { ...position, status: 'APPROVED', updatedAt: now.toISOString() },
    'APPROVED', {}, now,
  );
  return { position: updated, error: null };
}

// ── rejectPaperPosition ───────────────────────────────────────────────────────

export function rejectPaperPosition(
  position: PaperPosition,
  reason:   string,
  now:      Date = new Date(),
): { position: PaperPosition | null; error: string | null } {
  const check = validatePositionTransition(position.status, 'REJECTED');
  if (!check.valid) return { position: null, error: check.reason ?? null };

  const updated = audit(
    { ...position, status: 'REJECTED', updatedAt: now.toISOString() },
    'REJECTED', { reason }, now,
  );
  return { position: updated, error: null };
}

// ── openPaperPosition ─────────────────────────────────────────────────────────

export function openPaperPosition(
  position:  PaperPosition,
  openPrice: number,
  now:       Date = new Date(),
): { position: PaperPosition | null; error: string | null } {
  const check = validatePositionTransition(position.status, 'OPEN');
  if (!check.valid) return { position: null, error: check.reason ?? null };
  if (openPrice <= 0) return { position: null, error: 'Open price must be positive' };

  const ts = now.toISOString();
  const updated = audit(
    {
      ...position,
      status:       'OPEN',
      entryPrice:   openPrice,
      currentPrice: openPrice,
      openedAt:     ts,
      updatedAt:    ts,
    },
    'OPENED', { openPrice }, now,
  );
  return { position: updated, error: null };
}

// ── updatePaperPositionMark ───────────────────────────────────────────────────

export function updatePaperPositionMark(
  position:     PaperPosition,
  currentPrice: number,
  now:          Date = new Date(),
): { position: PaperPosition | null; error: string | null } {
  if (position.status !== 'OPEN' && position.status !== 'PARTIAL') {
    return { position: null, error: `Cannot mark price on ${position.status} position` };
  }
  if (currentPrice <= 0) {
    return { position: null, error: 'Current price must be positive' };
  }

  const dist = riskDist(position);
  const unrealizedR = dist > 0
    ? calcR(position.entryPrice, currentPrice, dist, position.direction)
    : 0;

  return {
    position: { ...position, currentPrice, unrealizedR, updatedAt: now.toISOString() },
    error: null,
  };
}

// ── partialClosePaperPosition ─────────────────────────────────────────────────

export function partialClosePaperPosition(
  position:  PaperPosition,
  exitPrice: number,
  label:     string,
  now:       Date = new Date(),
): { position: PaperPosition | null; error: string | null } {
  const check = validatePositionTransition(position.status, 'PARTIAL');
  if (!check.valid) return { position: null, error: check.reason ?? null };
  if (exitPrice <= 0) return { position: null, error: 'Exit price must be positive' };

  const dist = riskDist(position);
  const partialR = dist > 0
    ? calcR(position.entryPrice, exitPrice, dist, position.direction)
    : 0;

  // 50% of position closed at partial exit
  const partialContribution = Math.round(partialR * 0.5 * 100) / 100;

  const ts = now.toISOString();
  const updated = audit(
    {
      ...position,
      status:      'PARTIAL',
      currentPrice: exitPrice,
      realizedR:   Math.round((position.realizedR + partialContribution) * 100) / 100,
      updatedAt:   ts,
    },
    'PARTIAL_CLOSE', { exitPrice, label, partialR, partialContribution }, now,
  );
  return { position: updated, error: null };
}

// ── closePaperPosition ────────────────────────────────────────────────────────

export function closePaperPosition(
  position:  PaperPosition,
  exitPrice: number,
  reason:    PaperCloseReason,
  now:       Date = new Date(),
): { position: PaperPosition | null; error: string | null } {
  const check = validatePositionTransition(position.status, 'CLOSED');
  if (!check.valid) return { position: null, error: check.reason ?? null };
  if (exitPrice <= 0) return { position: null, error: 'Exit price must be positive' };

  const dist = riskDist(position);
  const grossR = dist > 0
    ? calcR(position.entryPrice, exitPrice, dist, position.direction)
    : 0;

  // Add any previously realized partial R, subtract fees + slippage
  const totalR = Math.round(
    (position.realizedR + grossR - position.fees - position.slippage) * 100,
  ) / 100;

  const ts = now.toISOString();
  const updated = audit(
    {
      ...position,
      status:       'CLOSED',
      currentPrice: exitPrice,
      unrealizedR:  0,
      realizedR:    totalR,
      realizedPnL:  totalR,
      closeReason:  reason,
      closedAt:     ts,
      updatedAt:    ts,
    },
    'CLOSED', { exitPrice, reason, grossR, totalR }, now,
  );
  return { position: updated, error: null };
}

// ── cancelPaperPosition ───────────────────────────────────────────────────────

export function cancelPaperPosition(
  position: PaperPosition,
  reason:   string,
  now:      Date = new Date(),
): { position: PaperPosition | null; error: string | null } {
  const check = validatePositionTransition(position.status, 'CANCELLED');
  if (!check.valid) return { position: null, error: check.reason ?? null };

  const updated = audit(
    { ...position, status: 'CANCELLED', updatedAt: now.toISOString() },
    'CANCELLED', { reason }, now,
  );
  return { position: updated, error: null };
}
