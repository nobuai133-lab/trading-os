import { NextResponse } from 'next/server';
import { healthService } from '@/services/health/HealthService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Readiness probe — performs real DB ping.
// Returns 503 if the database is unreachable so Railway stops routing traffic.
export async function GET(): Promise<NextResponse> {
  const report = await healthService.check();
  const status = report.status === 'down' ? 503 : 200;
  return NextResponse.json(report, { status });
}
