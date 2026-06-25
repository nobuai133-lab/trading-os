import { NextResponse } from 'next/server';

// Proxies to the btc-analysis price server (port 3001)
// which maintains a persistent CDP connection to TradingView.
export async function GET() {
  try {
    const r = await fetch('http://localhost:3001/api/price', {
      cache: 'no-store',
    });
    if (!r.ok) return NextResponse.json({ error: 'Price server unavailable' }, { status: 503 });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
