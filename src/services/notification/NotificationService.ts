import { notify } from '@/lib/notificationService';
import { logger }  from '@/core/logger';
import { generateCorrelationId } from '@/core/correlationId';

const log = logger.withContext({ service: 'notification' });

type NotifyEventType = Parameters<typeof notify>[0];

export class NotificationService {
  async send(
    eventType: NotifyEventType,
    message: string,
    correlationId = generateCorrelationId(),
  ): Promise<void> {
    log.debug('send', { correlationId, eventType });
    try {
      await notify(eventType, message);
    } catch (err) {
      log.error('send failed', { correlationId, eventType, err: String(err) });
    }
  }
}

export const notificationService = new NotificationService();

