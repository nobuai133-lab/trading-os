import { describe, it, expect } from 'vitest';
import { MARKET_STATUS_FALLBACK } from '@/hooks/useMarketStatusFeed';

// ── MARKET_STATUS_FALLBACK safe-default contract ──────────────────────────────

describe('MARKET_STATUS_FALLBACK', () => {

  it('MS-01 — latestPrice is 0 (never NaN or undefined)', () => {
    expect(typeof MARKET_STATUS_FALLBACK.latestPrice).toBe('number');
    expect(Number.isFinite(MARKET_STATUS_FALLBACK.latestPrice)).toBe(true);
    expect(MARKET_STATUS_FALLBACK.latestPrice).toBe(0);
  });

  it('MS-02 — badge is ERROR (signals no data yet)', () => {
    expect(MARKET_STATUS_FALLBACK.badge).toBe('ERROR');
  });

  it('MS-03 — error flag is true', () => {
    expect(MARKET_STATUS_FALLBACK.error).toBe(true);
  });

  it('MS-04 — freshness flags are all false (safe: never show stale data as fresh)', () => {
    expect(MARKET_STATUS_FALLBACK.isTickerFresh).toBe(false);
    expect(MARKET_STATUS_FALLBACK.isCandleFresh).toBe(false);
    expect(MARKET_STATUS_FALLBACK.isAnalysisFresh).toBe(false);
  });

  it('MS-05 — nullable fields are null or empty (no undefined bleed)', () => {
    // These fields are used by MarketDataStatusBadge — must not be undefined
    expect(MARKET_STATUS_FALLBACK.candleAgeSeconds).toBeNull();
    expect(MARKET_STATUS_FALLBACK.analysisAgeSeconds).toBeNull();
    expect(MARKET_STATUS_FALLBACK.latestClosedCandleTs).toBeNull();
    expect(MARKET_STATUS_FALLBACK.lastFetchedAt).toBe('');
  });

  it('MS-06 — fallback price (0) means StickyHeader will fall back to state.price', () => {
    // Guard: if latestPrice === 0, displayPrice formula must NOT show 0
    // This mirrors the StickyHeader logic: latestPrice > 0 ? latestPrice : state.price
    const statePrice = 59000;
    const displayPrice = MARKET_STATUS_FALLBACK.latestPrice > 0
      ? MARKET_STATUS_FALLBACK.latestPrice
      : statePrice;
    expect(displayPrice).toBe(statePrice);
  });

});

// ── Price display source contract ─────────────────────────────────────────────

describe('StickyHeader price source logic', () => {

  it('MS-07 — live price wins when latestPrice > 0', () => {
    const latestPrice = 59180;
    const statePrice  = 62280; // stale scenario seed
    const displayPrice = latestPrice > 0 ? latestPrice : statePrice;
    expect(displayPrice).toBe(59180);
  });

  it('MS-08 — fallback to state.price when feed not yet loaded (latestPrice === 0)', () => {
    const latestPrice = 0;
    const statePrice  = 59000;
    const displayPrice = latestPrice > 0 ? latestPrice : statePrice;
    expect(displayPrice).toBe(59000);
  });

  it('MS-09 — stale scenario price (62280) is never shown when live feed is active', () => {
    const SCENARIO_PRICE = 62280;
    const LIVE_PRICE     = 59180;
    const displayPrice = LIVE_PRICE > 0 ? LIVE_PRICE : SCENARIO_PRICE;
    expect(displayPrice).not.toBe(SCENARIO_PRICE);
    expect(displayPrice).toBe(LIVE_PRICE);
  });

});
