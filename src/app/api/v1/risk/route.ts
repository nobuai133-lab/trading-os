// GET /api/v1/risk — full Risk Office result: decision, state, position size, metrics, vetos

import { NextResponse }        from 'next/server';
import { riskOfficeService }   from '@/services/risk/RiskOfficeService';
import { generateCorrelationId } from '@/core/correlationId';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const correlationId = generateCorrelationId();
  try {
    const result = await riskOfficeService.getResult();
    return NextResponse.json(
      { ok: true, correlationId, authority: 'risk-office', ...result },
      { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Correlation-Id': correlationId } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, correlationId, error: String(err) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
