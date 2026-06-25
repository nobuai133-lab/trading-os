import type { KernelEvent, KernelEventInput, ValidationResult } from './types';

export function validateEventInput(input: KernelEventInput): ValidationResult {
  const errors: ValidationResult['errors']   = [];
  const warnings: ValidationResult['warnings'] = [];

  if (!input.correlationId?.trim())
    errors.push({ code: 'KERNEL-1001', message: 'correlationId is required', field: 'correlationId' });
  if (!input.source?.trim())
    errors.push({ code: 'KERNEL-1002', message: 'source is required', field: 'source' });
  if (!input.domain)
    errors.push({ code: 'KERNEL-1003', message: 'domain is required', field: 'domain' });
  if (!input.type?.trim())
    errors.push({ code: 'KERNEL-1004', message: 'type is required', field: 'type' });
  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload))
    errors.push({ code: 'KERNEL-1005', message: 'payload must be a plain object', field: 'payload' });

  return { valid: errors.length === 0, errors, warnings };
}

export function validateEventChain(events: KernelEvent[]): ValidationResult {
  const errors: ValidationResult['errors']   = [];
  const warnings: ValidationResult['warnings'] = [];

  if (events.length === 0) return { valid: true, errors, warnings };

  const seenIds  = new Set<string>();
  const seenSeqs = new Set<bigint>();

  for (let i = 0; i < events.length; i++) {
    const ev   = events[i];
    const prev = events[i - 1];

    if (seenIds.has(ev.id))
      errors.push({ code: 'KERNEL-2001', message: `Duplicate event id: ${ev.id}`, field: 'id' });
    seenIds.add(ev.id);

    if (seenSeqs.has(ev.seq))
      errors.push({ code: 'KERNEL-2002', message: `Duplicate seq: ${ev.seq}`, field: 'seq' });
    seenSeqs.add(ev.seq);

    if (i > 0) {
      if (ev.seq <= prev.seq)
        errors.push({ code: 'KERNEL-2003', message: `Out-of-order seq at index ${i}: ${prev.seq} → ${ev.seq}`, field: 'seq' });
      if (ev.previousSeq !== prev.seq)
        warnings.push({ code: 'KERNEL-3001', message: `previousSeq chain gap at ${i}: expected ${prev.seq}, got ${ev.previousSeq}` });
      if (ev.ts < prev.ts)
        warnings.push({ code: 'KERNEL-3002', message: `Timestamp regression at index ${i}: ${prev.ts} → ${ev.ts}` });
    }

    if (!ev.id)            errors.push({ code: 'KERNEL-2004', message: `Event[${i}] missing id`, field: 'id' });
    if (!ev.ts)            errors.push({ code: 'KERNEL-2005', message: `Event[${i}] missing ts`, field: 'ts' });
    if (!ev.correlationId) errors.push({ code: 'KERNEL-2006', message: `Event[${i}] missing correlationId`, field: 'correlationId' });
    if (!ev.source)        errors.push({ code: 'KERNEL-2007', message: `Event[${i}] missing source`, field: 'source' });
    if (!ev.domain)        errors.push({ code: 'KERNEL-2008', message: `Event[${i}] missing domain`, field: 'domain' });
    if (!ev.type)          errors.push({ code: 'KERNEL-2009', message: `Event[${i}] missing type`, field: 'type' });

    if (typeof ev.version !== 'number' || ev.version < 1)
      warnings.push({ code: 'KERNEL-3003', message: `Event[${i}] invalid version: ${ev.version}` });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateSingleEvent(event: KernelEvent, expectedPreviousSeq: bigint): ValidationResult {
  const errors: ValidationResult['errors']   = [];
  const warnings: ValidationResult['warnings'] = [];

  if (!event.id)            errors.push({ code: 'KERNEL-2004', message: 'missing id', field: 'id' });
  if (!event.ts)            errors.push({ code: 'KERNEL-2005', message: 'missing ts', field: 'ts' });
  if (!event.correlationId) errors.push({ code: 'KERNEL-2006', message: 'missing correlationId', field: 'correlationId' });
  if (!event.source)        errors.push({ code: 'KERNEL-2007', message: 'missing source', field: 'source' });
  if (!event.domain)        errors.push({ code: 'KERNEL-2008', message: 'missing domain', field: 'domain' });
  if (!event.type)          errors.push({ code: 'KERNEL-2009', message: 'missing type', field: 'type' });

  if (event.previousSeq !== expectedPreviousSeq)
    warnings.push({ code: 'KERNEL-3001', message: `previousSeq mismatch: expected ${expectedPreviousSeq}, got ${event.previousSeq}` });

  return { valid: errors.length === 0, errors, warnings };
}
