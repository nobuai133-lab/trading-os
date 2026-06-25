import { prisma } from './db';
import { logger } from './logger';

type EventType =
  | 'SETUP_DETECTED'
  | 'TRADE_OPENED'
  | 'TP1_HIT' | 'TP2_HIT' | 'TP3_HIT'
  | 'SL_HIT'
  | 'TRADE_CLOSED'
  | 'SETUP_BLOCKED'
  | 'COOLDOWN_STARTED'
  | 'KILL_SWITCH'
  | 'ERROR';

const EMOJI: Record<EventType, string> = {
  SETUP_DETECTED:   '📡',
  TRADE_OPENED:     '🟢',
  TP1_HIT:          '✅',
  TP2_HIT:          '✅✅',
  TP3_HIT:          '✅✅✅',
  SL_HIT:           '🔴',
  TRADE_CLOSED:     '⬜',
  SETUP_BLOCKED:    '🚫',
  COOLDOWN_STARTED: '⏸',
  KILL_SWITCH:      '🛑',
  ERROR:            '⚠️',
};

async function sendTelegram(message: string): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${text}`);
  }
}

export async function notify(eventType: EventType, message: string): Promise<void> {
  const emoji   = EMOJI[eventType] ?? '•';
  const fullMsg = `${emoji} <b>${eventType}</b>\n${message}`;

  let success = true;
  let error: string | undefined;

  try {
    await sendTelegram(fullMsg);
  } catch (e) {
    success = false;
    error   = e instanceof Error ? e.message : String(e);
    logger.warn('Telegram send failed', { eventType, error });
  }

  await prisma.notification.create({
    data: {
      channel:   'telegram',
      message:   fullMsg,
      eventType,
      success,
      error,
    },
  }).catch((dbErr: unknown) => {
    logger.error('Failed to log notification to DB', { error: String(dbErr) });
  });
}
