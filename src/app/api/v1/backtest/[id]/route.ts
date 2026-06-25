import { NextRequest, NextResponse } from 'next/server';
import { backtestService }           from '@/services/backtest/BacktestService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const result = backtestService.getSessionById(params.id);
  return NextResponse.json(result, {
    status: result.ok ? 200 : 404,
    headers: { 'Cache-Control': 'no-store' },
  });
}
