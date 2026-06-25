import { logger }               from '@/core/logger';
import { getKernel }            from '@/kernel/singleton';
import { generateCorrelationId } from '@/core/correlationId';
import { riskOfficeService }    from '@/services/risk/RiskOfficeService';
import {
  createPaperPosition,
  approvePaperPosition,
  openPaperPosition,
  updatePaperPositionMark,
  closePaperPosition,
  cancelPaperPosition,
  computeOpenRiskR,
} from '@/lib/tradeLifecycleEngine';
import type {
  PaperPosition,
  PaperPositionResult,
  PaperLedgerSummary,
  PaperCloseRequest,
  OpenPositionSignal,
  RiskOfficeResult,
} from '@/types';

const log = logger.withContext({ service: 'paper-position' });

function newId(): string {
  return `pp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildSummary(
  open:   PaperPosition[],
  closed: PaperPosition[],
  now:    string,
): PaperLedgerSummary {
  const wins        = closed.filter((p) => p.realizedR > 0);
  const losses      = closed.filter((p) => p.realizedR < 0);
  const breakevens  = closed.filter((p) => p.realizedR === 0);
  const totalRealized  = closed.reduce((s, p) => s + p.realizedR, 0);
  const totalUnrealized = open.reduce((s, p) => s + p.unrealizedR, 0);
  const openExposure    = computeOpenRiskR(open);
  const last            = closed.length > 0 ? closed[closed.length - 1] : null;

  return {
    openCount:        open.length,
    closedCount:      closed.length,
    totalRealizedR:   Math.round(totalRealized * 100) / 100,
    totalUnrealizedR: Math.round(totalUnrealized * 100) / 100,
    openExposureR:    openExposure,
    winCount:         wins.length,
    lossCount:        losses.length,
    breakEvenCount:   breakevens.length,
    winRate:          closed.length > 0 ? Math.round((wins.length / closed.length) * 1000) / 10 : 0,
    avgWinR:          wins.length > 0 ? Math.round(wins.reduce((s, p) => s + p.realizedR, 0) / wins.length * 100) / 100 : 0,
    avgLossR:         losses.length > 0 ? Math.round(losses.reduce((s, p) => s + p.realizedR, 0) / losses.length * 100) / 100 : 0,
    lastClosedAt:     last?.closedAt ?? null,
    lastCloseReason:  last?.closeReason ?? null,
    updatedAt:        now,
  };
}

export class PaperPositionService {
  private _open:   Map<string, PaperPosition> = new Map();
  private _closed: PaperPosition[]            = [];

  // ── Queries ───────────────────────────────────────────────────────────────

  getOpenPositions(): PaperPosition[] {
    return Array.from(this._open.values());
  }

  getClosedPositions(): PaperPosition[] {
    return [...this._closed];
  }

  getPositionById(id: string): PaperPosition | null {
    return this._open.get(id) ?? this._closed.find((p) => p.positionId === id) ?? null;
  }

  getLedgerSummary(): PaperLedgerSummary {
    return buildSummary(
      this.getOpenPositions(),
      this._closed,
      new Date().toISOString(),
    );
  }

  getPortfolioExposure(): number {
    return computeOpenRiskR(this.getOpenPositions());
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  async openPositionFromDecision(
    riskResult: RiskOfficeResult,
    signal:     OpenPositionSignal,
  ): Promise<PaperPositionResult> {
    const budget = riskResult.budget;

    // Concurrent position limit
    if (this._open.size >= budget.maxConcurrentPositions) {
      return { ok: false, position: null, error: `Max concurrent positions (${budget.maxConcurrentPositions}) reached` };
    }

    // Same-symbol limit
    const sameSymbol = Array.from(this._open.values()).filter(
      (p) => p.symbol === signal.symbol,
    ).length;
    if (sameSymbol >= budget.maxSameSymbolPositions) {
      return { ok: false, position: null, error: `Max same-symbol positions (${budget.maxSameSymbolPositions}) for ${signal.symbol} reached` };
    }

    const finalR  = riskResult.positionSize.finalR;
    const posId   = newId();

    const { position: created, error: ce } = createPaperPosition({
      signalId:   signal.signalId,
      symbol:     signal.symbol,
      timeframe:  signal.timeframe,
      direction:  signal.direction,
      entryPrice: signal.entryPrice,
      stopLoss:   signal.stopLoss,
      tp1:        signal.tp1,
      tp2:        signal.tp2,
      tp3:        signal.tp3,
      quantity:   1.0,
      baseRiskR:  riskResult.positionSize.baseR,
      finalRiskR: finalR,
      memoryHash: signal.memoryHash ?? null,
      setupHash:  signal.setupHash  ?? null,
    }, posId);

    if (!created || ce) return { ok: false, position: null, error: ce ?? 'create failed' };

    const { position: approved, error: ae } = approvePaperPosition(created);
    if (!approved || ae) return { ok: false, position: null, error: ae ?? 'approve failed' };

    const { position: opened, error: oe } = openPaperPosition(approved, signal.entryPrice);
    if (!opened || oe) return { ok: false, position: null, error: oe ?? 'open failed' };

    this._open.set(posId, opened);

    log.info('position opened', { posId, symbol: signal.symbol, finalR, direction: signal.direction });
    void this._writeKernelAudit('PaperPositionOpened', posId, {
      symbol: signal.symbol, direction: signal.direction, finalR,
    });
    riskOfficeService.invalidate();

    return { ok: true, position: opened, error: null };
  }

  async markPosition(positionId: string, currentPrice: number): Promise<PaperPositionResult> {
    const pos = this._open.get(positionId);
    if (!pos) return { ok: false, position: null, error: `Position ${positionId} not found in open ledger` };

    const { position: marked, error } = updatePaperPositionMark(pos, currentPrice);
    if (!marked || error) return { ok: false, position: null, error: error ?? 'mark failed' };

    this._open.set(positionId, marked);
    riskOfficeService.invalidate();

    return { ok: true, position: marked, error: null };
  }

  async closePosition(req: PaperCloseRequest): Promise<PaperPositionResult> {
    const pos = this._open.get(req.positionId);
    if (!pos) return { ok: false, position: null, error: `Position ${req.positionId} not found in open ledger` };

    const exitPrice = req.exitPrice ?? pos.currentPrice;
    const { position: closed, error } = closePaperPosition(pos, exitPrice, req.reason);
    if (!closed || error) return { ok: false, position: null, error: error ?? 'close failed' };

    this._open.delete(req.positionId);
    this._closed.push(closed);

    log.info('position closed', { posId: req.positionId, reason: req.reason, realizedR: closed.realizedR });
    void this._writeKernelAudit('PaperPositionClosed', req.positionId, {
      reason: req.reason, realizedR: closed.realizedR, exitPrice,
    });
    riskOfficeService.invalidate();

    return { ok: true, position: closed, error: null };
  }

  async cancelPosition(positionId: string, reason = 'manual cancel'): Promise<PaperPositionResult> {
    const pos = this._open.get(positionId);
    if (!pos) return { ok: false, position: null, error: `Position ${positionId} not found in open ledger` };

    const { position: cancelled, error } = cancelPaperPosition(pos, reason);
    if (!cancelled || error) return { ok: false, position: null, error: error ?? 'cancel failed' };

    this._open.delete(positionId);
    this._closed.push(cancelled);

    log.info('position cancelled', { posId: positionId, reason });
    void this._writeKernelAudit('PaperPositionCancelled', positionId, { reason });
    riskOfficeService.invalidate();

    return { ok: true, position: cancelled, error: null };
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async _writeKernelAudit(
    type:      string,
    positionId: string,
    payload:   Record<string, unknown>,
  ): Promise<void> {
    try {
      const kernel = await getKernel();
      await kernel.writeEvent({
        correlationId: generateCorrelationId(),
        source:        'paper-trading',
        domain:        'trade',
        type,
        version:       1,
        payload:       { positionId, ...payload },
      });
    } catch (err) {
      log.warn(`${type} kernel write failed (non-fatal)`, { err: String(err) });
    }
  }
}

export const paperPositionService = new PaperPositionService();
