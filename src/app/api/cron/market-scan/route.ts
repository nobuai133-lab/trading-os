import { NextRequest, NextResponse }            from 'next/server';
import { fetchOHLCV, fetchCurrentPrice }        from '@/lib/marketData';
import { runStrategyAnalysis, deriveHtfBias }   from '@/lib/strategyEngine';
import { buildDashboardState, persistDashboardState } from '@/lib/stateBuilder';
import { markStaleRanges }                      from '@/lib/memoryEngine';
import { prisma }                               from '@/lib/db';
import { logger }                               from '@/lib/logger';
import { getKernel }                            from '@/kernel/singleton';
import { generateCorrelationId }                from '@/core/correlationId';
import { decisionService }                      from '@/services/decision/DecisionService';

export const runtime = 'nodejs';

const SYMBOLS    = ['BTCUSDT', 'ETHUSDT'];
const TIMEFRAMES = ['4H', '1D'];

// Primary symbol/timeframe that drives the kernel strategy state
const KERNEL_SYMBOL    = 'BTCUSDT';
const KERNEL_TIMEFRAME = '4H';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = req.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  logger.info('cron market-scan started');

  await markStaleRanges();

  const snapshots: { symbol: string; timeframe: string }[] = [];

  // Collect strategy result for the primary kernel symbol/timeframe
  let kernelStrategyPayload: Record<string, unknown> | null = null;

  for (const symbol of SYMBOLS) {
    for (const timeframe of TIMEFRAMES) {
      try {
        const [bars, price] = await Promise.all([
          fetchOHLCV(symbol, timeframe, 200),
          fetchCurrentPrice(symbol),
        ]);

        const analysis = runStrategyAnalysis(bars, timeframe);
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

        // Capture the primary analysis for the kernel strategy state update
        if (symbol === KERNEL_SYMBOL && timeframe === KERNEL_TIMEFRAME) {
          // Derive HTF bias from the 4H regime (1D is handled by its own loop iteration)
          kernelStrategyPayload = {
            symbol,
            timeframe,
            regime:     analysis.regime,
            ema20:      analysis.ema20,
            ema50:      analysis.ema50,
            atr:        analysis.atr,
            confidence: analysis.confidence,
            htfBias:    deriveHtfBias(analysis.regime),
            ltfBias:    deriveHtfBias(analysis.regime),
            keyLevels:  analysis.keyLevels ?? [],
          };
        }

        snapshots.push({ symbol, timeframe });
        logger.info('snapshot saved', { symbol, timeframe, price, regime: analysis.regime });
      } catch (err) {
        logger.error('snapshot failed', { symbol, timeframe, error: String(err) });
      }
    }
  }

  // ── Update kernel strategy state + invalidate decision cache ──────────────────
  if (kernelStrategyPayload) {
    try {
      const kernel = await getKernel();
      if (kernel.isInitialized()) {
        await kernel.writeEvent({
          correlationId: generateCorrelationId(),
          source:        'market-scan',
          domain:        'strategy',
          type:          'StrategyAnalyzed',
          version:       1,
          payload:       kernelStrategyPayload,
        });
        // Force the decision service to recompute on next request
        decisionService.invalidate();
        logger.info('kernel StrategyAnalyzed written', {
          regime: kernelStrategyPayload.regime,
          ema20:  kernelStrategyPayload.ema20,
        });
      }
    } catch (kernelErr) {
      logger.warn('StrategyAnalyzed kernel write failed (non-fatal)', { err: String(kernelErr) });
    }
  }

  // Rebuild and persist dashboard state
  const state = await buildDashboardState();
  await persistDashboardState(state);

  return NextResponse.json({ ok: true, snapshots });
}
