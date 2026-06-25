// GET /api/v1/paper/positions/[id] — full position detail + audit trail

import { NextResponse }          from 'next/server';
import { paperPositionService }  from '@/services/trading/PaperPositionService';
import { generateCorrelationId } from '@/core/correlationId';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const correlationId = generateCorrelationId();
  const position = paperPositionService.getPositionById(params.id);

  if (!position) {
    return NextResponse.json(
      { ok: false, correlationId, error: `Position ${params.id} not found` },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    { ok: true, correlationId, position },
    { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Correlation-Id': correlationId } },
  );
}
