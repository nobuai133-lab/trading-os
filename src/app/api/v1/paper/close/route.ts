// POST /api/v1/paper/close — controlled paper position close

import { NextResponse }          from 'next/server';
import { paperPositionService }  from '@/services/trading/PaperPositionService';
import { generateCorrelationId } from '@/core/correlationId';
import type { PaperCloseRequest } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<NextResponse> {
  const correlationId = generateCorrelationId();
  try {
    const body = await req.json() as PaperCloseRequest;

    if (!body.positionId || !body.reason) {
      return NextResponse.json(
        { ok: false, correlationId, error: 'positionId and reason are required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const result = await paperPositionService.closePosition(body);

    return NextResponse.json(
      { ok: result.ok, correlationId, position: result.position, error: result.error },
      {
        status: result.ok ? 200 : 422,
        headers: { 'Cache-Control': 'no-store', 'X-Correlation-Id': correlationId },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, correlationId, error: String(err) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
