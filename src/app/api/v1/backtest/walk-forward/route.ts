import { NextRequest, NextResponse } from 'next/server';
import { backtestService }           from '@/services/backtest/BacktestService';
import type { BacktestStartRequest, WalkForwardConfig } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: BacktestStartRequest & { walkForward?: WalkForwardConfig };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, result: null, error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.candles || !Array.isArray(body.candles) || body.candles.length === 0) {
    return NextResponse.json({ ok: false, result: null, error: 'candles array required' }, { status: 400 });
  }
  if (!body.symbol || !body.timeframe) {
    return NextResponse.json({ ok: false, result: null, error: 'symbol and timeframe required' }, { status: 400 });
  }

  const wfConfig: WalkForwardConfig = body.walkForward ?? { numWindows: 3, inSampleRatio: 0.7 };
  const result = backtestService.runWalkForwardAnalysis(body, wfConfig);

  return NextResponse.json(result, {
    status: result.ok ? 200 : 422,
    headers: { 'Cache-Control': 'no-store' },
  });
}
