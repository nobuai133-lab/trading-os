import { NextRequest, NextResponse } from 'next/server';
import { backtestService }           from '@/services/backtest/BacktestService';
import type { BacktestStartRequest } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: BacktestStartRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, session: null, error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.candles || !Array.isArray(body.candles) || body.candles.length === 0) {
    return NextResponse.json({ ok: false, session: null, error: 'candles array required' }, { status: 400 });
  }
  if (!body.symbol || !body.timeframe) {
    return NextResponse.json({ ok: false, session: null, error: 'symbol and timeframe required' }, { status: 400 });
  }

  const result = backtestService.startSession(body);
  return NextResponse.json(result, {
    status: result.ok ? 201 : 422,
    headers: { 'Cache-Control': 'no-store' },
  });
}
