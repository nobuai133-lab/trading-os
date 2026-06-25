import { NextResponse }           from 'next/server';
import { decisionService }        from '@/services/decision/DecisionService';
import { generateCorrelationId }  from '@/core/correlationId';
import { logger }                 from '@/core/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = logger.withContext({ service: 'decision-api' });

export async function GET(): Promise<NextResponse> {
  const correlationId = generateCorrelationId();

  try {
    const result = await decisionService.getDecision();

    return NextResponse.json(
      {
        ok:             true,
        correlationId,
        authority:      'kernel-derived',
        decision:       {
          outcome:        result.outcome,
          confidence:     result.confidence,
          weightedScore:  result.weightedScore,
          maxScore:       result.maxScore,
          blockingReason: result.blockingReason,
          topSupporting:  result.topSupporting,
          topOpposing:    result.topOpposing,
          nextAction:     result.nextAction,
          computedAt:     result.computedAt,
        },
        weights: result.weights,
        gates:   result.gates,
      },
      {
        status:  200,
        headers: {
          'Cache-Control':    'no-store',
          'X-Correlation-Id': correlationId,
          'X-Authority':      'kernel-derived',
        },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('decision computation failed', { err: msg, correlationId });
    return NextResponse.json(
      { ok: false, correlationId, error: 'Decision computation failed' },
      { status: 500 },
    );
  }
}
