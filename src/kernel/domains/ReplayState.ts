import type { KernelEvent, ReplayState } from '../types';

export function initialReplayState(): ReplayState {
  return {
    active:        false,
    fromSeq:       0n,
    toSeq:         0n,
    currentSeq:    0n,
    playbackSpeed: 1,
    paused:        false,
    stateVersion:  0n,
  };
}

export function applyReplayEvent(state: ReplayState, event: KernelEvent): ReplayState {
  const p    = event.payload;
  const base = { ...state, stateVersion: event.seq, lastEventId: event.id };

  switch (event.type) {
    case 'ReplayStarted':
      return {
        ...base,
        active:        true,
        fromSeq:       BigInt(String(p.fromSeq ?? 0)),
        toSeq:         BigInt(String(p.toSeq   ?? 0)),
        currentSeq:    BigInt(String(p.fromSeq ?? 0)),
        playbackSpeed: (p.speed as number) ?? 1,
        paused:        false,
      };

    case 'ReplayStepped':
      return { ...base, currentSeq: BigInt(String(p.seq ?? state.currentSeq)) };

    case 'ReplayPaused':
      return { ...base, paused: true };

    case 'ReplayResumed':
      return { ...base, paused: false };

    case 'ReplayCompleted':
      return { ...base, active: false, paused: false };

    default:
      return state;
  }
}
