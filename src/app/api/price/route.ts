import { NextRequest, NextResponse } from 'next/server';
import { fetchCurrentPrice } from '@/lib/marketData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const symbol = req.nextUrl.searchParams.get('symbol') ?? 'BTCUSDT';
  try {
    const price = await fetchCurrentPrice(symbol);
    return NextResponse.json({ symbol, price, ts: Date.now() });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
