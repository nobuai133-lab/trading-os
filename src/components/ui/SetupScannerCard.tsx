'use client';

import type {
  PendingSetup, SetupStatus, SetupLifecycleStatus,
  TrendAlignment, SetupActionability, SetupValidity,
  SetupPriorityTier, SetupIntent,
} from '@/types';
import GlassCard from '@/components/ui/GlassCard';

const STATUS_STYLE: Record<SetupStatus, { color: string; bg: string; border: string; label: string }> = {
  WATCHING:    { color: '#FBBF24', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.25)',  label: 'WATCHING'    },
  TRIGGERED:   { color: '#00E5A8', bg: 'rgba(0,229,168,0.10)',  border: 'rgba(0,229,168,0.25)',   label: 'TRIGGERED'   },
  INVALIDATED: { color: '#FF3B5C', bg: 'rgba(255,59,92,0.08)',  border: 'rgba(255,59,92,0.22)',   label: 'INVALIDATED' },
};

const LIFECYCLE_COLOR: Record<SetupLifecycleStatus, string> = {
  NEW:         '#38BDF8',
  ACTIVE:      '#00E5A8',
  TRADED:      '#FBBF24',
  COMPLETED:   '#A78BFA',
  EXPIRED:     '#FF3B5C',
  INVALIDATED: '#FF3B5C',
  STALE:       '#64748B',
};

const GRADE_COLOR: Record<string, string> = {
  'A+': '#00E5A8', 'A': '#00E5A8', 'B': '#FBBF24', 'C': '#FF3B5C', '—': '#64748B',
};

const ALIGNMENT_STYLE: Record<TrendAlignment, { color: string; label: string }> = {
  ALIGNED:       { color: '#00E5A8', label: 'ALIGNED'       },
  COUNTER_TREND: { color: '#FBBF24', label: 'COUNTER-TREND'  },
  CONFLICT:      { color: '#FF3B5C', label: 'CONFLICT'       },
};

const ACTIONABILITY_STYLE: Record<SetupActionability, { color: string; label: string }> = {
  READY:                 { color: '#00E5A8', label: 'READY'         },
  CONFIRMATION_REQUIRED: { color: '#FBBF24', label: 'NEEDS CONFIRM' },
  WATCHING:              { color: '#38BDF8', label: 'WATCH ONLY'    },
  INVALID:               { color: '#FF3B5C', label: 'INVALID'       },
};

const VALIDITY_STYLE: Record<SetupValidity, { color: string; bg: string; border: string; label: string }> = {
  VALID:      { color: '#00E5A8', bg: 'rgba(0,229,168,0.08)',   border: 'rgba(0,229,168,0.22)',   label: 'VALID'      },
  WATCH_ONLY: { color: '#FBBF24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.22)',  label: 'WATCH ONLY' },
  INVALID:    { color: '#FF3B5C', bg: 'rgba(255,59,92,0.08)',   border: 'rgba(255,59,92,0.22)',   label: 'INVALID'    },
  EXPIRED:    { color: '#64748B', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.22)', label: 'EXPIRED'    },
};

const TIER_STYLE: Record<SetupPriorityTier, { color: string; label: string }> = {
  PRIMARY:   { color: '#00E5A8', label: 'PRIMARY'   },
  SECONDARY: { color: '#38BDF8', label: 'SECONDARY' },
  WATCHLIST: { color: '#FBBF24', label: 'WATCHLIST' },
  INVALID:   { color: '#FF3B5C', label: 'INVALID'   },
};

const INTENT_COLOR: Record<SetupIntent, string> = {
  TREND_CONTINUATION:      '#00E5A8',
  BREAKOUT_CONTINUATION:   '#00E5A8',
  BREAKDOWN_CONTINUATION:  '#00E5A8',
  RETEST_CONTINUATION:     '#38BDF8',
  LIQUIDITY_SWEEP:         '#A78BFA',
  RANGE_REVERSION:         '#38BDF8',
  REVERSAL:                '#FBBF24',
  COUNTER_TREND:           '#FF3B5C',
  INVALID:                 '#64748B',
};

