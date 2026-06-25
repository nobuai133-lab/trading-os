import type { KernelEvent, ProviderState, ProviderHealthEntry, FailoverEntry } from '../types';

const MAX_FAILOVER_LOG = 50;

export function initialProviderState(): ProviderState {
  return {
    activeProvider: 'kraken',
    providers:      [],
    failoverLog:    [],
    stateVersion:   0n,
  };
}

export function applyProviderEvent(state: ProviderState, event: KernelEvent): ProviderState {
  const p    = event.payload;
  const base = { ...state, stateVersion: event.seq, lastEventId: event.id };

  switch (event.type) {
    case 'ProviderHealthUpdated': {
      const update = p.health as ProviderHealthEntry;
      const providers = state.providers.map((ph) =>
        ph.provider === update.provider ? update : ph,
      );
      if (!providers.find((ph) => ph.provider === update.provider)) {
        providers.push(update);
      }
      return { ...base, providers, lastHealthCheck: event.ts };
    }

    case 'ProviderFailover': {
      const entry: FailoverEntry = {
        from:   p.from   as string,
        to:     p.to     as string,
        reason: p.reason as string,
        ts:     event.ts,
      };
      const log = [...state.failoverLog, entry].slice(-MAX_FAILOVER_LOG);
      return { ...base, activeProvider: entry.to, failoverLog: log };
    }

    default:
      return state;
  }
}
