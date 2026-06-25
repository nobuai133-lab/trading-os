import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildDashboardState, persistDashboardState } from '@/lib/stateBuilder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const row = await prisma.systemState.findUnique({ where: { id: 1 } });

  if (row) {
    return NextResponse.json(row.state, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // First-run: build from DB and seed the cache
  const state = await buildDashboardState();
  await persistDashboardState(state);
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
}
