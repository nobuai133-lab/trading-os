import { NextResponse } from 'next/server';

// Proxies to the btc-analysis server (port 3001) full analysis endpoint.
// The btc-analysis server refreshes every 15 min and maintains its own
// CDP session — we don't need to open competing connections.
export async function GET() {
  try {
    const r = await fetch('http://localhost:3001/api/data', {
      cache: 'no-store',
    });
    if (!r.ok) return NextResponse.json({ error: 'Analysis server unavailable' }, { status: 503 });
    const data = await r.json();

    // Normalise btc-analysis format → trading-os format
    const setupAInvalid = data.invalidated;
    const setupAInZone  = data.inSetupAZone;

    const rawRegime  = data.regime1D ?? data.regime4H ?? 'RANGE';
    const regime     = rawRegime === 'BULLISH' ? 'BULL'
                     : rawRegime === 'BEARISH' ? 'BEAR'
                     : rawRegime;

    return NextResponse.json({
      symbol:     data.symbol,
      price:      data.price,
      regime,
      regimeNote: data.regime1DNote ?? '',
      htfBias:    rawRegime === 'BULLISH' || rawRegime === 'BULL'   ? 'BULLISH'
                : rawRegime === 'BEARISH' || rawRegime === 'BEAR'   ? 'BEARISH'
                : 'NEUTRAL',
      setupA: {
        status:  setupAInvalid ? 'INVALIDATED' : setupAInZone ? 'TRIGGERED' : 'WATCHING',
        inZone:  setupAInZone  ?? false,
        tp1Hit:  data.tp1Hit   ?? false,
        tp2Hit:  data.tp2Hit   ?? false,
        tp3Hit:  data.tp3Hit   ?? false,
      },
      setupB: {
        status: 'WATCHING',
        inZone: false,
      },
      nextRefreshMs: data.nextRefreshMs ?? 0,
      ts: Date.now(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
