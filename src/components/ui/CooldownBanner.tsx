'use client';

import type { CooldownState } from '@/types';

interface Props {
  cooldown: CooldownState;
}

export default function CooldownBanner({ cooldown }: Props) {
  if (!cooldown.active || cooldown.remainingBars <= 0) return null;

  const pct = cooldown.totalBars > 0
    ? Math.round(((cooldown.totalBars - cooldown.remainingBars) / cooldown.totalBars) * 100)
    : 0;

  return (
    <div
      className="rounded-[10px] px-3 py-2.5 flex items-center gap-2.5"
      style={{
        background: 'rgba(251,191,36,0.08)',
        border:     '1px solid rgba(251,191,36,0.28)',
      }}
    >
      {/* Icon */}
      <span className="text-[14px] shrink-0" style={{ color: '#FBBF24' }}>⏸</span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold tracking-wide" style={{ color: '#FBBF24' }}>
          COOLDOWN ACTIVE
        </p>
        <p className="text-[9px] text-muted2">
          {cooldown.remainingBars} bar{cooldown.remainingBars !== 1 ? 's' : ''} remaining
          {cooldown.reason ? ` · ${cooldown.reason}` : ''} · No re-entry allowed
        </p>
      </div>

      {/* Progress ring */}
      <div className="relative w-8 h-8 shrink-0">
        <svg viewBox="0 0 32 32" className="w-8 h-8 -rotate-90">
          <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(251,191,36,0.15)" strokeWidth="3" />
          <circle
            cx="16" cy="16" r="12" fill="none"
            stroke="#FBBF24" strokeWidth="3"
            strokeDasharray={`${(pct / 100) * 75.4} 75.4`}
            strokeLinecap="round"
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-[8px] font-bold"
          style={{ color: '#FBBF24' }}
        >
          {pct}%
        </span>
      </div>
    </div>
  );
}
