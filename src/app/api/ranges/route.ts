import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const ranges = await prisma.rangeMemory.findMany({
    orderBy: { lastTouchedAt: 'desc' },
    take: 50,
  });
  return NextResponse.json(ranges);
}
