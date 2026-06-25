import type { KernelEvent, KernelSystemState } from '../types';
import { KernelConfig } from '../KernelConfig';

export function initialSystemDomainState(): KernelSystemState {
  return {
    version:      KernelConfig.itosVersion,
    startedAt:    new Date().toISOString(),
    lastEventSeq: 0n,
    snapshotSeq:  0n,
    eventCount:   0,
    healthy:      true,
    stateVersion: 0n,
  };
}

export function applySystemEvent(state: KernelSystemState, event: KernelEvent): KernelSystemState {
  const p    = event.payload;
  const base = {
    ...state,
    stateVersion:  event.seq,
    lastEventId:   event.id,
    lastEventSeq:  event.seq,
    eventCount:    state.eventCount + 1,
  };

  switch (event.type) {
    case 'KernelInitialized':
      return {
        ...base,
        startedAt:   event.ts,
        healthy:     true,
        snapshotSeq: BigInt(String(p.snapshotSeq ?? 0)),
      };

    case 'SnapshotCreated':
      return { ...base, snapshotSeq: event.seq };

    case 'HealthCheckCompleted':
      return { ...base, healthy: Boolean(p.healthy), healthCheckedAt: event.ts };

    case 'KernelRolledBack':
      return {
        ...base,
        lastEventSeq: BigInt(String(p.rolledBackToSeq ?? state.lastEventSeq)),
      };

    default:
      return base;
  }
}
