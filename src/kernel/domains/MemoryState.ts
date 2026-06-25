import type { KernelEvent, MemoryState, KernelRangeMemory, KernelFingerprint, KernelCooldown } from '../types';

export function initialMemoryState(): MemoryState {
  return {
    rangeMemory:  null,
    fingerprint:  null,
    cooldown:     { active: false, remainingBars: 0, totalBars: 0 },
    blocked:      false,
    nextRequired: [],
    stateVersion: 0n,
  };
}

function recomputeBlocked(state: MemoryState): Pick<MemoryState, 'blocked' | 'blockReason' | 'nextRequired'> {
  const reasons: string[] = [];

  if (state.cooldown.active && state.cooldown.remainingBars > 0) {
    reasons.push(`Cooldown: ${state.cooldown.remainingBars} bar(s) remaining`);
  }
  if (state.fingerprint?.alreadyTraded) {
    reasons.push('Same setup fingerprint already traded');
  }
  if (state.rangeMemory?.status === 'STALE') {
    reasons.push('Range is STALE — needs fresh liquidity');
  }
  if (state.rangeMemory && !state.rangeMemory.reentryAllowed) {
    reasons.push('Range re-entry not allowed');
  }

  return {
    blocked:     reasons.length > 0,
    blockReason: reasons[0],
    nextRequired: reasons,
  };
}

export function applyMemoryEvent(state: MemoryState, event: KernelEvent): MemoryState {
  const p    = event.payload;
  const base = { ...state, stateVersion: event.seq, lastEventId: event.id };

  let next: MemoryState;

  switch (event.type) {
    case 'KernelSystemSeeded': {
      const seededState: MemoryState = {
        ...base,
        rangeMemory:  (p.rangeMemory  as KernelRangeMemory | null)  ?? null,
        fingerprint:  (p.fingerprint  as KernelFingerprint | null)   ?? null,
        cooldown:     (p.cooldown     as KernelCooldown)              ?? { active: false, remainingBars: 0, totalBars: 0 },
        blocked:      Boolean(p.blocked),
        blockReason:  p.blockReason   as string | undefined,
        nextRequired: (p.nextRequired as string[]) ?? [],
      };
      return seededState;
    }

    case 'CooldownStarted': {
      const cooldown: KernelCooldown = {
        active:        true,
        remainingBars: p.bars as number,
        totalBars:     p.bars as number,
        activatedAt:   event.ts,
        reason:        p.reason as string | undefined,
      };
      next = { ...base, cooldown };
      break;
    }

    case 'CooldownDecremented': {
      const remaining = Math.max(0, state.cooldown.remainingBars - 1);
      const cooldown: KernelCooldown = { ...state.cooldown, remainingBars: remaining };
      next = { ...base, cooldown };
      break;
    }

    case 'CooldownFinished':
      next = { ...base, cooldown: { ...state.cooldown, active: false, remainingBars: 0 } };
      break;

    case 'RangeTouched': {
      const range: KernelRangeMemory = {
        rangeId:       p.rangeId    as string,
        status:        (p.status    as string) || 'ACTIVE',
        rangeHigh:     p.rangeHigh  as number,
        rangeLow:      p.rangeLow   as number,
        freshLiquidity: Boolean(p.freshLiquidity ?? true),
        reentryAllowed: Boolean(p.reentryAllowed ?? true),
        tradeCount:    (p.tradeCount as number) ?? 0,
      };
      next = { ...base, rangeMemory: range };
      break;
    }

    case 'RangeTraded': {
      if (!state.rangeMemory) return state;
      const range: KernelRangeMemory = {
        ...state.rangeMemory,
        status:             'TRADED',
        tradeCount:         state.rangeMemory.tradeCount + 1,
        freshLiquidity:     false,
        reentryAllowed:     false,
        lastTradeResult:    p.result    as string | undefined,
        lastTradeDirection: p.direction as string | undefined,
      };
      next = { ...base, rangeMemory: range };
      break;
    }

    case 'RangeReset': {
      if (!state.rangeMemory) return state;
      const range: KernelRangeMemory = {
        ...state.rangeMemory,
        status:         'RESET',
        freshLiquidity: true,
        reentryAllowed: true,
      };
      next = { ...base, rangeMemory: range };
      break;
    }

    case 'FingerprintCreated': {
      const fp: KernelFingerprint = {
        id:            p.id as string,
        alreadyTraded: false,
      };
      next = { ...base, fingerprint: fp };
      break;
    }

    case 'FingerprintTraded': {
      if (!state.fingerprint) return state;
      const fp: KernelFingerprint = {
        ...state.fingerprint,
        alreadyTraded: true,
        tradedAt:      event.ts,
        result:        p.result as string | undefined,
      };
      next = { ...base, fingerprint: fp };
      break;
    }

    case 'BiasReset':
      // Bias reset means the range/cooldown may be cleared
      next = { ...base };
      break;

    default:
      return state;
  }

  // Recompute blocked flag after every memory state change
  return { ...next, ...recomputeBlocked(next) };
}
