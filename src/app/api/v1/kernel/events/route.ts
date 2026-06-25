import { NextRequest, NextResponse }  from 'next/server';
import { prisma }                    from '@/lib/db';
import { bigIntReplacer }            from '@/kernel/types';
import { generateCorrelationId }     from '@/core/correlationId';
import { logger }                    from '@/core/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log     = logger.withContext({ service: 'kernel-events-api' });
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const correlationId = generateCorrelationId();

  const rawLimit = req.nextUrl.searchParams.get('limit');
  const rawDomain = req.nextUrl.searchParams.get('domain');
  const rawType   = req.nextUrl.searchParams.get('type');

  const limit = Math.min(
    Math.max(1, parseInt(rawLimit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    MAX_LIMIT,
  );

  try {
    const where: Record<string, unknown> = {};
    if (rawDomain) where.domain = rawDomain;
    if (rawType)   where.type   = rawType;

    const events = await prisma.kernelEvent.findMany({
      where,
      orderBy: { seq: 'desc' },
      take:    limit,
    });

    return new NextResponse(
      JSON.stringify({
        ok: true,
        correlationId,
        count:  events.length,
        events: events.map((e) => ({
          ...e,
          seq:         e.seq.toString(),
          previousSeq: e.previousSeq.toString(),
          ts:          e.ts.toISOString(),
        })),
      }),
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
    log.error('kernel events read failed', { correlationId, err: msg });
    return NextResponse.json({ ok: false, error: msg, correlationId }, { status: 500 });
  }
}
