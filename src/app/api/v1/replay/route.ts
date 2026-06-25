// GET /api/v1/replay — list all replay sessions (summaries)

import { NextResponse }          from 'next/server';
import { replayService }         from '@/services/replay/ReplayService';
import { generateCorrelationId } from '@/core/correlationId';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const correlationId = generateCorrelationId();
  try {
    const sessions = replayService.getSessions();
    return NextResponse.json(
      { ok: true, correlationId, sessions },
      { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Correlation-Id': correlationId } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, correlationId, error: String(err) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
