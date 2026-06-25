import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Liveness probe — always returns 200 if the process is running.
// Used by Railway / load balancers to detect a crashed pod.
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: 'ok', ts: new Date().toISOString() });
}
