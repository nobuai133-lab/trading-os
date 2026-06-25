'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children:   React.ReactNode;
  className?: string;
  padding?:   string;
  style?:     React.CSSProperties;
}

export default function GlassCard({
  children,
  className,
  padding = 'p-[14px]',
  style,
}: GlassCardProps) {
  return (
    <div
      className={cn('glass-card', padding, className)}
      style={{ WebkitBackdropFilter: 'blur(20px)', ...style }}
    >
      {children}
    </div>
  );
}
