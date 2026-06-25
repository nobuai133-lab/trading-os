import { describe, it, expect } from 'vitest';
import { GateioPerpProvider }     from '../marketData/providers/GateioPerpProvider';
import { BinanceFuturesProvider } from '../marketData/providers/BinanceFuturesProvider';
import { BybitProvider }          from '../marketData/providers/BybitProvider';
import { CoinbaseProvider }       from '../marketData/providers/CoinbaseProvider';
import { KrakenProvider }         from '../marketData/providers/KrakenProvider';
import { BinanceProvider }        from '../marketData/providers/BinanceProvider';
import { BinanceWsProvider }      from '../marketData/providers/BinanceWsProvider';
import { TradingViewProvider }    from '../marketData/providers/TradingViewProvider';

describe('marketProvider priceBasis', () => {
  // MP-01: PERP providers
  it('MP-01: Gate.io perpetual provider has priceBasis = PERP', () => {
    expect(new GateioPerpProvider().priceBasis).toBe('PERP');
  });

  it('MP-02: Binance Futures provider has priceBasis = PERP', () => {
    expect(new BinanceFuturesProvider().priceBasis).toBe('PERP');
  });

  it('MP-03: Bybit provider has priceBasis = PERP', () => {
    expect(new BybitProvider().priceBasis).toBe('PERP');
  });

  // MP-04: SPOT providers
  it('MP-04: Coinbase provider has priceBasis = SPOT', () => {
    expect(new CoinbaseProvider().priceBasis).toBe('SPOT');
  });

  it('MP-05: Kraken provider has priceBasis = SPOT', () => {
    expect(new KrakenProvider().priceBasis).toBe('SPOT');
  });

  it('MP-06: Binance spot provider has priceBasis = SPOT', () => {
    expect(new BinanceProvider().priceBasis).toBe('SPOT');
  });

  // MP-05: Priority ordering
  it('MP-07: Gate.io perpetual has highest priority (lowest number)', () => {
    const providers = [
      new GateioPerpProvider(),
      new BinanceFuturesProvider(),
      new BybitProvider(),
      new CoinbaseProvider(),
      new KrakenProvider(),
    ];
    const sorted = [...providers].sort((a, b) => a.priority - b.priority);
    expect(sorted[0].name).toBe('gateio-perp');
    expect(sorted[1].name).toBe('binance-futures');
  });

  // MP-06: Stub providers are unavailable
  it('MP-08: BinanceWsProvider is unavailable (stub)', () => {
    expect(new BinanceWsProvider().isAvailable()).toBe(false);
  });

  it('MP-09: TradingViewProvider is unavailable in server context', () => {
    expect(new TradingViewProvider().isAvailable()).toBe(false);
  });
});
