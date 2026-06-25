import { randomBytes } from 'crypto';

export function generateCorrelationId(): string {
  return `cid_${Date.now()}_${randomBytes(4).toString('hex')}`;
}
