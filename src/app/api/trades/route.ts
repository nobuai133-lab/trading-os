import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const page  = parseInt(req.nextUrl.searchParams.get('page')  ?? '1', 10);
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10);
  const skip  = (page - 1) * limit;

  const [trades, total] = await Promise.all([
    prisma.trade.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.trade.count(),
  ]);

  return NextResponse.json({ trades, total, page, pages: Math.ceil(total / limit) });
}
