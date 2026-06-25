// GET /api/v1/risk/status — lightweight status summary for polling

import { NextResponse }        from 'next/server';
import { riskOfficeService }   from '@/services/risk/RiskOfficeService';
import { generateCorrelationId } from '@/core/correlationId';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const correlationId = generateCorrelationId();
  try {
    const r = await riskOfficeService.getResult();
    return NextResponse.json(
      {
        ok:               true,
        correlationId,
        decision:         r.decision,
        riskState:        r.riskState,
        killSwitchActive: r.killSwitchActive,
        finalR:           r.positionSize.finalR,
        cooldownActive:   r.cooldown.active,
        computedAt:       r.computedAt,
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
