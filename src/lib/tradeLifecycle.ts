import { prisma } from './db';
import { logger } from './logger';
import { isKillSwitchActive, evaluateRisk } from './riskEngine';
import {
  isDuplicateWebhook,
  getOrCreateRange,
  getOrCreateFingerprint,
  markRangeTraded,
  markFingerprintTraded,
  createCooldown,
  getActiveCooldown,
  logWebhookEvent,
} from './memoryEngine';
import { buildDashboardState, persistDashboardState } from './stateBuilder';
import { notify } from './notificationService';
import { assessSetupValidity } from './setupValidityEngine';
import { deriveHtfBias } from './strategyEngine';
import type { WebhookSignal } from './signalProvider';

// ── Signal types sent from TradingView Pine alerts ────────────────────────────
// SETUP_DETECTED   — new trade setup identified
// ENTRY_TRIGGERED  — price entered the entry zone
// TP1_HIT          — first take profit reached
// TP2_HIT          — second take profit reached
// TP3_HIT          — third take profit reached (auto-close + cooldown)
// SL_HIT           — stop loss hit
// CLOSE_TRADE      — manual close from Pine
// BAR_CLOSE        — bar-close tick for cooldown countdown

export async function processWebhookSignal(signal: WebhookSignal, rawPayload: object): Promise<void> {
  if (isKillSwitchActive()) {
    await logWebhookEvent({
      symbol: signal.symbol, signal: signal.signal, setupId: signal.setupId,
      payload: rawPayload, processed: false, duplicate: false,
      blocked: true, blockReason: 'Kill switch active',
    });
    await notify('KILL_SWITCH', `Kill switch active — signal ${signal.signal} dropped`);
    return;
  }

  // Duplicate check (setupId + 60s window)
  if (signal.setupId && await isDuplicateWebhook(signal.setupId)) {
    logger.info('duplicate signal', { setupId: signal.setupId });
    await logWebhookEvent({
      symbol: signal.symbol, signal: signal.signal, setupId: signal.setupId,
      payload: rawPayload, processed: false, duplicate: true, blocked: false,
    });
    return;
  }

  try {
    switch (signal.signal) {
      case 'SETUP_DETECTED':   await handleSetupDetected(signal);   break;
      case 'ENTRY_TRIGGERED':  await handleEntryTriggered(signal);  break;
      case 'TP1_HIT':          await handleTpHit(signal, 1);        break;
      case 'TP2_HIT':          await handleTpHit(signal, 2);        break;
      case 'TP3_HIT':          await handleTpHit(signal, 3);        break;
      case 'SL_HIT':           await handleSlHit(signal);           break;
      case 'CLOSE_TRADE':      await handleCloseTrade(signal);      break;
      case 'BAR_CLOSE':        await handleBarClose(signal);        break;
      default:
        logger.warn('Unknown signal type', { signal: signal.signal });
    }

    await logWebhookEvent({
      symbol: signal.symbol, signal: signal.signal, setupId: signal.setupId,
      payload: rawPayload, processed: true, duplicate: false, blocked: false,
    });

    // Rebuild + persist dashboard state after every processed signal
    const newState = await buildDashboardState();
    await persistDashboardState(newState);

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('processWebhookSignal error', { error: errMsg, signal: signal.signal });
    await logWebhookEvent({
      symbol: signal.symbol, signal: signal.signal, setupId: signal.setupId,
      payload: rawPayload, processed: false, duplicate: false,
      blocked: false, error: errMsg,
    });
    await notify('ERROR', `Signal processing error: ${errMsg}`);
    throw err;
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleSetupDetected(rawSignal: WebhookSignal) {
  let signal: WebhookSignal = rawSignal;
  const risk = evaluateRisk(signal);

  if (!risk.allowed) {
    await notify('SETUP_BLOCKED', `${signal.symbol} ${signal.direction} blocked — ${risk.reason}`);
    return;
  }

  // Anti-reentry: check cooldown
  const cooldown = await getActiveCooldown(signal.symbol, signal.timeframe);
  if (cooldown) {
    await notify('SETUP_BLOCKED',
      `${signal.symbol} ${signal.timeframe}: Cooldown active (${cooldown.remainingBars} bars)`);
    return;
  }

  // Get / create range memory and fingerprint
  const [range, fingerprint] = await Promise.all([
    getOrCreateRange(signal),
    getOrCreateFingerprint(signal),
  ]);

  if (fingerprint?.alreadyTraded) {
    await notify('SETUP_BLOCKED',
      `${signal.symbol}: Same setup fingerprint already traded — no re-entry`);
    return;
  }

  if (range?.status === 'STALE') {
    await notify('SETUP_BLOCKED',
      `${signal.symbol}: Range is STALE — needs fresh liquidity before re-entry`);
    return;
  }

  if (range && !range.reentryAllowed) {
    await notify('SETUP_BLOCKED',
      `${signal.symbol}: Range re-entry not allowed yet`);
    return;
  }

  // Bias validation — check setup direction against current HTF/LTF regime
  try {
    const [snap4H, snap1D] = await Promise.all([
      prisma.marketSnapshot.findFirst({
        where: { symbol: signal.symbol, timeframe: '4H' },
        orderBy: { snapshotAt: 'desc' },
        select: { regime: true },
      }),
      prisma.marketSnapshot.findFirst({
        where: { symbol: signal.symbol, timeframe: '1D' },
        orderBy: { snapshotAt: 'desc' },
        select: { regime: true },
      }),
    ]);
    const htfBias = deriveHtfBias((snap1D?.regime ?? snap4H?.regime ?? 'RANGING') as any);
    const ltfBias = deriveHtfBias((snap4H?.regime ?? 'RANGING') as any);

    const validity = assessSetupValidity({
      htfBias,
      ltfBias,
      regime:        snap4H?.regime ?? 'RANGING',
      currentPrice:  signal.entryZoneLow ?? 0,
      direction:     (signal.direction?.toUpperCase() ?? 'LONG') as 'LONG' | 'SHORT',
      entryZoneLow:  signal.entryZoneLow  ?? 0,
      entryZoneHigh: signal.entryZoneHigh ?? 0,
      createdAt:     new Date(),
      timeframe:     signal.timeframe ?? '4H',
      signalGrade:   signal.grade ?? 'B',
    });

    if (validity.validity === 'INVALID') {
      await notify('SETUP_BLOCKED',
        `${signal.symbol} ${signal.direction} blocked — ${validity.reason}`);
      return;
    }
    // WATCH_ONLY: store but cap the grade
    if (validity.validity === 'WATCH_ONLY' && signal.grade) {
      const gradeOrder = ['A+', 'A', 'B', 'C'];
      const capIdx  = gradeOrder.indexOf(validity.gradeCap);
      const sigIdx  = gradeOrder.indexOf(signal.grade);
      if (sigIdx !== -1 && capIdx !== -1 && sigIdx < capIdx) {
        signal = { ...signal, grade: validity.gradeCap };
      }
    }
  } catch { /* non-fatal — proceed without bias check if DB is unavailable */ }

  // Create setup record
  await prisma.setup.create({
    data: {
      fingerprintId:   fingerprint?.id,
      symbol:          signal.symbol,
      timeframe:       signal.timeframe,
      direction:       signal.direction ?? '',
      rangeHigh:       signal.rangeHigh,
      rangeLow:        signal.rangeLow,
      entryZoneHigh:   signal.entryZoneHigh,
      entryZoneLow:    signal.entryZoneLow,
      sl:              signal.sl,
      tp1:             signal.tp1,
      tp2:             signal.tp2,
      tp3:             signal.tp3,
      rr:              signal.rr,
      grade:           signal.grade ?? 'B',
      confidence:      signal.confidence ?? 50,
      thesisType:      signal.thesisType ?? '',
      note:            signal.note ?? '',
      lifecycleStatus: 'NEW',
    },
  });

  const modeLabel = risk.mode === 'PAPER_TRADING' ? '[PAPER]' : risk.mode === 'LIVE' ? '[LIVE]' : '[ALERT]';
  await notify('SETUP_DETECTED',
    `${modeLabel} ${signal.symbol} ${signal.direction}\n` +
    `Timeframe: ${signal.timeframe} | Grade: ${signal.grade ?? 'B'}\n` +
    `Entry zone: ${signal.entryZoneLow} – ${signal.entryZoneHigh}\n` +
    `SL: ${signal.sl} | TP1: ${signal.tp1} | TP2: ${signal.tp2} | TP3: ${signal.tp3}\n` +
    `RR: ${signal.rr?.toFixed(2) ?? '—'}`);
}

async function handleEntryTriggered(signal: WebhookSignal) {
  const setup = signal.setupId
    ? await prisma.setup.findUnique({ where: { id: signal.setupId } })
    : await prisma.setup.findFirst({
        where: { symbol: signal.symbol, timeframe: signal.timeframe, lifecycleStatus: 'NEW' },
        orderBy: { createdAt: 'desc' },
      });

  if (!setup) {
    logger.warn('ENTRY_TRIGGERED: no setup found', { signal });
    return;
  }

  const risk = evaluateRisk(signal);

  const trade = await prisma.trade.create({
    data: {
      setupId:    setup.id,
      symbol:     signal.symbol,
      direction:  signal.direction ?? setup.direction,
      mode:       risk.mode === 'LIVE' ? 'LIVE' : 'PAPER',
      entryPrice: signal.entryPrice,
      sl:         signal.sl ?? setup.sl,
      slCurrent:  signal.sl ?? setup.sl,
      tp1:        signal.tp1 ?? setup.tp1,
      tp2:        signal.tp2 ?? setup.tp2,
      tp3:        signal.tp3 ?? setup.tp3,
      riskPct:    risk.riskPct,
      status:     'ACTIVE',
      openedAt:   new Date(),
    },
  });

  await prisma.setup.update({
    where: { id: setup.id },
    data:  { lifecycleStatus: 'ACTIVE' },
  });

  await notify('TRADE_OPENED',
    `${trade.symbol} ${trade.direction} @ ${trade.entryPrice}\n` +
    `SL: ${trade.sl} | TP1: ${trade.tp1} | Mode: ${trade.mode}`);
}

async function handleTpHit(signal: WebhookSignal, level: 1 | 2 | 3) {
  const trade = await getActiveTrade(signal);
  if (!trade) return;

  const update: Record<string, unknown> = { [`tp${level}Hit`]: true };
  let status = `TP${level}_HIT`;

  if (level === 3) {
    // Auto-close and start cooldown after TP3
    status      = 'CLOSED_WIN';
    update.status      = status;
    update.closedAt    = new Date();
    update.closeReason = 'TP3_HIT';
    update.resultR     = 3;

    if (trade.setupId) {
      const setup = await prisma.setup.findUnique({ where: { id: trade.setupId } });
      if (setup?.fingerprintId) await markFingerprintTraded(setup.fingerprintId, 'WIN_TP3');
      if (setup) {
        await markRangeTraded(
          setup.symbol, setup.timeframe,
          setup.rangeHigh ?? 0, setup.rangeLow ?? 0,
          trade.direction, 'WIN_TP3',
        );
      }
      await prisma.setup.update({ where: { id: trade.setupId }, data: { lifecycleStatus: 'COMPLETED' } });
    }

    const cooldownBars = signal.timeframe === '1D' ? 2 : 4;
    await createCooldown(signal.symbol, signal.timeframe, null, cooldownBars, 'Post-TP3 auto-cooldown');
    await notify('COOLDOWN_STARTED', `${signal.symbol}: ${cooldownBars}-bar cooldown after TP3`);
  } else {
    update.status  = status;
    update.slStatus = 'BREAKEVEN';
    update.slCurrent = trade.entryPrice ?? 0;
  }

  await prisma.trade.update({ where: { id: trade.id }, data: update });
  await notify(`TP${level}_HIT` as any,
    `${signal.symbol} TP${level} hit @ ${signal.entryPrice ?? '—'}\n` +
    `Trade: ${trade.direction} | Mode: ${trade.mode}`);
}

async function handleSlHit(signal: WebhookSignal) {
  const trade = await getActiveTrade(signal);
  if (!trade) return;

  await prisma.trade.update({
    where: { id: trade.id },
    data: { status: 'CLOSED_LOSS', slHit: true, closedAt: new Date(), closeReason: 'SL_HIT', resultR: -1 },
  });

  if (trade.setupId) {
    const setup = await prisma.setup.findUnique({ where: { id: trade.setupId } });
    if (setup?.fingerprintId) await markFingerprintTraded(setup.fingerprintId, 'LOSS_SL');
    if (setup) {
      await markRangeTraded(
        setup.symbol, setup.timeframe,
        setup.rangeHigh ?? 0, setup.rangeLow ?? 0,
        trade.direction, 'LOSS_SL',
      );
    }
    await prisma.setup.update({ where: { id: trade.setupId }, data: { lifecycleStatus: 'COMPLETED' } });
  }

  const tfBars = signal.timeframe === '1D' ? 1 : 3;
  await createCooldown(signal.symbol, signal.timeframe, null, tfBars, 'Post-SL cooldown');

  await notify('SL_HIT', `${signal.symbol} SL hit. Cooldown: ${tfBars} bar(s)`);
}

async function handleCloseTrade(signal: WebhookSignal) {
  const trade = await getActiveTrade(signal);
  if (!trade) return;

  await prisma.trade.update({
    where: { id: trade.id },
    data: { status: 'CLOSED_MANUAL', closedAt: new Date(), closeReason: 'MANUAL' },
  });

  if (trade.setupId) {
    await prisma.setup.update({ where: { id: trade.setupId }, data: { lifecycleStatus: 'COMPLETED' } });
  }

  await notify('TRADE_CLOSED', `${signal.symbol} trade closed manually`);
}

async function handleBarClose(signal: WebhookSignal) {
  // Decrement active cooldown bars on each bar close tick
  const cooldown = await getActiveCooldown(signal.symbol, signal.timeframe);
  if (!cooldown) return;

  const remaining = cooldown.remainingBars - 1;
  if (remaining <= 0) {
    await prisma.cooldown.update({ where: { id: cooldown.id }, data: { active: false, remainingBars: 0 } });
    logger.info('cooldown expired', { symbol: signal.symbol, timeframe: signal.timeframe });
  } else {
    await prisma.cooldown.update({ where: { id: cooldown.id }, data: { remainingBars: remaining } });
  }
}

async function getActiveTrade(signal: WebhookSignal) {
  return prisma.trade.findFirst({
    where: {
      symbol: signal.symbol,
      status: { notIn: ['CLOSED_WIN', 'CLOSED_LOSS', 'CLOSED_MANUAL', 'EXPIRED', 'INVALIDATED'] },
    },
    orderBy: { createdAt: 'desc' },
  });
}
