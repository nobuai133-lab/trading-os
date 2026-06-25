import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { evaluateRisk, isKillSwitchActive } from '../riskEngine';
import type { WebhookSignal } from '../signalProvider';

const BASE_SIGNAL: WebhookSignal = {
  symbol:    'BTCUSDT',
  timeframe: '4H',
  signal:    'SETUP_DETECTED',
  direction: 'LONG',
  rr:        2.0,
  grade:     'B',
  confidence: 60,
  riskPct:   1,
};

function withEnv(vars: Record<string, string>, fn: () => void) {
  const original: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    original[k] = process.env[k];
    process.env[k] = vars[k];
  }
  try { fn(); }
  finally {
    for (const k of Object.keys(vars)) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  }
}

describe('evaluateRisk', () => {
  it('allows a valid signal in paper mode', () => {
    withEnv({ TRADING_MODE: 'PAPER_TRADING', KILL_SWITCH: 'false' }, () => {
      const result = evaluateRisk(BASE_SIGNAL);
      expect(result.allowed).toBe(true);
      expect(result.mode).toBe('PAPER_TRADING');
    });
  });

  it('blocks when kill switch is active', () => {
    withEnv({ KILL_SWITCH: 'true' }, () => {
      const result = evaluateRisk(BASE_SIGNAL);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/kill switch/i);
    });
  });

  it('blocks grade D signals', () => {
    withEnv({ KILL_SWITCH: 'false' }, () => {
      const result = evaluateRisk({ ...BASE_SIGNAL, grade: 'D' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/grade/i);
    });
  });

  it('blocks when RR is below minimum', () => {
    withEnv({ KILL_SWITCH: 'false' }, () => {
      const result = evaluateRisk({ ...BASE_SIGNAL, rr: 1.0 });
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/rr/i);
    });
  });

  it('blocks when confidence is below minimum', () => {
    withEnv({ KILL_SWITCH: 'false' }, () => {
      const result = evaluateRisk({ ...BASE_SIGNAL, confidence: 20 });
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/confidence/i);
    });
  });

  it('caps riskPct at MAX_RISK_PCT', () => {
    withEnv({ KILL_SWITCH: 'false', MAX_RISK_PCT: '1.5' }, () => {
      const result = evaluateRisk({ ...BASE_SIGNAL, riskPct: 3.0 });
      expect(result.riskPct).toBe(1.5);
    });
  });

  it('uses DEFAULT_RISK_PCT when signal has no riskPct', () => {
    withEnv({ KILL_SWITCH: 'false', DEFAULT_RISK_PCT: '0.75' }, () => {
      const { riskPct: _, ...noRisk } = BASE_SIGNAL;
      const result = evaluateRisk(noRisk as WebhookSignal);
      expect(result.riskPct).toBe(0.75);
    });
  });
});

describe('isKillSwitchActive', () => {
  it('returns true when KILL_SWITCH=true', () => {
    withEnv({ KILL_SWITCH: 'true' }, () => {
      expect(isKillSwitchActive()).toBe(true);
    });
  });

  it('returns false when KILL_SWITCH is unset', () => {
    withEnv({ KILL_SWITCH: '' }, () => {
      expect(isKillSwitchActive()).toBe(false);
    });
  });
});
