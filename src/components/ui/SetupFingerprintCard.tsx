'use client';

import type { SetupFingerprint, SetupLifecycleStatus } from '@/types';
import GlassCard from '@/components/ui/GlassCard';

const LIFECYCLE_STYLE: Record<SetupLifecycleStatus, { color: string }> = {
  NEW:         { color: '#38BDF8' },
  ACTIVE:      { color: '#00E5A8' },
  TRADED:      { color: '#FBBF24' },
  COMPLETED:   { color: '#A78BFA' },
  EXPIRED:     { color: '#FF3B5C' },
  INVALIDATED: { color: '#FF3B5C' },
  STALE:       { color: '#64748B' },
};

interface Props {
  fingerprint: SetupFingerprint;
}

function Flag({ label, value, trueColor = '#FF3B5C', falseColor = '#00E5A8' }: {
  label:      string;
  value:      boolean;
  trueColor?: string;
  falseColor?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] text-muted2">{label}</span>
      <span
        className="text-[10px] font-bold"
        style={{ color: value ? trueColor : falseColor }}
      >
        {value ? 'YES' : 'NO'}
      </span>
    </div>
  );
}

export default function SetupFingerprintCard({ fingerprint }: Props) {
  const ls = LIFECYCLE_STYLE[fingerprint.status];
  const dirColor = fingerprint.direction === 'SHORT' ? '#FF3B5C' : '#00E5A8';

  return (
    <GlassCard padding="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="card-title mb-0">Setup Fingerprint</p>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[8px] font-bold px-1.5 py-0.5 rounded-chip"
            style={{ color: dirColor, background: `${dirColor}14`, border: `1px solid ${dirColor}28` }}
          >
            {fingerprint.direction}
          </span>
          <span
            className="text-[8px] font-bold px-1.5 py-0.5 rounded-chip tracking-widest"
            style={{ color: ls.color, background: `${ls.color}14`, border: `1px solid ${ls.color}28` }}
          >
            {fingerprint.status}
          </span>
        </div>
      </div>

      {/* Fingerprint ID */}
      <p
        className="text-[8px] font-mono mb-2 truncate"
        style={{ color: '#334155' }}
        title={fingerprint.id}
      >
        {fingerprint.id}
      </p>

      {/* Flags */}
      <div className="flex flex-col gap-1.5">
        <Flag
          label="Same Setup Detected"
          value={fingerprint.sameSetupDetected}
          trueColor="#FBBF24"
          falseColor="#00E5A8"
        />
        <Flag
          label="Already Traded"
          value={fingerprint.alreadyTraded}
          trueColor="#FF3B5C"
          falseColor="#00E5A8"
        />
      </div>

      {fingerprint.lastTradedAt && (
        <div
          className="mt-2 pt-2 flex items-center gap-1.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="text-[9px] text-muted2">Last Traded</span>
          <span className="text-[9px] font-mono text-muted">{fingerprint.lastTradedAt}</span>
        </div>
      )}

      {/* Blocked warning */}
      {fingerprint.alreadyTraded && (
        <div
          className="mt-2 rounded-[6px] px-2 py-1.5"
          style={{ background: 'rgba(255,59,92,0.06)', border: '1px solid rgba(255,59,92,0.18)' }}
        >
          <p className="text-[9px] font-semibold text-center" style={{ color: '#FF3B5C' }}>
            Same setup/range already traded. Entry signal suppressed.
          </p>
        </div>
      )}
    </GlassCard>
  );
}
