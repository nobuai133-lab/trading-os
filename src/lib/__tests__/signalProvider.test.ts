import { describe, it, expect } from 'vitest';
import { parseWebhookPayload } from '../signalProvider';

describe('parseWebhookPayload — ITOS enrichment fields', () => {

  const basePayload = { symbol: 'BTCUSDT', signal: 'SETUP_DETECTED' };

  // BC-01: valid setupIntent passes through
  it('BC-01: valid setupIntent is accepted', () => {
    const r = parseWebhookPayload({ ...basePayload, setupIntent: 'TREND_CONTINUATION' });
    expect(r.setupIntent).toBe('TREND_CONTINUATION');
  });

  // BC-02: invalid setupIntent coerced to undefined
  it('BC-02: invalid setupIntent coerced to undefined', () => {
    const r = parseWebhookPayload({ ...basePayload, setupIntent: 'INVALID_GARBAGE' });
    expect(r.setupIntent).toBeUndefined();
  });

  // BC-03: lowercase setupIntent is accepted (coerced to uppercase)
  it('BC-03: lowercase setupIntent is accepted', () => {
    const r = parseWebhookPayload({ ...basePayload, setupIntent: 'reversal' });
    expect(r.setupIntent).toBe('REVERSAL');
  });

  // BC-04: valid entryZoneSource passes through
  it('BC-04: valid entryZoneSource is accepted', () => {
    const r = parseWebhookPayload({ ...basePayload, entryZoneSource: 'DEMAND_ZONE' });
    expect(r.entryZoneSource).toBe('DEMAND_ZONE');
  });

  // BC-05: invalid entryZoneSource coerced to UNKNOWN
  it('BC-05: invalid entryZoneSource coerced to UNKNOWN', () => {
    const r = parseWebhookPayload({ ...basePayload, entryZoneSource: 'GARBAGE_SOURCE' });
    expect(r.entryZoneSource).toBe('UNKNOWN');
  });

  // BC-06: boolean evidence flags parsed correctly
  it('BC-06: boolean evidence flags are parsed correctly', () => {
    const r = parseWebhookPayload({
      ...basePayload,
      liquidityEvidence:   true,
      structureEvidence:   false,
      acceptanceEvidence:  true,
      momentumEvidence:    true,
      volumeEvidence:      false,
    });
    expect(r.liquidityEvidence).toBe(true);
    expect(r.structureEvidence).toBe(false);
    expect(r.acceptanceEvidence).toBe(true);
    expect(r.volumeEvidence).toBe(false);
  });

  // BC-07: string "true"/"1" coerced to boolean true
  it('BC-07: string "true" evidence flag coerced to true', () => {
    const r = parseWebhookPayload({ ...basePayload, liquidityEvidence: 'true' });
    expect(r.liquidityEvidence).toBe(true);
  });

  // BC-08: missing evidence flags default to false
  it('BC-08: missing evidence flags default to false', () => {
    const r = parseWebhookPayload(basePayload);
    expect(r.liquidityEvidence).toBe(false);
    expect(r.structureEvidence).toBe(false);
    expect(r.volumeEvidence).toBe(false);
  });

  // BC-09: setupCreatedAt and setupTimeframe passed through
  it('BC-09: setupCreatedAt and setupTimeframe are forwarded', () => {
    const r = parseWebhookPayload({
      ...basePayload,
      setupCreatedAt: '2026-06-24T12:00:00.000Z',
      setupTimeframe: '4H',
    });
    expect(r.setupCreatedAt).toBe('2026-06-24T12:00:00.000Z');
    expect(r.setupTimeframe).toBe('4H');
  });

  // BC-10: reversalConfirmationCount parsed as number
  it('BC-10: reversalConfirmationCount is parsed as number', () => {
    const r = parseWebhookPayload({ ...basePayload, reversalConfirmationCount: 4 });
    expect(r.reversalConfirmationCount).toBe(4);
  });

});
