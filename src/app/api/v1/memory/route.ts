// GET /api/v1/memory — comprehensive memory dashboard payload
// Returns: summary + current fingerprint + similarity + top lessons in one call.

import { NextResponse }          from 'next/server';
import { tradeMemoryService }    from '@/services/memory/TradeMemoryService';
import { generateDNA }           from '@/lib/memory/memoryDNA';
import { generateCorrelationId } from '@/core/correlationId';
import { logger }                from '@/core/logger';
import { getKernel }             from '@/kernel/singleton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = logger.withContext({ service: 'memory-api' });

export async function GET(): Promise<NextResponse> {
  const correlationId = generateCorrelationId();

  try {
    await tradeMemoryService.initialize();

    const summary     = await tradeMemoryService.getSummary();
    const fingerprint = await tradeMemoryService.getCurrentFingerprint();
    const experience  = await tradeMemoryService.getExperience();

    // Read current decision confidence for calibration
    let baseConfidence = 50;
    try {
      const kernel = await getKernel();
      if (kernel.isInitialized()) {
        baseConfidence = kernel.readState('evidence').confidence;
      }
    } catch { /* non-fatal */ }

    let similarity = null;
    if (fingerprint) {
      const queryDNA = generateDNA(fingerprint);
      similarity = await tradeMemoryService.getSimilarity(queryDNA, baseConfidence);
    }

    return NextResponse.json(
      {
        ok: true,
        correlationId,
        authority:   'kernel-derived',
        summary,
        fingerprint: fingerprint ?? null,
        similarity:  similarity  ?? null,
        experience: {
          lessons:    experience.slice(0, 5),
          totalCount: experience.length,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control':    'no-store',
          'X-Correlation-Id': correlationId,
          'X-Authority':      'kernel-derived',
        },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('memory endpoint failed', { err: msg, correlationId });
    return NextResponse.json(
      { ok: false, correlationId, error: 'Memory service unavailable' },
      { status: 500 },
    );
  }
}
