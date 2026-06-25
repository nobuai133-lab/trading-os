// POST /api/v1/replay/reset — reset session to IDLE

import { NextResponse }          from 'next/server';
import { replayService }         from '@/services/replay/ReplayService';
import { generateCorrelationId } from '@/core/correlationId';
import type { ReplayResetRequest } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<NextResponse> {
  const correlationId = generateCorrelationId();
  try {
    const body = await req.json() as ReplayResetRequest;

    if (!body.replayId) {
      return NextResponse.json(
        { ok: false, correlationId, error: 'replayId is required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const result = replayService.resetSession(body.replayId);
    return NextResponse.json(
      { ok: result.ok, correlationId, session: result.session, error: result.error },
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
