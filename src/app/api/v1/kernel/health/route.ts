import { NextResponse }              from 'next/server';
import { getKernelSync }             from '@/kernel/singleton';
import { getMetrics, getRecentDivergences, buildGoLiveStatus } from '@/lib/kernel/metricsCollector';
import { bigIntReplacer }            from '@/kernel/types';
import { generateCorrelationId }     from '@/core/correlationId';
import { logger }                    from '@/core/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = logger.withContext({ service: 'kernel-health-api' });

export async function GET(): Promise<NextResponse> {
  const correlationId = generateCorrelationId();

  try {
    const kernel   = getKernelSync(); // never throws
    const metrics  = await getMetrics();
    const recent   = await getRecentDivergences(10);
    const goLive   = buildGoLiveStatus(metrics, kernel?.isInitialized() ?? false);

    const status =
      (metrics?.criticalDivergences ?? 0) > 0 ? 'critical' :
      (metrics?.warningDivergences  ?? 0) > 0 ? 'degraded' : 'healthy';

    const kernelSummary = kernel?.isInitialized() ? {
      eventCount:     kernel.getEventCount(),
      tradePhase:     kernel.readState('trade').phase,
      lifecycleMode:  kernel.readState('lifecycle').mode,
      lastEventId:    kernel.readState('trade').lastEventId ?? null,
    } : null;

    const payload = {
      ok:          true,
      correlationId,
      authority:   'SystemState',
      shadow:      true,
      status,
      metrics,
      goLive,
      kernelSummary,
      recentDivergences: recent.map((d) => ({
        ...d,
        ts: d.ts.toISOString(),
      })),
    };

    return new NextResponse(
      JSON.stringify(payload, bigIntReplacer),
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
    log.error('kernel health check failed', { correlationId, err: msg });
    return NextResponse.json({ ok: false, error: msg, correlationId }, { status: 500 });
  }
}
