import { NextRequest, NextResponse }                   from 'next/server';
import { validateWebhookSecret, parseWebhookPayload, SignalValidationError } from '@/lib/signalProvider';
import { lifecycleService }                            from '@/services/lifecycle/LifecycleService';
import { auditService }                               from '@/services/audit/AuditService';
import { evidenceService }                            from '@/services/evidence/EvidenceService';
import { logger }                                     from '@/core/logger';
import { generateCorrelationId }                      from '@/core/correlationId';
import { getKernel }                                  from '@/kernel/singleton';
import { mapSignalToKernelEvent }                     from '@/lib/kernel/signalMapper';
import { checkDivergence }                            from '@/lib/kernel/divergenceMonitor';
import { recordWebhookEvent, recordKernelWrite }      from '@/lib/kernel/metricsCollector';
import { prisma }                                     from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = generateCorrelationId();
  const log = logger.withContext({ service: 'webhook-v1', correlationId });

  const secret = req.nextUrl.searchParams.get('secret');
  try {
    validateWebhookSecret(secret);
  } catch {
    log.warn('auth failed');
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

  log.info('received', { signal: signal.signal, symbol: signal.symbol });

  // Count every incoming webhook for consistency metrics
  void recordWebhookEvent();

  // ── Idempotency: skip kernel if this correlationId already has a kernel event ──
  const alreadyProcessed = await prisma.kernelEvent
    .findFirst({ where: { correlationId }, select: { id: true } })
    .catch(() => null);

  if (alreadyProcessed) {
    log.warn('duplicate correlationId — kernel write skipped');
  }

  // ── Existing lifecycle processing (unchanged) ──────────────────────────────
  try {
    await lifecycleService.process(signal, body as object, correlationId);
    await auditService.log({
      action: 'SIGNAL_RECEIVED', actor: 'webhook',
      resource: signal.setupId, correlationId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('processing failed', { err: msg });
    await auditService.log({
      action: 'SIGNAL_REJECTED', actor: 'webhook', correlationId,
      detail: { error: msg },
    });
    return NextResponse.json({ error: 'Processing failed', correlationId }, { status: 500 });
  }

  // ── Evidence evaluation — fire-and-forget on SETUP_DETECTED ─────────────────
  if (signal.signal === 'SETUP_DETECTED') {
    void evidenceService.evaluate(signal, correlationId);
  }

  // ── Kernel dual-write — fire-and-forget, never blocks the response ─────────
  void (async () => {
    if (alreadyProcessed) return;

    const kernelInput = mapSignalToKernelEvent(signal, correlationId);
    if (!kernelInput) {
      log.info('kernel: no mapping for signal type', { signal: signal.signal });
      return;
    }

    const t0 = Date.now();
    try {
      const kernel = await getKernel();
      const phaseBefore  = kernel.readState('trade').phase;
      const events       = await kernel.applyTransition(kernelInput);
      const phaseAfter   = kernel.readState('trade').phase;
      const latencyMs    = Date.now() - t0;
      const transitioned = phaseBefore !== phaseAfter ? 1 : 0;

      log.info('kernel: transition applied', {
        emitted:    events.map((e) => e.type),
        phase:      `${phaseBefore} → ${phaseAfter}`,
        latencyMs,
        eventCount: kernel.getEventCount(),
      });

      // Accumulate shadow metrics
      void recordKernelWrite(events.length, latencyMs, transitioned);

      // Divergence check — warns and logs, never corrects
      void checkDivergence(kernel, correlationId);
    } catch (kernelErr) {
      const msg = kernelErr instanceof Error ? kernelErr.message : String(kernelErr);
      const latencyMs = Date.now() - t0;
      log.error('kernel dual-write failed (non-fatal)', {
        err: msg, signal: signal.signal, latencyMs,
      });
    }
  })();

  return NextResponse.json({ ok: true, correlationId }, { status: 200 });
}
