import { VendorFactory } from '../vendors/VendorFactory';
import { MarketDataVendor, VendorConfig } from '../vendors/base/MarketDataVendor';

// Mock vendor for testing
class MockVendor implements MarketDataVendor {
  name: string;
  priority: number;
  isHealthyValue: boolean = true;
  lastError?: string;

  constructor(name: string, priority: number) {
    this.name = name;
    this.priority = priority;
  }

  isHealthy(): boolean {
    return this.isHealthyValue;
  }

  getHealth() {
    return {
      isHealthy: this.isHealthyValue,
      lastError: this.lastError,
      lastErrorTime: undefined,
      responseTime: undefined,
      uptime: undefined
    };
  }

  async fetchCandles(): Promise<Candle[]> {
    return [];
  }

  async fetchOption(_ticker: string, key: { expiry: string; strike: number }) {
    return {
      asOf: new Date().toISOString(),
      expiry: key.expiry,
      strike: key.strike,
      spot: 0
    };
  }

  async getCurrentPrice(): Promise<number> {
    return 100;
  }

  async isTickerTradeable(): Promise<boolean> {
    return true;
  }

  getCapabilities() {
    return {
      supportsOptions: true,
      supportsRealTime: false,
      maxCandles: 200,
      supportedTimeframes: ['1D', '1W'] as const,
      rateLimitPerMinute: 100,
      rateLimitPerDay: 1000
    };
  }

  getRateLimit() {
    return {
      requestsPerMinute: 100,
      requestsPerDay: 1000,
      currentUsage: { minute: 0, day: 0 }
    };
  }

  async initialize(): Promise<void> {
    // Mock implementation
  }

  async cleanup(): Promise<void> {
    // Mock implementation
  }
}

