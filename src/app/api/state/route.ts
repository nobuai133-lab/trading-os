import { NextResponse }           from 'next/server';
import { dashboardService }       from '@/services/dashboard/DashboardService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const state = await dashboardService.getState();
  return NextResponse.json(state, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
