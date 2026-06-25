import { NextResponse }           from 'next/server';
import { dashboardService }       from '@/services/dashboard/DashboardService';
import { generateCorrelationId }  from '@/core/correlationId';
import { getAuthorityMode }       from '@/lib/kernel/authorityConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const correlationId = generateCorrelationId();
  const state = await dashboardService.getState();
  return NextResponse.json(state, {
    headers: {
      'Cache-Control':    'no-store',
      'X-Correlation-Id': correlationId,
      'X-Authority':      getAuthorityMode(),
    },
  });
}
