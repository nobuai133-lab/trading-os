import type {
  Direction, SetupLifecycleStatus, SetupFingerprint,
  RangeMemory, CooldownState, AntiReentryState, Decision,
} from '@/types';

const BLOCKED_STATUSES: SetupLifecycleStatus[] = [
  'TRADED', 'COMPLETED', 'EXPIRED', 'STALE',
];

export function generateFingerprintId(params: {
  symbol:        string;
  timeframe:     string;
  direction:     Direction;
  rangeHigh:     number;
  rangeLow:      number;
  entryZoneHigh: number;
  entryZoneLow:  number;
}): string {
  const { symbol, timeframe, direction, rangeHigh, rangeLow, entryZoneHigh, entryZoneLow } = params;
  return `${symbol}-${timeframe}-${direction}-RH${rangeHigh}-RL${rangeLow}-EH${entryZoneHigh}-EL${entryZoneLow}`;
}

export function generateRangeId(
  symbol: string, timeframe: string, rangeHigh: number, rangeLow: number,
): string {
  return `${symbol}-${timeframe}-${rangeHigh}-${rangeLow}`;
}

export function isSetupLifecycleBlocked(status: SetupLifecycleStatus): boolean {
  return BLOCKED_STATUSES.includes(status);
}

export function isCooldownActive(cooldown: CooldownState): boolean {
  return cooldown.active && cooldown.remainingBars > 0;
}

// Returns the overridden decision and human-readable reason given anti-reentry state.
export function resolveAntiReentryDecision(
  antiReentry: AntiReentryState,
  candidateDecision: Decision,
): { decision: Decision; reason: string } {
  if (!antiReentry.blocked) {
    return { decision: candidateDecision, reason: '' };
  }

  const { cooldown, setupFingerprint, rangeMemory } = antiReentry;

  if (isCooldownActive(cooldown)) {
    return {
      decision: 'WAIT',
      reason:   `Cooldown active — ${cooldown.remainingBars} bar${cooldown.remainingBars !== 1 ? 's' : ''} remaining. No re-entry allowed.`,
    };
  }

  if (setupFingerprint?.alreadyTraded) {
    return {
      decision: 'WAIT',
      reason:   'Previous setup already traded. Waiting for fresh liquidity.',
    };
  }

  if (rangeMemory?.status === 'STALE') {
    return {
      decision: 'WAIT',
      reason:   'Stale range. No new edge.',
    };
  }

  if (!rangeMemory?.freshLiquidity) {
    return {
      decision: 'WAIT',
      reason:   'No fresh liquidity detected. Previous setup already traded.',
    };
  }

  if (!rangeMemory?.reentryAllowed) {
    return {
      decision: 'NO TRADE',
      reason:   'Re-entry blocked. Range already traded. Wait for structure reset.',
    };
  }

  return { decision: candidateDecision, reason: '' };
}

// Builds the JSON output required by the Claude JSON Output spec.
export function buildCIOOutput(antiReentry: AntiReentryState, decision: Decision, reason: string) {
  return {
    decision,
    reason,
    rangeMemory: antiReentry.rangeMemory
      ? {
          rangeId:            antiReentry.rangeMemory.rangeId,
          status:             antiReentry.rangeMemory.status,
          rangeHigh:          antiReentry.rangeMemory.rangeHigh,
          rangeLow:           antiReentry.rangeMemory.rangeLow,
          tradeCount:         antiReentry.rangeMemory.tradeCount,
          lastTradeDirection: antiReentry.rangeMemory.lastTradeDirection ?? null,
          freshLiquidity:     antiReentry.rangeMemory.freshLiquidity,
          reentryAllowed:     antiReentry.rangeMemory.reentryAllowed,
        }
      : null,
    setupMemory: antiReentry.setupFingerprint
      ? {
          setupId:            antiReentry.setupFingerprint.id,
          status:             antiReentry.setupFingerprint.status,
          sameSetupDetected:  antiReentry.setupFingerprint.sameSetupDetected,
          alreadyTraded:      antiReentry.setupFingerprint.alreadyTraded,
        }
      : null,
    cooldown: {
      active:        antiReentry.cooldown.active,
      remainingBars: antiReentry.cooldown.remainingBars,
    },
    nextRequiredCondition: antiReentry.nextRequiredConditions,
  };
}

// Human-readable message when same setup is detected again.
export function buildHumanMessage(antiReentry: AntiReentryState): string {
  if (antiReentry.cooldown.active) {
    return `WAIT. Cooldown active — ${antiReentry.cooldown.remainingBars} bar(s) remaining. No re-entry from the same range.`;
  }
  if (antiReentry.setupFingerprint?.alreadyTraded) {
    return 'WAIT. This is the same setup/range that was already traded. TP targets were completed. Re-entry is blocked until fresh liquidity or new structure appears.';
  }
  if (antiReentry.rangeMemory?.status === 'STALE') {
    return 'WAIT. Stale range detected. Price is still inside the traded range with no fresh liquidity or structure reset.';
  }
  return 'WAIT. Re-entry blocked. Wait for new liquidity or structure to form.';
}
