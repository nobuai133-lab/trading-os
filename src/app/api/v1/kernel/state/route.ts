import { NextResponse }          from 'next/server';
import { getKernel }             from '@/kernel/singleton';
import { bigIntReplacer }        from '@/kernel/types';
import { generateCorrelationId } from '@/core/correlationId';
import { logger }                from '@/core/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = logger.withContext({ service: 'kernel-state-api' });

export async function GET(): Promise<NextResponse> {
  const correlationId = generateCorrelationId();

  try {
    const kernel = await getKernel();
    const state  = kernel.readFullState();

    return new NextResponse(
      JSON.stringify({ ok: true, correlationId, state }, bigIntReplacer),
      {
        status:  200,
        headers: {
          'Content-Type':    'application/json',
          'Cache-Control':   'no-store',
          'X-Correlation-Id': correlationId,
        },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('kernel state read failed', { correlationId, err: msg });
    return NextResponse.json({ ok: false, error: msg, correlationId }, { status: 500 });
  }
}
