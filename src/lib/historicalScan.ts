import { prisma } from './db';
import { logger } from './logger';
import { fetchOHLCV } from './marketData';
import { runStrategyAnalysis, detectRanges, detectSwings } from './strategyEngine';

const SYMBOLS    = ['BTCUSDT', 'ETHUSDT'];
const TIMEFRAMES = ['4H', '1D'];

// Kraken allows 720 bars max per request — 720 × 4H ≈ 4 months
const HISTORY_LIMIT = 720;

export async function runHistoricalScan(): Promise<{ symbol: string; timeframe: string; ranges: number; levels: number }[]> {
  const results = [];

  for (const symbol of SYMBOLS) {
    for (const timeframe of TIMEFRAMES) {
      try {
        logger.info('historical scan start', { symbol, timeframe });

        const bars     = await fetchOHLCV(symbol, timeframe, HISTORY_LIMIT);
        const analysis = runStrategyAnalysis(bars, timeframe);

        // ── Save market snapshot ─────────────────────────────────────────────
        await prisma.marketSnapshot.create({
          data: {
            symbol,
            timeframe,
            price:  analysis.price,
            open:   analysis.open,
            high:   analysis.high,
            low:    analysis.low,
            regime: analysis.regime,
            ema20:  analysis.ema20,
            ema50:  analysis.ema50,
            atr:    analysis.atr,
          },
        });

        // ── Seed range memory from detected ranges ───────────────────────────
        let rangeCount = 0;
        for (const range of analysis.ranges) {
          const id = `${symbol}-${timeframe}-${range.high}-${range.low}`;
          const exists = await prisma.rangeMemory.findUnique({ where: { id } });
          if (!exists) {
            await prisma.rangeMemory.create({
              data: {
                id,
                symbol,
                timeframe,
                rangeHigh:  range.high,
                rangeLow:   range.low,
                midline:    range.midline,
                width:      range.width,
                status:     'ACTIVE',
                tradeCount: 0,
              },
            });
            rangeCount++;
          }
        }

        // ── Seed range memory from liquidity zones (equal highs/lows) ────────
        for (const level of analysis.keyLevels.filter((l) => l.source === 'LIQUIDITY')) {
          const zoneSize = analysis.atr * 0.5;
          const high     = level.price + zoneSize / 2;
          const low      = level.price - zoneSize / 2;
          const id       = `${symbol}-${timeframe}-LIQ-${Math.round(level.price)}`;

          const exists = await prisma.rangeMemory.findFirst({
            where: {
              symbol,
              timeframe,
              rangeHigh: { gte: level.price - zoneSize, lte: level.price + zoneSize },
            },
          });

          if (!exists) {
            await prisma.rangeMemory.create({
              data: {
                id,
                symbol,
                timeframe,
                rangeHigh:  high,
                rangeLow:   low,
                midline:    level.price,
                width:      high - low,
                status:     'ACTIVE',
                tradeCount: 0,
              },
            }).catch(() => {}); // skip duplicate id errors
            rangeCount++;
          }
        }

        results.push({
          symbol,
          timeframe,
          ranges: rangeCount,
          levels: analysis.keyLevels.length,
        });

        logger.info('historical scan done', { symbol, timeframe, ranges: rangeCount, levels: analysis.keyLevels.length });
      } catch (err) {
        logger.error('historical scan error', { symbol, timeframe, error: String(err) });
      }
    }
  }

  return results;
}
