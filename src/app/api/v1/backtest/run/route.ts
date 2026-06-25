import { NextRequest, NextResponse } from 'next/server';
import { backtestService }           from '@/services/backtest/BacktestService';
import type { BacktestRunRequest }   from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: BacktestRunRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, session: null, error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.backtestId) {
    return NextResponse.json({ ok: false, session: null, error: 'backtestId required' }, { status: 400 });
  }

  const result = backtestService.runSession(body);
  return NextResponse.json(result, {
    status: result.ok ? 200 : 404,
    headers: { 'Cache-Control': 'no-store' },
  });
}
