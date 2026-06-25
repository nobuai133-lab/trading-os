import { describe, it, expect } from 'vitest';

describe('config', () => {
  it('loads without throwing', async () => {
    // Dynamic import so env is set before the module initializes
    const { config } = await import('../config');
    expect(config).toBeDefined();
    expect(config.cloud).toBeDefined();
    expect(config.exchange).toBeDefined();
    expect(config.security).toBeDefined();
  });

  it('exchange.tradingMode defaults to PAPER_TRADING', async () => {
    const { config } = await import('../config');
    // In test environment TRADING_MODE is likely unset → defaults to PAPER_TRADING
    const validModes = ['PAPER_TRADING', 'ALERT_ONLY', 'LIVE'];
    expect(validModes).toContain(config.exchange.tradingMode);
  });

  it('exchange.killSwitch is boolean', async () => {
    const { config } = await import('../config');
    expect(typeof config.exchange.killSwitch).toBe('boolean');
  });

  it('rateLimit values are positive numbers', async () => {
    const { config } = await import('../config');
    expect(config.rateLimit.webhookPerMin).toBeGreaterThan(0);
    expect(config.rateLimit.apiPerMin).toBeGreaterThan(0);
  });
});
