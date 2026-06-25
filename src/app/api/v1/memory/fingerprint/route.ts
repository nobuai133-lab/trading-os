// GET /api/v1/memory/fingerprint — current setup fingerprint + DNA from kernel state.

import { NextResponse }          from 'next/server';
import { tradeMemoryService }    from '@/services/memory/TradeMemoryService';
import { generateDNA, dnaToString } from '@/lib/memory/memoryDNA';
import { generateCorrelationId } from '@/core/correlationId';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const correlationId = generateCorrelationId();

  const fingerprint = await tradeMemoryService.getCurrentFingerprint();
  if (!fingerprint) {
    return NextResponse.json(
      { ok: false, correlationId, error: 'Kernel not initialized or no active setup' },
      { status: 404 },
    );
  }

  const dna = generateDNA(fingerprint);

  return NextResponse.json(
    {
      ok: true,
      correlationId,
      authority:    'kernel-derived',
      fingerprint,
      dna,
      dnaString:    dnaToString(dna),
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store', 'X-Correlation-Id': correlationId },
    },
  );
}