describe('VendorFactory', () => {
  let factory: VendorFactory;
  let mockVendor1: MockVendor;
  let mockVendor2: MockVendor;
  let mockVendor3: MockVendor;

  beforeEach(() => {
    factory = new VendorFactory();
    mockVendor1 = new MockVendor('vendor1', 1);
    mockVendor2 = new MockVendor('vendor2', 2);
    mockVendor3 = new MockVendor('vendor3', 3);
  });

  describe('vendor registration', () => {
    it('should register vendors correctly', () => {
      const config1: VendorConfig = {
        name: 'vendor1',
        priority: 1,
        enabled: true,
        config: {}
      };

      const config2: VendorConfig = {
        name: 'vendor2',
        priority: 2,
        enabled: true,
        config: {}
      };

      factory.registerVendor(mockVendor1, config1);
      factory.registerVendor(mockVendor2, config2);

      expect(factory.getVendor('vendor1')).toBe(mockVendor1);
      expect(factory.getVendor('vendor2')).toBe(mockVendor2);
      expect(factory.getVendor('nonexistent')).toBeUndefined();
    });

    it('should return all registered vendors', () => {
      const config1: VendorConfig = { name: 'vendor1', priority: 1, enabled: true, config: {} };
      const config2: VendorConfig = { name: 'vendor2', priority: 2, enabled: true, config: {} };

      factory.registerVendor(mockVendor1, config1);
      factory.registerVendor(mockVendor2, config2);

      const allVendors = factory.getAllVendors();
      expect(allVendors).toHaveLength(2);
      expect(allVendors).toContain(mockVendor1);
      expect(allVendors).toContain(mockVendor2);
    });
  });

  describe('enabled vendors', () => {
    it('should return only enabled vendors sorted by priority', () => {
      const config1: VendorConfig = { name: 'vendor1', priority: 1, enabled: true, config: {} };
      const config2: VendorConfig = { name: 'vendor2', priority: 2, enabled: false, config: {} };
      const config3: VendorConfig = { name: 'vendor3', priority: 3, enabled: true, config: {} };

      factory.registerVendor(mockVendor1, config1);
      factory.registerVendor(mockVendor2, config2);
      factory.registerVendor(mockVendor3, config3);

      const enabledVendors = factory.getEnabledVendors();
      expect(enabledVendors).toHaveLength(2);
      expect(enabledVendors[0]).toBe(mockVendor1); // Priority 1
      expect(enabledVendors[1]).toBe(mockVendor3); // Priority 3
    });

    it('should return empty array when no vendors are enabled', () => {
      const config1: VendorConfig = { name: 'vendor1', priority: 1, enabled: false, config: {} };
      const config2: VendorConfig = { name: 'vendor2', priority: 2, enabled: false, config: {} };

      factory.registerVendor(mockVendor1, config1);
      factory.registerVendor(mockVendor2, config2);

      const enabledVendors = factory.getEnabledVendors();
      expect(enabledVendors).toHaveLength(0);
    });
  });

  describe('vendor selection', () => {
    beforeEach(() => {
      const config1: VendorConfig = { name: 'vendor1', priority: 1, enabled: true, config: {} };
      const config2: VendorConfig = { name: 'vendor2', priority: 2, enabled: true, config: {} };
      const config3: VendorConfig = { name: 'vendor3', priority: 3, enabled: true, config: {} };

      factory.registerVendor(mockVendor1, config1);
      factory.registerVendor(mockVendor2, config2);
      factory.registerVendor(mockVendor3, config3);
    });

    it('should select preferred vendor when available and healthy', () => {
      const selection = factory.selectVendor('vendor2');
      
      expect(selection).not.toBeNull();
      expect(selection!.vendor).toBe(mockVendor2);
      expect(selection!.reason).toBe('primary');
    });

    it('should fallback to first healthy vendor when preferred is unhealthy', () => {
      mockVendor2.isHealthyValue = false;
      
      const selection = factory.selectVendor('vendor2');
      
      expect(selection).not.toBeNull();
      expect(selection!.vendor).toBe(mockVendor1);
      expect(selection!.reason).toBe('primary'); // vendor1 is the first healthy vendor, so it's primary
    });

    it('should select first healthy vendor when no preferred vendor specified', () => {
      const selection = factory.selectVendor();
      
      expect(selection).not.toBeNull();
      expect(selection!.vendor).toBe(mockVendor1);
      expect(selection!.reason).toBe('primary');
    });

    it('should return first vendor when no healthy vendors available', () => {
      mockVendor1.isHealthyValue = false;
      mockVendor2.isHealthyValue = false;
      mockVendor3.isHealthyValue = false;
      
      const selection = factory.selectVendor();
      
      expect(selection).not.toBeNull();
      expect(selection!.vendor).toBe(mockVendor1);
      expect(selection!.reason).toBe('only_available');
    });

    it('should return null when no vendors registered', () => {
      const emptyFactory = new VendorFactory();
      const selection = emptyFactory.selectVendor();
      
      expect(selection).toBeNull();
    });
  });

  describe('initialization and cleanup', () => {
    it('should initialize all vendors', async () => {
      const config1: VendorConfig = { name: 'vendor1', priority: 1, enabled: true, config: {} };
      const config2: VendorConfig = { name: 'vendor2', priority: 2, enabled: true, config: {} };

      factory.registerVendor(mockVendor1, config1);
      factory.registerVendor(mockVendor2, config2);

      await expect(factory.initializeAll()).resolves.toBeUndefined();
    });

    it('should cleanup all vendors', async () => {
      const config1: VendorConfig = { name: 'vendor1', priority: 1, enabled: true, config: {} };
      const config2: VendorConfig = { name: 'vendor2', priority: 2, enabled: true, config: {} };

      factory.registerVendor(mockVendor1, config1);
      factory.registerVendor(mockVendor2, config2);

      await expect(factory.cleanupAll()).resolves.toBeUndefined();
    });

    it('should handle initialization errors gracefully', async () => {
      const errorVendor = new MockVendor('error', 1);
      errorVendor.initialize = jest.fn().mockRejectedValue(new Error('Init error'));
      
      const config: VendorConfig = { name: 'error', priority: 1, enabled: true, config: {} };
      factory.registerVendor(errorVendor, config);

      // Should not throw
      await expect(factory.initializeAll()).resolves.toBeUndefined();
    });

    it('should handle cleanup errors gracefully', async () => {
      const errorVendor = new MockVendor('error', 1);
      errorVendor.cleanup = jest.fn().mockRejectedValue(new Error('Cleanup error'));
      
      const config: VendorConfig = { name: 'error', priority: 1, enabled: true, config: {} };
      factory.registerVendor(errorVendor, config);

      // Should not throw
      await expect(factory.cleanupAll()).resolves.toBeUndefined();
    });
  });

  describe('statistics', () => {
    it('should return correct statistics', () => {
      const config1: VendorConfig = { name: 'vendor1', priority: 1, enabled: true, config: {} };
      const config2: VendorConfig = { name: 'vendor2', priority: 2, enabled: false, config: {} };
      const config3: VendorConfig = { name: 'vendor3', priority: 3, enabled: true, config: {} };

      factory.registerVendor(mockVendor1, config1);
      factory.registerVendor(mockVendor2, config2);
      factory.registerVendor(mockVendor3, config3);

      mockVendor3.isHealthyValue = false; // Make vendor3 unhealthy

      const stats = factory.getStats();
      
      expect(stats.totalVendors).toBe(3);
      expect(stats.enabledVendors).toBe(2);
      expect(stats.healthyVendors).toBe(1);
      expect(stats.vendors).toHaveLength(3);
      
      expect(stats.vendors[0]).toEqual({
        name: 'vendor1',
        priority: 1,
        enabled: true,
        healthy: true
      });
      
      expect(stats.vendors[1]).toEqual({
        name: 'vendor2',
        priority: 2,
        enabled: false,
        healthy: true
      });
      
      expect(stats.vendors[2]).toEqual({
        name: 'vendor3',
        priority: 3,
        enabled: true,
        healthy: false
      });
    });
  });

  describe('health check error handling', () => {
    it('should handle health check errors gracefully', () => {
      const errorVendor = new MockVendor('error', 1);
      errorVendor.isHealthy = jest.fn().mockImplementation(() => {
        throw new Error('Health check error');
      });
      
      const config: VendorConfig = { name: 'error', priority: 1, enabled: true, config: {} };
      factory.registerVendor(errorVendor, config);

      const selection = factory.selectVendor();
      
      // Should still return the vendor even if health check fails
      expect(selection).not.toBeNull();
      expect(selection!.vendor).toBe(errorVendor);
    });
  });
});
