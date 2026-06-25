// GET /api/v1/replay/[id] — full replay session detail

import { NextResponse }          from 'next/server';
import { replayService }         from '@/services/replay/ReplayService';
import { generateCorrelationId } from '@/core/correlationId';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const correlationId = generateCorrelationId();
  const session       = replayService.getSessionById(params.id);

  if (!session) {
    return NextResponse.json(
      { ok: false, correlationId, error: `Replay session ${params.id} not found` },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    { ok: true, correlationId, session },
    { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Correlation-Id': correlationId } },
  );
}
