import { NextResponse }            from 'next/server';
import { getKernelSync }           from '@/kernel/singleton';
import { bigIntReplacer }          from '@/kernel/types';
import { generateCorrelationId }   from '@/core/correlationId';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const correlationId = generateCorrelationId();

  const kernel = getKernelSync();
  if (!kernel?.isInitialized()) {
    return NextResponse.json(
      { ok: false, correlationId, error: 'Kernel not initialized' },
      { status: 503 },
    );
  }

  const evidence = kernel.readState('evidence');

  const payload = {
    ok: true,
    correlationId,
    authority: 'kernel',
    evidence: {
      symbol:     evidence.symbol,
      grade:      evidence.grade,
      confidence: evidence.confidence,
      categories: evidence.categories,
      tradeId:    evidence.tradeId   ?? null,
      updatedAt:  evidence.lastUpdated,
    },
    meta: {
      stateVersion: evidence.stateVersion.toString(),
      lastEventId:  evidence.lastEventId ?? null,
    },
  };

  return new NextResponse(
    JSON.stringify(payload, bigIntReplacer),
    {
      status:  200,
      headers: {
        'Content-Type':    'application/json',
        'Cache-Control':   'no-store',
        'X-Correlation-Id': correlationId,
        'X-Authority':     'kernel',
      },
    },
  );
}
