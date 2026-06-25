import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt(n: number | null | undefined): string {
  if (n == null || n === 0) return '—';
  return '$' + n.toLocaleString();
}

export function fmtR(r: number): string {
  return (r >= 0 ? '+' : '') + r.toFixed(1) + 'R';
}

export function confColor(conf: number): string {
  if (conf >= 80) return '#00E5A8';
  if (conf >= 60) return '#FBBF24';
  if (conf >= 40) return '#FF3B5C';
  return '#64748B';
}

export function confColorClass(conf: number): string {
  if (conf >= 80) return 'text-green';
  if (conf >= 60) return 'text-amber';
  if (conf >= 40) return 'text-red';
  return 'text-gray';
}
