import type { KernelEvent, NotificationState } from '../types';

export function initialNotificationState(): NotificationState {
  return {
    lastSent:      {},
    channels:      [{ channel: 'telegram', healthy: true, lastChecked: new Date(0).toISOString() }],
    rateLimitHits: 0,
    stateVersion:  0n,
  };
}

export function applyNotificationEvent(state: NotificationState, event: KernelEvent): NotificationState {
  const p    = event.payload;
  const base = { ...state, stateVersion: event.seq, lastEventId: event.id };

  switch (event.type) {
    case 'NotificationSent':
      return {
        ...base,
        lastSent: { ...state.lastSent, [p.eventType as string]: event.ts },
      };

    case 'NotificationRateLimited':
      return { ...base, rateLimitHits: state.rateLimitHits + 1 };

    case 'ChannelHealthChanged':
      return {
        ...base,
        channels: state.channels.map((c) =>
          c.channel === (p.channel as string)
            ? { ...c, healthy: Boolean(p.healthy), lastChecked: event.ts }
            : c,
        ),
      };

    default:
      return state;
  }
}
