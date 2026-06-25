// POST /api/v1/replay/start — create and initialise a new replay session

import { NextResponse }          from 'next/server';
import { replayService }         from '@/services/replay/ReplayService';
import { generateCorrelationId } from '@/core/correlationId';
import type { ReplayStartRequest } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<NextResponse> {
  const correlationId = generateCorrelationId();
  try {
    const body = await req.json() as ReplayStartRequest;

    if (!body.symbol || !body.timeframe || !Array.isArray(body.candles)) {
      return NextResponse.json(
        { ok: false, correlationId, error: 'symbol, timeframe, and candles[] are required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const result = replayService.startSession(body);
    return NextResponse.json(
      { ok: result.ok, correlationId, session: result.session, error: result.error },
      {
        status: result.ok ? 201 : 422,
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
