'use client';

import type { KeyLevel } from '@/types';

interface Props {
  levels: KeyLevel[];
  currentPrice: number;
}

const TYPE_STYLE: Record<string, string> = {
  RESISTANCE:     'bg-red-500/20 text-red-300 border-red-500/40',
  SUPPORT:        'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  LIQUIDITY_HIGH: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  LIQUIDITY_LOW:  'bg-blue-500/20 text-blue-300 border-blue-500/40',
};

const TYPE_LABEL: Record<string, string> = {
  RESISTANCE:     'Resistance',
  SUPPORT:        'Support',
  LIQUIDITY_HIGH: 'Liq High',
  LIQUIDITY_LOW:  'Liq Low',
};

export default function KeyLevelsCard({ levels, currentPrice }: Props) {
  if (!levels || levels.length === 0) return null;

  const sorted = [...levels].sort((a, b) => b.price - a.price);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
          Key Levels
        </span>
        <span className="text-xs text-white/30">{levels.length} levels</span>
      </div>

      <div className="space-y-1.5">
        {sorted.map((level, i) => {
          const distPct = ((level.price - currentPrice) / currentPrice * 100);
          const isAbove  = level.price > currentPrice;
          const style    = TYPE_STYLE[level.type] ?? 'bg-white/10 text-white/50 border-white/20';

          return (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${style}`}>
                  {TYPE_LABEL[level.type] ?? level.type}
                </span>
                <span className="font-mono text-sm font-semibold text-white">
                  ${level.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
                {level.source === 'LIQUIDITY' && (
                  <span className="text-[10px] text-yellow-400/70">⚡ Liq</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] text-white/30">
                  {'★'.repeat(Math.min(level.strength, 5))}
                </span>
                <span className={`font-mono text-xs ${isAbove ? 'text-red-400' : 'text-emerald-400'}`}>
                  {isAbove ? '+' : ''}{distPct.toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current price marker */}
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
        <span className="text-[10px] font-semibold text-yellow-400">NOW</span>
        <span className="font-mono text-sm font-semibold text-yellow-300">
          ${currentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}
