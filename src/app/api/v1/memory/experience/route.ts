// GET /api/v1/memory/experience — full lessons list sorted by strength.

import { NextResponse }          from 'next/server';
import { tradeMemoryService }    from '@/services/memory/TradeMemoryService';
import { generateCorrelationId } from '@/core/correlationId';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const correlationId = generateCorrelationId();

  const lessons = await tradeMemoryService.getExperience();
  const summary = await tradeMemoryService.getSummary();

  return NextResponse.json(
    {
      ok: true,
      correlationId,
      authority:       'kernel-derived',
      experienceLevel: summary.experienceLevel,
      tradeCount:      summary.tradeCount,
      lessons,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store', 'X-Correlation-Id': correlationId },
    },
  );
}
