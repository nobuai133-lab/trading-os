import { NextRequest, NextResponse } from 'next/server';
import { runHistoricalScan } from '@/lib/historicalScan';
import { buildDashboardState, persistDashboardState } from '@/lib/stateBuilder';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = req.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  logger.info('historical scan triggered');

  const results = await runHistoricalScan();

  const state = await buildDashboardState();
  await persistDashboardState(state);

  logger.info('historical scan complete', { results });

  return NextResponse.json({ ok: true, results });
}
