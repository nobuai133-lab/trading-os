import { NextResponse }             from 'next/server';
import { fetchOHLCV, fetchCurrentPrice, marketDataEngine } from '@/lib/marketData';
import type { MarketDataBadge }    from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYMBOL    = 'BTCUSDT';
const TIMEFRAME = '4H';
const CANDLE_4H_STALE_S = 5 * 3600;  // 5 hours

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma':        'no-cache',
  'Expires':       '0',
};

export async function GET(): Promise<NextResponse> {
  try {
    const [bars, price] = await Promise.all([
      fetchOHLCV(SYMBOL, TIMEFRAME, 5),
      fetchCurrentPrice(SYMBOL),
    ]);

    const provider             = marketDataEngine.getActiveProvider();
    const priceBasis           = marketDataEngine.getActiveProviderBasis();
    const latestPriceTimestamp = new Date().toISOString();
    const lastBar              = bars[bars.length - 1];
    const latestClosedCandleTs = new Date(lastBar.openTime).toISOString();
    const candleAgeSeconds     = Math.round((Date.now() - lastBar.openTime) / 1000);

    const isCandleFresh = candleAgeSeconds < CANDLE_4H_STALE_S;
    const fallbackActive = priceBasis === 'SPOT';

    let badge: MarketDataBadge = 'LIVE';
    let warning: string | undefined;

    if (!isCandleFresh) {
      badge   = 'CANDLE_CLOSED';
      warning = `Latest 4H candle is ${Math.round(candleAgeSeconds / 3600)}h old`;
    }

    if (fallbackActive) {
      badge   = badge === 'LIVE' ? 'STALE' : badge;
      warning = warning
        ? `${warning}; spot price reference (${provider}) — may differ from BTCUSDT perpetual`
        : `Spot price reference (${provider}) — may differ from BTCUSDT perpetual`;
    }

    return NextResponse.json({
      provider,
      priceBasis,
      tradedExchange:    priceBasis === 'PERP' ? provider : 'binance-futures (target)',
      tradedSymbol:      'BTCUSDT',
      referenceMarket:   priceBasis === 'PERP' ? 'perpetual' : 'spot',
      fallbackActive,
      providerRank:      1,
      basisWarning:      fallbackActive ? `Using ${provider} spot as perpetual reference` : undefined,
      symbol:                      SYMBOL,
      timeframe:                   TIMEFRAME,
      latestPrice:                 price,
      latestPriceTimestamp,
      latestClosedCandle:          latestClosedCandleTs,
      latestClosedCandleTimestamp: latestClosedCandleTs,
      candleAgeSeconds,
      analysisAgeSeconds:          0,
      isTickerFresh:               true,
      isCandleFresh,
      isAnalysisFresh:             true,
      badge,
      warning,
    }, { headers: NO_CACHE });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      provider:                    'none',
      priceBasis:                  'SPOT' as const,
      tradedExchange:              'none',
      tradedSymbol:                SYMBOL,
      referenceMarket:             'unknown',
      fallbackActive:              false,
      providerRank:                0,
      basisWarning:                undefined,
      symbol:                      SYMBOL,
      timeframe:                   TIMEFRAME,
      latestPrice:                 0,
      latestPriceTimestamp:        new Date().toISOString(),
      latestClosedCandle:          null,
      latestClosedCandleTimestamp: null,
      candleAgeSeconds:            null,
      analysisAgeSeconds:          null,
      isTickerFresh:               false,
      isCandleFresh:               false,
      isAnalysisFresh:             false,
      badge:                       'ERROR' as MarketDataBadge,
      warning:                     msg,
    }, { status: 503, headers: NO_CACHE });
  }
}
