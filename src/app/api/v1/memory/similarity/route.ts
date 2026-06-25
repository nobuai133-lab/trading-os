// GET /api/v1/memory/similarity — detailed similarity with top 3 winners + losers.
// Uses current kernel setup DNA as query.

import { NextResponse }          from 'next/server';
import { tradeMemoryService }    from '@/services/memory/TradeMemoryService';
import { generateDNA }           from '@/lib/memory/memoryDNA';
import { generateCorrelationId } from '@/core/correlationId';
import { getKernel }             from '@/kernel/singleton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const correlationId = generateCorrelationId();

  const fingerprint = await tradeMemoryService.getCurrentFingerprint();
  if (!fingerprint) {
    return NextResponse.json(
      { ok: false, correlationId, error: 'No current setup fingerprint available' },
      { status: 404 },
    );
  }

  let baseConfidence = 50;
  try {
    const kernel = await getKernel();
    if (kernel.isInitialized()) {
      baseConfidence = kernel.readState('evidence').confidence;
    }
  } catch { /* non-fatal */ }

  const queryDNA  = generateDNA(fingerprint);
  const similarity = await tradeMemoryService.getSimilarity(queryDNA, baseConfidence);

  return NextResponse.json(
    { ok: true, correlationId, authority: 'kernel-derived', fingerprint, queryDNA, similarity },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store', 'X-Correlation-Id': correlationId },
    },
  );
}
