import { NextRequest, NextResponse } from 'next/server';
import { fetchOHLCV, fetchCurrentPrice } from '@/lib/marketData';
import { runStrategyAnalysis } from '@/lib/strategyEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const symbol    = req.nextUrl.searchParams.get('symbol')    ?? 'BTCUSDT';
  const timeframe = req.nextUrl.searchParams.get('timeframe') ?? '4H';

  try {
    const [bars, price] = await Promise.all([
      fetchOHLCV(symbol, timeframe, 200),
      fetchCurrentPrice(symbol),
    ]);

    const result = runStrategyAnalysis(bars);

    return NextResponse.json({
      symbol,
      timeframe,
      price,
      regime:  result.regime,
      ema20:   result.ema20,
      ema50:   result.ema50,
      atr:     result.atr,
      ts:      Date.now(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
