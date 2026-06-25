import { NextRequest, NextResponse } from 'next/server';
import { validateWebhookSecret, parseWebhookPayload, SignalValidationError } from '@/lib/signalProvider';
import { processWebhookSignal } from '@/lib/tradeLifecycle';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Secret from query string: ?secret=xxx
  const secret = req.nextUrl.searchParams.get('secret');

  try {
    validateWebhookSecret(secret);
  } catch (e) {
    logger.warn('Webhook secret validation failed', { error: String(e) });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let signal;
  try {
    signal = parseWebhookPayload(body);
  } catch (e) {
    if (e instanceof SignalValidationError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    throw e;
  }

  logger.info('webhook received', { signal: signal.signal, symbol: signal.symbol });

  await processWebhookSignal(signal, body as object);

  return NextResponse.json({ ok: true }, { status: 200 });
}
