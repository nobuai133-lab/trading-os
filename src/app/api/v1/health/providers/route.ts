import { NextResponse } from 'next/server';
import { marketDataEngine } from '@/lib/marketData/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Returns live health scores for all registered market data providers.
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    activeProvider: marketDataEngine.getActiveProvider(),
    providers:      marketDataEngine.getProviderHealth(),
    failoverLog:    marketDataEngine.getFailoverLog(),
    ts:             new Date().toISOString(),
  });
}
