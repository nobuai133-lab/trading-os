import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const [fingerprints, cooldowns] = await Promise.all([
    prisma.setupFingerprint.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.cooldown.findMany({
      where:   { active: true },
      orderBy: { activatedAt: 'desc' },
    }),
  ]);
  return NextResponse.json({ fingerprints, cooldowns });
}
