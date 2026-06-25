'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Decision, SystemMode } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  decision:       Decision;
  mode:           SystemMode;
  lifecycleLabel: string;
}

function decisionStyle(d: Decision): {
  color:  string;
  glow:   string;
  bgFrom: string;
  label:  string;
} {
  switch (d) {
    case 'LONG':
      return {
        color:  '#00E5A8',
        glow:   '0 0 40px rgba(0,229,168,0.30)',
        bgFrom: 'rgba(0,229,168,0.06)',
        label:  'LONG',
      };
    case 'SHORT':
      return {
        color:  '#FF3B5C',
        glow:   '0 0 40px rgba(255,59,92,0.30)',
        bgFrom: 'rgba(255,59,92,0.06)',
        label:  'SHORT',
      };
    case 'WAIT':
      return {
        color:  '#FBBF24',
        glow:   '0 0 24px rgba(251,191,36,0.20)',
        bgFrom: 'rgba(251,191,36,0.04)',
        label:  'WAIT',
      };
    case 'NO TRADE':
      return {
        color:  '#64748B',
        glow:   'none',
        bgFrom: 'rgba(100,116,139,0.04)',
        label:  'NO TRADE',
      };
  }
}

const MODE_LABELS: Record<SystemMode, string> = {
  IDLE:              'Idle',
  SETUP_DETECTED:    'Setup Detected',
  WAIT_CONFIRMATION: 'Wait Confirm',
  ENTRY_READY:       'Entry Ready',
  ACTIVE_TRADE:      'Active Trade',
  POST_TRADE_REVIEW: 'Post Review',
  WAIT_NEW_SETUP:    'Wait New Setup',
  COOLDOWN:          'Cooldown',
};

export default function DecisionHero({ decision, mode, lifecycleLabel }: Props) {
  const style = decisionStyle(decision);

  return (
    <div
      className="glass-card p-4 flex items-center justify-between gap-4 overflow-hidden"
      style={{ background: style.bgFrom, boxShadow: style.glow }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={decision}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col"
        >
          <span
            className="text-[11px] font-semibold tracking-[0.12em] uppercase"
            style={{ color: '#94A3B8' }}
          >
            Decision
          </span>
          <span
            className="text-[36px] font-black leading-none tracking-tight"
            style={{ color: style.color }}
          >
            {style.label}
          </span>
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={cn(
            'text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-chip',
          )}
          style={{
            color:      style.color,
            background: `${style.color}18`,
            border:     `1px solid ${style.color}30`,
          }}
        >
          {MODE_LABELS[mode]}
        </span>
        <span className="text-[11px] text-muted2 font-medium">{lifecycleLabel}</span>
      </div>
    </div>
  );
}