interface Props {
  setups:       PendingSetup[];
  currentPrice: number;
}

function formatAge(minutes: number): string {
  if (minutes < 60)  return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

export default function SetupScannerCard({ setups, currentPrice }: Props) {
  if (!setups.length) {
    return (
      <GlassCard>
        <div className="flex items-center justify-between mb-2">
          <p className="card-title mb-0">Setup Scanner</p>
        </div>
        <div
          className="rounded-[10px] p-3 text-center"
          style={{ background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.20)' }}
        >
          <p className="text-[11px] font-bold text-muted2 tracking-wider uppercase">NO VALID SETUP</p>
          <p className="text-[9px] text-muted2 mt-1">
            Waiting for trend-following retest or reversal confirmation
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-2">
        <p className="card-title mb-0">Setup Scanner</p>
        <span className="text-[9px] font-bold tracking-widest uppercase text-muted2">
          {setups.filter(s => s.status !== 'INVALIDATED' && s.validity?.validity !== 'EXPIRED').length} active
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {setups.map((setup) => {
          const ss       = STATUS_STYLE[setup.status];
          const val      = setup.validity;
          const vs       = val ? VALIDITY_STYLE[val.validity] : null;
          const inZ      = currentPrice >= setup.entryZone.low && currentPrice <= setup.entryZone.high;
          const dirColor = setup.direction === 'SHORT' ? '#FF3B5C' : '#00E5A8';
          const cls      = setup.classification;
          const isWatchOnly = val?.validity === 'WATCH_ONLY';
          const isExpired   = val?.validity === 'EXPIRED';
          // ITOS
          const rank    = setup.rank;
          const decay   = setup.decay;
          const zoneQ   = setup.zoneQuality;
          const expl    = setup.explainability;
          const tier    = rank?.tier;
          const intent  = setup.intent;

          return (
            <div
              key={setup.id}
              className="rounded-[10px] p-2.5"
              style={{
                background: vs ? vs.bg : ss.bg,
                border:     `1px solid ${vs ? vs.border : ss.border}`,
                opacity:    isExpired ? 0.55 : setup.status === 'INVALIDATED' ? 0.5 : 1,
              }}
            >
              {/* Row 1: label + direction + grade + validity + lifecycle */}
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[11px] font-black" style={{ color: vs ? vs.color : ss.color }}>
                  {setup.label}
                </span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-chip"
                  style={{ color: dirColor, background: `${dirColor}14`, border: `1px solid ${dirColor}28` }}
                >
                  {setup.direction}
                </span>
                <span className="text-[9px] font-bold" style={{ color: GRADE_COLOR[setup.grade] }}>
                  {setup.grade}
                </span>
                <div className="ml-auto flex items-center gap-1 flex-wrap justify-end">
                  {vs && (
                    <span
                      className="text-[7px] font-bold px-1.5 py-0.5 rounded-chip tracking-wider uppercase"
                      style={{ color: vs.color, background: vs.bg, border: `1px solid ${vs.border}` }}
                    >
                      {vs.label}
                    </span>
                  )}
                  {setup.lifecycleStatus && (
                    <span
                      className="text-[7px] font-bold px-1 py-0.5 rounded-chip tracking-wider"
                      style={{
                        color:      LIFECYCLE_COLOR[setup.lifecycleStatus],
                        background: `${LIFECYCLE_COLOR[setup.lifecycleStatus]}14`,
                        border:     `1px solid ${LIFECYCLE_COLOR[setup.lifecycleStatus]}30`,
                      }}
                    >
                      {setup.lifecycleStatus}
                    </span>
                  )}
                </div>
              </div>

              {/* Row 1b: trend alignment + actionability + reason */}
              {(cls || val) && (
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  {cls && (
                    <span
                      className="text-[8px] font-bold px-1.5 py-0.5 rounded-chip tracking-wider"
                      style={{
                        color:      ALIGNMENT_STYLE[cls.trendAlignment].color,
                        background: `${ALIGNMENT_STYLE[cls.trendAlignment].color}14`,
                        border:     `1px solid ${ALIGNMENT_STYLE[cls.trendAlignment].color}30`,
                      }}
                    >
                      {ALIGNMENT_STYLE[cls.trendAlignment].label}
                    </span>
                  )}
                  {val && (
                    <span
                      className="text-[8px] font-bold px-1.5 py-0.5 rounded-chip tracking-wider"
                      style={{
                        color:      ACTIONABILITY_STYLE[val.actionability].color,
                        background: `${ACTIONABILITY_STYLE[val.actionability].color}14`,
                        border:     `1px solid ${ACTIONABILITY_STYLE[val.actionability].color}30`,
                      }}
                    >
                      {ACTIONABILITY_STYLE[val.actionability].label}
                    </span>
                  )}
                  {(val ?? cls) && (
                    <span
                      className="text-[8px] text-muted2 truncate max-w-[200px]"
                      title={val?.reason ?? cls?.reason}
                    >
                      {val?.reason ?? cls?.reason}
                    </span>
                  )}
                </div>
              )}

              {/* Row 1c: ITOS tier + intent + institutional class */}
              {(tier || intent) && (
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  {tier && (
                    <span
                      className="text-[8px] font-bold px-1.5 py-0.5 rounded-chip tracking-wider"
                      style={{
                        color:      TIER_STYLE[tier].color,
                        background: `${TIER_STYLE[tier].color}14`,
                        border:     `1px solid ${TIER_STYLE[tier].color}30`,
                      }}
                    >
                      {TIER_STYLE[tier].label}
                    </span>
                  )}
                  {intent && intent !== 'INVALID' && (
                    <span
                      className="text-[8px] font-bold px-1.5 py-0.5 rounded-chip tracking-wider"
                      style={{
                        color:      INTENT_COLOR[intent],
                        background: `${INTENT_COLOR[intent]}14`,
                        border:     `1px solid ${INTENT_COLOR[intent]}30`,
                      }}
                    >
                      {intent.replace(/_/g, ' ')}
                    </span>
                  )}
                  {rank && (
                    <span className="text-[8px] text-muted2 ml-auto">
                      {rank.institutionalClass} · {(rank.riskMultiplier * 100).toFixed(0)}% risk
                    </span>
                  )}
                </div>
              )}

              {/* Row 1d: confidence decay + zone quality */}
              {(decay || zoneQ) && (
                <div className="flex items-center gap-4 mb-1.5">
                  {decay && (
                    <span className="text-[8px] text-muted2">
                      Conf: <span className="font-bold" style={{ color: decay.remainingLifePct > 50 ? '#00E5A8' : decay.remainingLifePct > 20 ? '#FBBF24' : '#FF3B5C' }}>
                        {decay.currentConfidence}%
                      </span>
                      <span className="text-[7px] text-muted2"> ({decay.remainingLifePct}% life)</span>
                    </span>
                  )}
                  {zoneQ && (
                    <span className="text-[8px] text-muted2">
                      Zone: <span
                        className="font-bold"
                        style={{ color: zoneQ.score >= 70 ? '#00E5A8' : zoneQ.score >= 45 ? '#FBBF24' : '#FF3B5C' }}
                      >
                        {zoneQ.score}/100
                      </span>
                      <span className="text-[7px] text-muted2"> ({zoneQ.label.toLowerCase()})</span>
                    </span>
                  )}
                  {expl?.multiTfAgreement && (
                    <span className="text-[8px] text-muted2">
                      MTF: <span
                        className="font-bold"
                        style={{ color: expl.multiTfAgreement.composite >= 70 ? '#00E5A8' : expl.multiTfAgreement.composite >= 45 ? '#FBBF24' : '#FF3B5C' }}
                      >
                        {expl.multiTfAgreement.composite}%
                      </span>
                      {expl.multiTfAgreement.htfVeto && (
                        <span className="text-[7px]" style={{ color: '#FF3B5C' }}> VETO</span>
                      )}
                    </span>
                  )}
                </div>
              )}

              {/* Row 1e: explainability summary */}
              {expl?.summary && (
                <div className="mb-1.5">
                  <span className="text-[8px] text-muted2 italic">{expl.summary}</span>
                </div>
              )}

              {/* Row 1f: age + expiry (for watch-only / expired setups) */}
              {val && (isWatchOnly || isExpired) && (
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="text-[8px] text-muted2">
                    Age: <span className="font-bold" style={{ color: isExpired ? '#FF3B5C' : '#FBBF24' }}>
                      {formatAge(val.ageMinutes)}
                    </span>
                  </span>
                  <span className="text-[8px] text-muted2">
                    Expires: <span className="font-bold text-muted2">
                      {new Date(val.expiryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                </div>
              )}

              {/* Row 1d: entry zone source */}
              {val && val.entryZoneSource !== 'UNKNOWN' && (
                <div className="mb-1.5">
                  <span className="text-[8px] text-muted2" title={val.entryZoneReason}>
                    Zone source: <span className="font-semibold">{val.entryZoneSource.replace(/_/g, ' ').toLowerCase()}</span>
                  </span>
                </div>
              )}

              {/* Row 2: entry zone */}
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-[9px] text-muted2 w-10">ZONE</span>
                <span
                  className="text-[11px] font-bold tabular-nums"
                  style={{ color: inZ ? '#FBBF24' : '#F8FAFC' }}
                >
                  ${setup.entryZone.low.toLocaleString()} – ${setup.entryZone.high.toLocaleString()}
                </span>
                {inZ && (
                  <span
                    className="ml-1 text-[8px] font-bold px-1.5 py-0.5 rounded-chip"
                    style={{ color: '#FBBF24', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)' }}
                  >
                    PRICE IN ZONE
                  </span>
                )}
              </div>

              {/* Row 3: SL + TPs */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: 'SL',  value: setup.sl,  color: '#FF3B5C' },
                  { label: 'TP1', value: setup.tp1, color: '#00E5A8' },
                  { label: 'TP2', value: setup.tp2, color: '#00E5A8' },
                  { label: 'TP3', value: setup.tp3, color: '#00E5A8' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-[8px] text-muted2 font-bold tracking-wider">{label}</span>
                    <span className="text-[10px] font-semibold tabular-nums" style={{ color }}>
                      ${value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              {/* Row 4: RR + note */}
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[9px] text-muted2">{setup.note}</span>
                <span className="text-[9px] font-bold text-blue">RR {setup.rr.toFixed(1)}R</span>
              </div>

              {/* Row 5: missing confirmations */}
              {val && val.missingConfirmations.length > 0 && (
                <div className="mt-2 pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-[8px] font-bold text-muted2 tracking-wider uppercase mb-1 block">
                    Missing confirmations ({val.missingConfirmations.length}/{val.requiredConfirmations.length})
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {val.missingConfirmations.map((c) => (
                      <div key={c} className="flex items-center gap-1">
                        <span className="text-[8px]" style={{ color: '#FF3B5C' }}>✕</span>
                        <span className="text-[8px] text-muted2">{c}</span>
                      </div>
                    ))}
                    {val.satisfiedConfirmations.map((c) => (
                      <div key={c} className="flex items-center gap-1">
                        <span className="text-[8px]" style={{ color: '#00E5A8' }}>✓</span>
                        <span className="text-[8px] text-muted2">{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 6: watch-only blocked banner */}
              {isWatchOnly && val?.blocked && (
                <div
                  className="mt-2 rounded p-1.5 text-center"
                  style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.20)' }}
                >
                  <span className="text-[8px] font-bold tracking-wider uppercase" style={{ color: '#FBBF24' }}>
                    WATCH ONLY — Not actionable until confirmations met
                  </span>
                </div>
              )}

              {/* Row 7: expired banner */}
              {isExpired && (
                <div
                  className="mt-2 rounded p-1.5 text-center"
                  style={{ background: 'rgba(255,59,92,0.06)', border: '1px solid rgba(255,59,92,0.18)' }}
                >
                  <span className="text-[8px] font-bold tracking-wider uppercase" style={{ color: '#FF3B5C' }}>
                    EXPIRED — Rescan required
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
