import type { WebhookSignal } from './signalProvider';

export type TradingMode = 'PAPER_TRADING' | 'ALERT_ONLY' | 'LIVE';

export interface RiskDecision {
  allowed: boolean;
  mode: TradingMode;
  reason?: string;
  riskPct: number;
}

function getTradingMode(): TradingMode {
  const raw = (process.env.TRADING_MODE ?? 'PAPER_TRADING').trim().toUpperCase();
  if (raw === 'LIVE') return 'LIVE';
  if (raw === 'ALERT_ONLY') return 'ALERT_ONLY';
  return 'PAPER_TRADING';
}

export function isKillSwitchActive(): boolean {
  return (process.env.KILL_SWITCH ?? '').toLowerCase() === 'true';
}

export function evaluateRisk(signal: WebhookSignal): RiskDecision {
  const mode = getTradingMode();

  if (isKillSwitchActive()) {
    return { allowed: false, mode, reason: 'Kill switch is active', riskPct: 0 };
  }

  const defaultRisk = parseFloat(process.env.DEFAULT_RISK_PCT ?? '1');
  const maxRisk     = parseFloat(process.env.MAX_RISK_PCT     ?? '2');
  const riskPct     = Math.min(signal.riskPct ?? defaultRisk, maxRisk);

  if (signal.rr !== undefined && signal.rr < 1.5) {
    return {
      allowed: false, mode,
      reason:  `RR ${signal.rr.toFixed(2)} below minimum 1.5`,
      riskPct,
    };
  }

  if (signal.grade === 'D') {
    return {
      allowed: false, mode,
      reason:  'Grade D setup rejected',
      riskPct,
    };
  }

  if (signal.confidence !== undefined && signal.confidence < 30) {
    return {
      allowed: false, mode,
      reason:  `Confidence ${signal.confidence}% below minimum 30%`,
      riskPct,
    };
  }

  return { allowed: true, mode, riskPct };
}
