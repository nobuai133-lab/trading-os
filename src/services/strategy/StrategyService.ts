import { runStrategyAnalysis, deriveHtfBias } from '@/lib/strategyEngine';
import { logger }                             from '@/core/logger';
import { generateCorrelationId }              from '@/core/correlationId';
import type { OHLCVBar }                      from '@/lib/marketData/types';

const log = logger.withContext({ service: 'strategy' });

export interface StrategyResult {
  regime:     string;
  ema20:      number;
  ema50:      number;
  atr:        number;
  confidence: number;
  htfBias:    string;
  keyLevels:  unknown[];
}

export class StrategyService {
  analyze(
    bars: OHLCVBar[],
    timeframe: string,
    correlationId = generateCorrelationId(),
  ): StrategyResult {
    log.debug('analyze', { correlationId, timeframe, barCount: bars.length });
    const analysis = runStrategyAnalysis(bars, timeframe);
    return {
      regime:     analysis.regime,
      ema20:      analysis.ema20,
      ema50:      analysis.ema50,
      atr:        analysis.atr,
      confidence: analysis.confidence,
      htfBias:    deriveHtfBias(analysis.regime as Parameters<typeof deriveHtfBias>[0]),
      keyLevels:  analysis.keyLevels ?? [],
    };
  }
}

export const strategyService = new StrategyService();

