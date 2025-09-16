import { AlpacaVendor, createAlpacaVendor } from '../vendors/alpaca/AlpacaVendor';

// Mock fetch globally
global.fetch = jest.fn();

describe('AlpacaVendor', () => {
  let vendor: AlpacaVendor;
  const mockConfig = {
    apiKey: 'test-api-key',
    secretKey: 'test-secret-key',
    dataUrl: 'https://data.alpaca.markets'
  };

  beforeEach(() => {
    vendor = createAlpacaVendor(mockConfig);
    jest.clearAllMocks();
  });

  describe('constructor and basic properties', () => {
    it('should create vendor with correct properties', () => {
      expect(vendor.name).toBe('alpaca');
      expect(vendor.priority).toBe(1);
    });

    it('should implement MarketDataVendor interface', () => {
      expect(vendor).toHaveProperty('name');
      expect(vendor).toHaveProperty('priority');
      expect(vendor).toHaveProperty('isHealthy');
      expect(vendor).toHaveProperty('fetchCandles');
      expect(vendor).toHaveProperty('fetchOption');
      expect(vendor).toHaveProperty('getCurrentPrice');
      expect(vendor).toHaveProperty('isTickerTradeable');
    });
  });

  describe('health checks', () => {
    it('should be healthy when API keys are present', () => {
      expect(vendor.isHealthy()).toBe(true);
    });

    it('should not be healthy when API keys are missing', () => {
      const invalidVendor = createAlpacaVendor({
        apiKey: '',
        secretKey: ''
      });
      expect(invalidVendor.isHealthy()).toBe(false);
    });

    it('should return detailed health information', () => {
      const health = vendor.getHealth();
      expect(health).toHaveProperty('isHealthy');
      expect(health).toHaveProperty('lastError');
      expect(health).toHaveProperty('lastErrorTime');
      expect(health).toHaveProperty('responseTime');
      expect(health).toHaveProperty('uptime');
    });
  });

  describe('capabilities', () => {
    it('should return correct capabilities', () => {
      const capabilities = vendor.getCapabilities();
      expect(capabilities).toEqual({
        supportsOptions: true,
        supportsRealTime: false,
        maxCandles: 200,
        supportedTimeframes: ['1D', '1W'],
        rateLimitPerMinute: 200,
        rateLimitPerDay: 10000
      });
    });
  });

  describe('rate limits', () => {
    it('should return rate limit information', () => {
      const rateLimit = vendor.getRateLimit();
      expect(rateLimit).toHaveProperty('requestsPerMinute', 200);
      expect(rateLimit).toHaveProperty('requestsPerDay', 10000);
      expect(rateLimit).toHaveProperty('currentUsage');
    });
  });

  describe('fetchCandles', () => {
    it('should fetch candles successfully', async () => {
      const mockResponse = {
        bars: {
          'AAPL': [
            {
              t: '2025-01-15T00:00:00Z',
              o: 100,
              h: 105,
              l: 99,
              c: 103,
              v: 1000
            }
          ]
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const candles = await vendor.fetchCandles('AAPL', '1D');
      
      expect(candles).toHaveLength(1);
      expect(candles[0]).toEqual({
        t: '2025-01-15T00:00:00Z',
        o: 100,
        h: 105,
        l: 99,
        c: 103,
        v: 1000
      });
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(vendor.fetchCandles('AAPL', '1D')).rejects.toThrow('Failed to fetch candles from Alpaca');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(vendor.fetchCandles('AAPL', '1D')).rejects.toThrow('Failed to fetch candles from Alpaca');
    });

    it('should limit candles to 200', async () => {
      const mockBars = Array.from({ length: 300 }, (_, i) => ({
        t: `2025-01-${15 + i}T00:00:00Z`,
        o: 100 + i,
        h: 105 + i,
        l: 99 + i,
        c: 103 + i,
        v: 1000 + i
      }));

      const mockResponse = {
        bars: {
          'AAPL': mockBars
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const candles = await vendor.fetchCandles('AAPL', '1D');
      expect(candles).toHaveLength(200);
    });
  });

  describe('fetchOption', () => {
    it('should return option data with current price', async () => {
      const mockPriceResponse = {
        quotes: {
          'AAPL': {
            ap: 150.50
          }
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPriceResponse)
      });

      const option = await vendor.fetchOption('AAPL', { expiry: '2025-02-15', strike: 150 });
      
      expect(option).toHaveProperty('asOf');
      expect(option).toHaveProperty('expiry', '2025-02-15');
      expect(option).toHaveProperty('strike', 150);
      expect(option).toHaveProperty('spot', 150.50);
    });

    it('should handle option fetch errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(vendor.fetchOption('AAPL', { expiry: '2025-02-15', strike: 150 }))
        .rejects.toThrow('Failed to fetch option from Alpaca');
    });
  });

  describe('getCurrentPrice', () => {
    it('should fetch current price successfully', async () => {
      const mockResponse = {
        quotes: {
          'AAPL': {
            ap: 150.50
          }
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const price = await vendor.getCurrentPrice('AAPL');
      expect(price).toBe(150.50);
    });

    it('should handle price fetch errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(vendor.getCurrentPrice('INVALID')).rejects.toThrow('Failed to get current price from Alpaca');
    });
  });

  describe('isTickerTradeable', () => {
    it('should return true for tradeable ticker', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const tradeable = await vendor.isTickerTradeable('AAPL');
      expect(tradeable).toBe(true);
    });

    it('should return false for non-tradeable ticker', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false
      });

      const tradeable = await vendor.isTickerTradeable('INVALID');
      expect(tradeable).toBe(false);
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const tradeable = await vendor.isTickerTradeable('AAPL');
      expect(tradeable).toBe(false);
    });
  });

  describe('initialization and cleanup', () => {
    it('should initialize successfully', async () => {
      await expect(vendor.initialize({})).resolves.toBeUndefined();
    });

    it('should cleanup successfully', async () => {
      await expect(vendor.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should track errors in health status', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Test error'));

      try {
        await vendor.fetchCandles('AAPL', '1D');
      } catch {
        // Expected to throw
      }

      const health = vendor.getHealth();
      expect(health.isHealthy).toBe(false);
      expect(health.lastError).toBe('Test error');
      expect(health.lastErrorTime).toBeDefined();
    });

    it('should clear errors on successful requests', async () => {
      // First, cause an error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Test error'));
      try {
        await vendor.fetchCandles('AAPL', '1D');
      } catch {
        // Expected to throw
      }

      // Then, make a successful request
      const mockResponse = {
        bars: {
          'AAPL': []
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await vendor.fetchCandles('AAPL', '1D');

      const health = vendor.getHealth();
      expect(health.isHealthy).toBe(true);
      expect(health.lastError).toBeUndefined();
    });
  });
});
