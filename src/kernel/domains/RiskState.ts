import type { KernelEvent, RiskState } from '../types';
import { config } from '@/core/config';

export function initialRiskState(): RiskState {
  return {
    tradingMode:    config.exchange.tradingMode,
    killSwitch:     config.exchange.killSwitch,
    defaultRiskPct: config.exchange.defaultRiskPct,
    maxRiskPct:     config.exchange.maxRiskPct,
    minRr:          config.exchange.minRr,
    minConfidence:  config.exchange.minConfidence,
    activeGates:    [],
    stateVersion:   0n,
  };
}

export function applyRiskEvent(state: RiskState, event: KernelEvent): RiskState {
  const p    = event.payload;
  const base = { ...state, stateVersion: event.seq, lastEventId: event.id };

  switch (event.type) {
    case 'KillSwitchActivated':
      return { ...base, killSwitch: true };

    case 'KillSwitchDeactivated':
      return { ...base, killSwitch: false };

    case 'TradingModeChanged':
      return { ...base, tradingMode: p.mode as RiskState['tradingMode'] };

    case 'RiskDecisionRecorded':
      return {
        ...base,
        lastDecision: {
          allowed: Boolean(p.allowed),
          reason:  p.reason  as string | undefined,
          gate:    p.gate    as string | undefined,
          ts:      event.ts,
        },
      };

    case 'RiskRejected': {
      const gate = p.gate as string;
      const gates = state.activeGates.includes(gate)
        ? state.activeGates
        : [...state.activeGates, gate];
      return { ...base, activeGates: gates };
    }

    case 'RiskApproved':
      return { ...base, activeGates: [] };

    default:
      return state;
  }
}
