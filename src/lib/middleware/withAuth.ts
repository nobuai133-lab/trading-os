import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/core/config';
import { logger } from '@/lib/logger';

type RouteHandler = (req: NextRequest) => Promise<NextResponse>;

// Verifies the webhook secret as a query param (?secret=) or HMAC signature in
// X-Signature-256 header (HMAC-SHA256 of raw body with WEBHOOK_SECRET).
export function withWebhookAuth(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest) => {
    const secretParam = req.nextUrl.searchParams.get('secret');

    if (secretParam) {
      if (secretParam !== config.security.webhookSecret) {
        logger.warn('webhook auth failed — bad secret param', { ip: req.headers.get('x-forwarded-for') });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return handler(req);
    }

    // HMAC path: clone request so we can read body without consuming the stream
    const rawBody  = await req.text();
    const sig      = req.headers.get('x-signature-256') ?? '';
    const expected = `sha256=${createHmac('sha256', config.security.webhookSecret).update(rawBody).digest('hex')}`;

    if (!timingSafeEqual(sig, expected)) {
      logger.warn('webhook auth failed — bad HMAC', { ip: req.headers.get('x-forwarded-for') });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Re-create request with body since we consumed it
    const newReq = new NextRequest(req.url, {
      method:  req.method,
      headers: req.headers,
      body:    rawBody,
    });
    return handler(newReq);
  };
}

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Rate-limit helper (simple in-memory, resets per process — use Redis for multi-instance)
const windowMs  = config.rateLimit.webhookPerMin * 1000; // treat as window
const maxPerMin = config.rateLimit.webhookPerMin;
const hits      = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string): boolean {
  const now   = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count++;
  return entry.count <= maxPerMin;
}
