import type { SetupClassification, SetupType, TrendAlignment, SetupActionability } from '@/types';

type Direction = 'LONG' | 'SHORT';
type Bias      = 'BULL' | 'BEAR' | 'NEUTRAL' | string;

const LONG_CONFIRMATIONS_COUNTER = [
  'Bullish structure break (CHoCH) on 4H',
  'Sell-side liquidity swept before entry',
  'Bullish acceptance above key entry zone',
  'LTF momentum shift to bullish (15m/1H)',
];

const SHORT_CONFIRMATIONS_COUNTER = [
  'Bearish structure break (CHoCH) on 4H',
  'Buy-side liquidity swept before entry',
  'Bearish acceptance below key entry zone',
  'LTF momentum shift to bearish (15m/1H)',
];

const LONG_CONFIRMATIONS_TREND = [
  'Price above EMA20 and EMA50',
  'Higher highs and higher lows structure',
];

const SHORT_CONFIRMATIONS_TREND = [
  'Price below EMA20 and EMA50',
  'Lower highs and lower lows structure',
];

function isBull(bias: Bias): boolean {
  return bias === 'BULL' || bias === 'BULLISH';
}

function isBear(bias: Bias): boolean {
  return bias === 'BEAR' || bias === 'BEARISH';
}

export function classifySetup(
  direction: Direction,
  htfBias:   Bias,
  ltfBias:   Bias,
): SetupClassification {
  const htfBull = isBull(htfBias);
  const htfBear = isBear(htfBias);
  const ltfBull = isBull(ltfBias);
  const ltfBear = isBear(ltfBias);

  if (direction === 'LONG') {
    if (htfBull && ltfBull) {
      return {
        setupType:              'TREND_CONTINUATION_LONG',
        trendAlignment:         'ALIGNED',
        actionability:          'READY',
        requiredConfirmations:  LONG_CONFIRMATIONS_TREND,
        satisfiedConfirmations: LONG_CONFIRMATIONS_TREND,
        missingConfirmations:   [],
        reason:                 'HTF and LTF both bullish — long aligns with trend',
      };
    }

    if (htfBear && ltfBear) {
      return {
        setupType:              'COUNTER_TREND_REVERSAL_LONG',
        trendAlignment:         'CONFLICT',
        actionability:          'CONFIRMATION_REQUIRED',
        requiredConfirmations:  LONG_CONFIRMATIONS_COUNTER,
        satisfiedConfirmations: [],
        missingConfirmations:   LONG_CONFIRMATIONS_COUNTER,
        reason:                 'HTF and LTF both bearish — long is counter-trend; all confirmations required',
      };
    }

    if (htfBull && ltfBear) {
      return {
        setupType:              'RETEST_LONG',
        trendAlignment:         'COUNTER_TREND',
        actionability:          'WATCHING',
        requiredConfirmations:  LONG_CONFIRMATIONS_COUNTER.slice(0, 2),
        satisfiedConfirmations: [],
        missingConfirmations:   LONG_CONFIRMATIONS_COUNTER.slice(0, 2),
        reason:                 'HTF bullish but LTF pulling back — watching for LTF reversal',
      };
    }

    if (htfBear && ltfBull) {
      return {
        setupType:              'COUNTER_TREND_REVERSAL_LONG',
        trendAlignment:         'COUNTER_TREND',
        actionability:          'CONFIRMATION_REQUIRED',
        requiredConfirmations:  LONG_CONFIRMATIONS_COUNTER,
        satisfiedConfirmations: [LONG_CONFIRMATIONS_COUNTER[3]],
        missingConfirmations:   LONG_CONFIRMATIONS_COUNTER.slice(0, 3),
        reason:                 'HTF bearish, LTF recovering — high-risk counter-trend long',
      };
    }
  }

  if (direction === 'SHORT') {
    if (htfBear && ltfBear) {
      return {
        setupType:              'TREND_CONTINUATION_SHORT',
        trendAlignment:         'ALIGNED',
        actionability:          'READY',
        requiredConfirmations:  SHORT_CONFIRMATIONS_TREND,
        satisfiedConfirmations: SHORT_CONFIRMATIONS_TREND,
        missingConfirmations:   [],
        reason:                 'HTF and LTF both bearish — short aligns with trend',
      };
    }

    if (htfBull && ltfBull) {
      return {
        setupType:              'COUNTER_TREND_REVERSAL_SHORT',
        trendAlignment:         'CONFLICT',
        actionability:          'CONFIRMATION_REQUIRED',
        requiredConfirmations:  SHORT_CONFIRMATIONS_COUNTER,
        satisfiedConfirmations: [],
        missingConfirmations:   SHORT_CONFIRMATIONS_COUNTER,
        reason:                 'HTF and LTF both bullish — short is counter-trend; all confirmations required',
      };
    }

    if (htfBear && ltfBull) {
      return {
        setupType:              'RETEST_SHORT',
        trendAlignment:         'COUNTER_TREND',
        actionability:          'WATCHING',
        requiredConfirmations:  SHORT_CONFIRMATIONS_COUNTER.slice(0, 2),
        satisfiedConfirmations: [],
        missingConfirmations:   SHORT_CONFIRMATIONS_COUNTER.slice(0, 2),
        reason:                 'HTF bearish but LTF bouncing — watching for LTF reversal',
      };
    }

    if (htfBull && ltfBear) {
      return {
        setupType:              'COUNTER_TREND_REVERSAL_SHORT',
        trendAlignment:         'COUNTER_TREND',
        actionability:          'CONFIRMATION_REQUIRED',
        requiredConfirmations:  SHORT_CONFIRMATIONS_COUNTER,
        satisfiedConfirmations: [SHORT_CONFIRMATIONS_COUNTER[3]],
        missingConfirmations:   SHORT_CONFIRMATIONS_COUNTER.slice(0, 3),
        reason:                 'HTF bullish, LTF rolling over — high-risk counter-trend short',
      };
    }
  }

  // Neutral / RANGING bias cases
  const setupType: SetupType   = direction === 'LONG' ? 'RANGE_REVERSION_LONG' : 'RANGE_REVERSION_SHORT';
  const alignment: TrendAlignment  = 'COUNTER_TREND';
  const action: SetupActionability = 'WATCHING';
  return {
    setupType,
    trendAlignment:         alignment,
    actionability:          action,
    requiredConfirmations:  [],
    satisfiedConfirmations: [],
    missingConfirmations:   [],
    reason:                 `Neutral/ranging bias — ${direction} setup needs range boundary confirmation`,
  };
}
