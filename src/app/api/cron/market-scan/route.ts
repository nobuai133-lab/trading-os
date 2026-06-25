import { NextRequest, NextResponse } from 'next/server';
import { fetchOHLCV, fetchCurrentPrice } from '@/lib/marketData';
import { runStrategyAnalysis } from '@/lib/strategyEngine';
import { buildDashboardState, persistDashboardState } from '@/lib/stateBuilder';
import { markStaleRanges } from '@/lib/memoryEngine';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const SYMBOLS    = ['BTCUSDT', 'ETHUSDT'];
const TIMEFRAMES = ['4H', '1D'];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = req.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  logger.info('cron market-scan started');

  await markStaleRanges();

  const snapshots: { symbol: string; timeframe: string }[] = [];

  for (const symbol of SYMBOLS) {
    for (const timeframe of TIMEFRAMES) {
      try {
        const [bars, price] = await Promise.all([
          fetchOHLCV(symbol, timeframe, 200),
          fetchCurrentPrice(symbol),
        ]);

        const analysis = runStrategyAnalysis(bars);
        const last     = bars[bars.length - 1];

        await prisma.marketSnapshot.create({
          data: {
            symbol,
            timeframe,
            price,
            open:   last.open,
            high:   last.high,
            low:    last.low,
            regime: analysis.regime,
            ema20:  analysis.ema20,
            ema50:  analysis.ema50,
            atr:    analysis.atr,
          },
        });

        snapshots.push({ symbol, timeframe });
        logger.info('snapshot saved', { symbol, timeframe, price, regime: analysis.regime });
      } catch (err) {
        logger.error('snapshot failed', { symbol, timeframe, error: String(err) });
      }
    }
  }

  // Rebuild and persist dashboard state
  const state = await buildDashboardState();
  await persistDashboardState(state);

  return NextResponse.json({ ok: true, snapshots });
}
