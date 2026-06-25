import type { KernelLifecycleMode } from '../types';

const VALID_MODE_TRANSITIONS: Record<KernelLifecycleMode, KernelLifecycleMode[]> = {
  IDLE:              ['SETUP_DETECTED', 'COOLDOWN'],
  SETUP_DETECTED:    ['WAIT_CONFIRMATION', 'IDLE', 'COOLDOWN'],
  WAIT_CONFIRMATION: ['ENTRY_READY', 'IDLE', 'COOLDOWN'],
  ENTRY_READY:       ['ACTIVE_TRADE', 'IDLE', 'COOLDOWN'],
  ACTIVE_TRADE:      ['POST_TRADE_REVIEW', 'COOLDOWN'],
  POST_TRADE_REVIEW: ['WAIT_NEW_SETUP', 'SETUP_DETECTED', 'COOLDOWN'],
  WAIT_NEW_SETUP:    ['SETUP_DETECTED', 'IDLE', 'COOLDOWN'],
  COOLDOWN:          ['IDLE', 'SETUP_DETECTED'],
};

export interface ModeTransitionResult {
  allowed: boolean;
  reason?: string;
}

export function validateModeTransition(from: KernelLifecycleMode, to: KernelLifecycleMode): ModeTransitionResult {
  if (from === to) {
    return { allowed: false, reason: `Already in mode ${from}` };
  }
  const allowed = VALID_MODE_TRANSITIONS[from]?.includes(to) ?? false;
  if (!allowed) {
    const valid = VALID_MODE_TRANSITIONS[from]?.join(', ') ?? 'none';
    return { allowed: false, reason: `Invalid mode transition: ${from} → ${to}. Allowed: [${valid}]` };
  }
  return { allowed: true };
}

export function getAllowedModes(from: KernelLifecycleMode): KernelLifecycleMode[] {
  return VALID_MODE_TRANSITIONS[from] ?? [];
}
