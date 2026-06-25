import { EventEmitter } from 'events';

// ── Typed event payloads ──────────────────────────────────────────────────────

export interface EventPayloads {
  'market.updated':     { symbol: string; price: number; regime: string; provider: string; ts: number };
  'provider.changed':   { from: string; to: string; reason: string; ts: number };
  'signal.created':     { correlationId: string; symbol: string; signal: string; grade?: string };
  'signal.rejected':    { correlationId: string; symbol: string; reason: string };
  'trade.opened':       { correlationId: string; tradeId: string; symbol: string; direction: string; entry: number };
  'trade.closed':       { correlationId: string; tradeId: string; reason: string; resultR: number };
  'tp1.hit':            { correlationId: string; tradeId: string; price: number };
  'tp2.hit':            { correlationId: string; tradeId: string; price: number };
  'tp3.hit':            { correlationId: string; tradeId: string; price: number };
  'trade.expired':      { correlationId: string; tradeId: string };
  'cooldown.started':   { symbol: string; timeframe: string; bars: number; reason: string };
  'cooldown.finished':  { symbol: string; timeframe: string };
  'bias.reset':         { symbol: string; timeframe: string; previousBias: string };
  'memory.updated':     { symbol: string; type: 'range' | 'fingerprint' | 'cooldown' };
  'evidence.changed':   { correlationId: string; symbol: string; confidence: number; grade: string };
  'risk.rejected':      { correlationId: string; symbol: string; reason: string; gate: string };
}

export type EventName = keyof EventPayloads;

// ── Typed EventEmitter wrapper ────────────────────────────────────────────────

class TypedEventBus extends EventEmitter {
  emit<K extends EventName>(event: K, payload: EventPayloads[K]): boolean {
    return super.emit(event as string, payload);
  }

  on<K extends EventName>(event: K, listener: (payload: EventPayloads[K]) => void): this {
    return super.on(event as string, listener as (...args: unknown[]) => void);
  }

  off<K extends EventName>(event: K, listener: (payload: EventPayloads[K]) => void): this {
    return super.off(event as string, listener as (...args: unknown[]) => void);
  }

  once<K extends EventName>(event: K, listener: (payload: EventPayloads[K]) => void): this {
    return super.once(event as string, listener as (...args: unknown[]) => void);
  }
}

export const eventBus = new TypedEventBus();
eventBus.setMaxListeners(50);
