// GET /api/v1/risk/governance — budget configuration and defaults

import { NextResponse }        from 'next/server';
import { riskOfficeService }   from '@/services/risk/RiskOfficeService';
import { DEFAULT_RISK_BUDGET } from '@/lib/riskOfficeEngine';
import { generateCorrelationId } from '@/core/correlationId';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const correlationId = generateCorrelationId();
  try {
    const r = await riskOfficeService.getResult();
    return NextResponse.json(
      {
        ok:          true,
        correlationId,
        budget:      r.budget,
        defaults:    DEFAULT_RISK_BUDGET,
        computedAt:  r.computedAt,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Correlation-Id': correlationId } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, correlationId, error: String(err) },
      { status: 500 },
    );
  }
}
