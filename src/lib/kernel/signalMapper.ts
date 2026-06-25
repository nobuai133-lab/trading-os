import type { WebhookSignal } from '@/lib/signalProvider';
import type { KernelEventInput } from '@/kernel/types';

// Maps TradingView webhook signal types to Core State Kernel event types.
// Returns null for signals that have no kernel representation yet.
const SIGNAL_TO_KERNEL_TYPE: Record<string, string> = {
  SETUP_DETECTED:  'SetupDetected',
  RISK_APPROVED:   'RiskApproved',
  RISK_REJECTED:   'RiskRejected',
  MEMORY_APPROVED: 'MemoryApproved',
  MEMORY_BLOCKED:  'MemoryBlocked',
  ENTRY_TRIGGERED: 'EntryConfirmed',
  TP1_HIT:         'TP1Hit',
  TP2_HIT:         'TP2Hit',
  TP3_HIT:         'TP3Hit',
  SL_HIT:          'StopLossHit',
  CLOSE_TRADE:     'TradeManuallyClosed',
  TRADE_EXPIRED:   'TradeExpired',
};

export function mapSignalToKernelEvent(
  signal: WebhookSignal,
  correlationId: string,
): KernelEventInput | null {
  const type = SIGNAL_TO_KERNEL_TYPE[signal.signal];
  if (!type) return null;

  return {
    correlationId,
    source:  'webhook',
    domain:  'trade',
    type,
    version: 1,
    setupId: signal.setupId,
    payload: {
      symbol:     signal.symbol,
      timeframe:  signal.timeframe,
      direction:  signal.direction,
      entry:      signal.entryPrice,
      sl:         signal.sl,
      tp1:        signal.tp1,
      tp2:        signal.tp2,
      tp3:        signal.tp3,
      riskPct:    signal.riskPct,
      grade:      signal.grade,
      confidence: signal.confidence,
      // Fingerprint for upstream idempotency tracing (not used as DB key)
      _signalFingerprint: `${signal.signal}:${signal.setupId ?? signal.symbol}`,
    },
  };
}
