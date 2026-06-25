import { NextResponse }     from 'next/server';
import { backtestService }  from '@/services/backtest/BacktestService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  const body = backtestService.getSessions();
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
