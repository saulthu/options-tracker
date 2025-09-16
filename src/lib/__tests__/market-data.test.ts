// Market Data Module Tests
// Comprehensive test suite for market data caching, persistence, and calculations

import { MarketData } from '../market-data';
import { Candle, OptionKey, OptionsEntry } from '@/types/market-data';

// Mock Supabase
jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn()
      }))
    }))
  }
}));

describe('MarketData', () => {
  let marketData: MarketData;
  const mockTicker = 'AAPL';
  const mockTimeframe = '1D' as const;

  beforeEach(() => {
    marketData = new MarketData({
      optionsRetentionDays: 7,
      candleFreshnessMinutes: {
        '1D': { marketHours: 1, afterHours: 30 },
        '1W': { marketHours: 24 * 60, afterHours: 24 * 60 }
      },
      optionsFreshnessMinutes: {
        marketHours: 5,
        afterHours: 60
      }
    });
  });

  describe('Candle Data Management', () => {
    it('should cache candle data in memory', async () => {
      const mockCandles: Candle[] = [
        { t: '2025-01-01T00:00:00Z', o: 100, h: 105, l: 95, c: 102, v: 1000 },
        { t: '2025-01-02T00:00:00Z', o: 102, h: 108, l: 98, c: 106, v: 1200 }
      ];

      // Mock vendor API response
      const mockVendorResponse = {
        symbol: mockTicker,
        timeframe: mockTimeframe,
        candles: mockCandles
      };

      // Mock the vendor fetch method
      jest.spyOn(marketData as unknown as { fetchCandlesFromVendor: jest.Mock }, 'fetchCandlesFromVendor').mockResolvedValue(mockVendorResponse);

      const result = await marketData.getCandles(mockTicker, mockTimeframe);

      expect(result).toEqual(mockCandles);
      expect(marketData['candleCache'][mockTicker][mockTimeframe].data).toEqual(mockCandles);
    });

    it('should trim candles to ≤200 before caching', async () => {
      const largeCandleArray = Array.from({ length: 300 }, (_, i) => ({
        t: `2025-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        o: 100 + i,
        h: 105 + i,
        l: 95 + i,
        c: 102 + i,
        v: 1000 + i
      }));

      const mockVendorResponse = {
        symbol: mockTicker,
        timeframe: mockTimeframe,
        candles: largeCandleArray
      };

      jest.spyOn(marketData as unknown as { fetchCandlesFromVendor: jest.Mock }, 'fetchCandlesFromVendor').mockResolvedValue(mockVendorResponse);

      const result = await marketData.getCandles(mockTicker, mockTimeframe);

      expect(result).toHaveLength(200);
      expect(result).toEqual(largeCandleArray.slice(-200));
    });

    it('should check freshness before serving cached data', async () => {
      const mockCandles: Candle[] = [
        { t: '2025-01-01T00:00:00Z', o: 100, h: 105, l: 95, c: 102, v: 1000 }
      ];

      // Add stale data to cache
      marketData['candleCache'][mockTicker] = {
        '1D': {
          data: mockCandles,
          lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
        },
        '1W': { data: [], lastUpdated: '' }
      };

      const mockVendorResponse = {
        symbol: mockTicker,
        timeframe: mockTimeframe,
        candles: mockCandles
      };

      jest.spyOn(marketData as unknown as { fetchCandlesFromVendor: jest.Mock }, 'fetchCandlesFromVendor').mockResolvedValue(mockVendorResponse);

      await marketData.getCandles(mockTicker, mockTimeframe);

      // Should fetch from vendor due to stale cache
      expect(marketData['fetchCandlesFromVendor']).toHaveBeenCalledWith(mockTicker, mockTimeframe);
    });
  });

  describe('Options Data Management', () => {
    it('should cache option data by expiry@strike key', async () => {
      const mockKey: OptionKey = { expiry: '2025-01-20', strike: 150 };
      const mockEntry: OptionsEntry = {
        asOf: '2025-01-15T10:00:00Z',
        expiry: '2025-01-20',
        strike: 150,
        call: { bid: 2.5, ask: 2.7, last: 2.6 },
        spot: 148.50
      };

      jest.spyOn(marketData as unknown as { fetchOptionsFromVendor: jest.Mock }, 'fetchOptionsFromVendor').mockResolvedValue(mockEntry);

      const result = await marketData.getOption(mockTicker, mockKey);

      expect(result).toEqual(mockEntry);
      expect(marketData['optionsCache'][mockTicker].get('2025-01-20@150')).toEqual(mockEntry);
    });

    it('should list option keys after pruning expired entries', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const oldDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      marketData['optionsCache'][mockTicker] = new Map([
        [`${futureDate}@150`, {
          asOf: now.toISOString(),
          expiry: futureDate,
          strike: 150,
          spot: 148.50
        }],
        [`${oldDate}@120`, {
          asOf: now.toISOString(),
          expiry: oldDate,
          strike: 120,
          spot: 148.50
        }]
      ]);

      const keys = await marketData.listOptionKeys(mockTicker);

      expect(keys).toHaveLength(1);
      expect(keys[0]).toEqual({ expiry: futureDate, strike: 150 });
    });
  });

  describe('Technical Indicators', () => {
    it('should calculate SMA correctly', async () => {
      const mockCandles: Candle[] = [
        { t: '2025-01-01T00:00:00Z', o: 100, h: 105, l: 95, c: 100, v: 1000 },
        { t: '2025-01-02T00:00:00Z', o: 100, h: 106, l: 96, c: 102, v: 1100 },
        { t: '2025-01-03T00:00:00Z', o: 102, h: 107, l: 97, c: 104, v: 1200 },
        { t: '2025-01-04T00:00:00Z', o: 104, h: 108, l: 98, c: 106, v: 1300 },
        { t: '2025-01-05T00:00:00Z', o: 106, h: 109, l: 99, c: 108, v: 1400 }
      ];

      jest.spyOn(marketData as unknown as { fetchCandlesFromVendor: jest.Mock }, 'fetchCandlesFromVendor').mockResolvedValue({
        symbol: mockTicker,
        timeframe: mockTimeframe,
        candles: mockCandles
      });

      const sma = await marketData.getIndicator(mockTicker, 'SMA', { window: 3 }, mockTimeframe);

      // SMA for window 3: [NaN, NaN, 102, 104, 106]
      expect(sma[0]).toBeNaN();
      expect(sma[1]).toBeNaN();
      expect(sma[2]).toBeCloseTo(102, 2); // (100+102+104)/3
      expect(sma[3]).toBeCloseTo(104, 2); // (102+104+106)/3
      expect(sma[4]).toBeCloseTo(106, 2); // (104+106+108)/3
    });

    it('should calculate EMA correctly', async () => {
      const mockCandles: Candle[] = [
        { t: '2025-01-01T00:00:00Z', o: 100, h: 105, l: 95, c: 100, v: 1000 },
        { t: '2025-01-02T00:00:00Z', o: 100, h: 106, l: 96, c: 102, v: 1100 },
        { t: '2025-01-03T00:00:00Z', o: 102, h: 107, l: 97, c: 104, v: 1200 },
        { t: '2025-01-04T00:00:00Z', o: 104, h: 108, l: 98, c: 106, v: 1300 }
      ];

      jest.spyOn(marketData as unknown as { fetchCandlesFromVendor: jest.Mock }, 'fetchCandlesFromVendor').mockResolvedValue({
        symbol: mockTicker,
        timeframe: mockTimeframe,
        candles: mockCandles
      });

      const ema = await marketData.getIndicator(mockTicker, 'EMA', { window: 3 }, mockTimeframe);

      // EMA for window 3: [NaN, NaN, 102, ...]
      expect(ema[0]).toBeNaN();
      expect(ema[1]).toBeNaN();
      expect(ema[2]).toBeCloseTo(102, 2); // First EMA value is SMA
      expect(ema[3]).toBeGreaterThan(102); // EMA should be trending upward
    });

    it('should handle insufficient data for indicators', async () => {
      const mockCandles: Candle[] = [
        { t: '2025-01-01T00:00:00Z', o: 100, h: 105, l: 95, c: 100, v: 1000 }
      ];

      jest.spyOn(marketData as unknown as { fetchCandlesFromVendor: jest.Mock }, 'fetchCandlesFromVendor').mockResolvedValue({
        symbol: mockTicker,
        timeframe: mockTimeframe,
        candles: mockCandles
      });

      const sma = await marketData.getIndicator(mockTicker, 'SMA', { window: 5 }, mockTimeframe);

      expect(sma).toEqual([NaN]); // Not enough data for window of 5
    });
  });

  describe('Database Persistence', () => {
    it('should serialize data to MarketDataBlob format', () => {
      const mockCandles: Candle[] = [
        { t: '2025-01-01T00:00:00Z', o: 100, h: 105, l: 95, c: 102, v: 1000 }
      ];

      marketData['candleCache'][mockTicker] = {
        '1D': { data: mockCandles, lastUpdated: '2025-01-01T10:00:00Z' },
        '1W': { data: [], lastUpdated: '' }
      };

      const blob = marketData['serializeToBlob'](mockTicker);

      expect(blob.schemaVersion).toBe(1);
      expect(blob.candles['1D'].series).toEqual(mockCandles);
      expect(blob.candles['1D'].lastUpdated).toBe('2025-01-01T10:00:00Z');
      expect(blob.options.entries).toEqual({});
    });

    it('should prune expired options during serialization', () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const oldDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      marketData['optionsCache'][mockTicker] = new Map([
        [`${futureDate}@150`, {
          asOf: now.toISOString(),
          expiry: futureDate,
          strike: 150,
          spot: 148.50
        }],
        [`${oldDate}@120`, {
          asOf: now.toISOString(),
          expiry: oldDate,
          strike: 120,
          spot: 148.50
        }]
      ]);

      const blob = marketData['serializeToBlob'](mockTicker);

      expect(Object.keys(blob.options.entries)).toHaveLength(1);
      expect(blob.options.entries[`${futureDate}@150`]).toBeDefined();
      expect(blob.options.entries[`${oldDate}@120`]).toBeUndefined();
    });
  });

  describe('Market Hours Detection', () => {
    it('should detect market hours correctly', () => {
      // Monday 10:00 AM (market hours) - January 6, 2025 is a Monday
      const marketTime = new Date('2025-01-06T15:00:00Z'); // 10:00 AM ET (15:00 UTC = 10:00 AM ET)
      expect(marketData['isMarketHours'](marketTime)).toBe(true);

      // Saturday (weekend) - January 4, 2025 is a Saturday
      const weekendTime = new Date('2025-01-04T15:00:00Z'); // Saturday
      expect(marketData['isMarketHours'](weekendTime)).toBe(false);

      // Before market open
      const beforeOpen = new Date('2025-01-06T13:00:00Z'); // 8:00 AM ET
      expect(marketData['isMarketHours'](beforeOpen)).toBe(false);

      // After market close
      const afterClose = new Date('2025-01-06T21:00:00Z'); // 4:00 PM ET
      expect(marketData['isMarketHours'](afterClose)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle vendor API failures gracefully', async () => {
      jest.spyOn(marketData as unknown as { fetchCandlesFromVendor: jest.Mock }, 'fetchCandlesFromVendor').mockRejectedValue(new Error('API Error'));

      await expect(marketData.getCandles(mockTicker, mockTimeframe)).rejects.toThrow('API Error');
    });

    it('should handle database errors gracefully', async () => {
      const { supabase } = jest.requireMock('../supabase');
      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockRejectedValue(new Error('DB Error'))
          }))
        }))
      });

      await marketData.getCandles(mockTicker, mockTimeframe, { forceRefresh: false });
      // Should fall back to vendor API without throwing
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration values', () => {
      const customConfig = {
        optionsRetentionDays: 14,
        candleFreshnessMinutes: {
          '1D': { marketHours: 2, afterHours: 60 },
          '1W': { marketHours: 48 * 60, afterHours: 48 * 60 }
        },
        optionsFreshnessMinutes: {
          marketHours: 10,
          afterHours: 120
        }
      };

      const customMarketData = new MarketData(customConfig);
      
      expect(customMarketData['config'].optionsRetentionDays).toBe(14);
      expect(customMarketData['config'].candleFreshnessMinutes['1D'].marketHours).toBe(2);
      expect(customMarketData['config'].optionsFreshnessMinutes.marketHours).toBe(10);
    });

    it('should use default configuration when not provided', () => {
      const defaultMarketData = new MarketData();
      
      expect(defaultMarketData['config'].optionsRetentionDays).toBe(7);
      expect(defaultMarketData['config'].candleFreshnessMinutes['1D'].marketHours).toBe(1);
      expect(defaultMarketData['config'].optionsFreshnessMinutes.marketHours).toBe(5);
    });
  });
});
