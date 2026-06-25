// GET /api/v1/paper/positions — open positions, closed positions, ledger summary

import { NextResponse }              from 'next/server';
import { paperPositionService }      from '@/services/trading/PaperPositionService';
import { generateCorrelationId }     from '@/core/correlationId';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const correlationId = generateCorrelationId();
  try {
    const openPositions   = paperPositionService.getOpenPositions();
    const closedPositions = paperPositionService.getClosedPositions();
    const summary         = paperPositionService.getLedgerSummary();

    return NextResponse.json(
      { ok: true, correlationId, openPositions, closedPositions, summary },
      { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Correlation-Id': correlationId } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, correlationId, error: String(err) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
