import { MarketDataVendor, VendorConfig, VendorSelection } from './base/MarketDataVendor';

/**
 * Factory for creating and managing market data vendors
 * Designed to be extensible for future vendors
 */
export class VendorFactory {
  private vendors: Map<string, MarketDataVendor> = new Map();
  private configs: Map<string, VendorConfig> = new Map();

  /**
   * Register a vendor with the factory
   */
  registerVendor(vendor: MarketDataVendor, config: VendorConfig): void {
    this.vendors.set(vendor.name, vendor);
    this.configs.set(vendor.name, config);
  }

  /**
   * Get a vendor by name
   */
  getVendor(name: string): MarketDataVendor | undefined {
    return this.vendors.get(name);
  }

  /**
   * Get all registered vendors
   */
  getAllVendors(): MarketDataVendor[] {
    return Array.from(this.vendors.values());
  }

  /**
   * Get all enabled vendors sorted by priority
   */
  getEnabledVendors(): MarketDataVendor[] {
    return this.getAllVendors()
      .filter(vendor => {
        const config = this.configs.get(vendor.name);
        return config?.enabled !== false;
      })
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Select the best available vendor for a request
   */
  selectVendor(preferredVendor?: string): VendorSelection | null {
    const enabledVendors = this.getEnabledVendors();
    
    if (enabledVendors.length === 0) {
      return null;
    }

    // If preferred vendor is specified and available, use it
    if (preferredVendor) {
      const preferred = this.vendors.get(preferredVendor);
      if (preferred && this.isVendorAvailable(preferred)) {
        return {
          vendor: preferred,
          reason: 'primary',
          health: this.getVendorHealth(preferred)
        };
      }
    }

    // Find the first healthy vendor by priority
    for (const vendor of enabledVendors) {
      if (this.isVendorAvailable(vendor)) {
        return {
          vendor,
          reason: enabledVendors.indexOf(vendor) === 0 ? 'primary' : 'fallback',
          health: this.getVendorHealth(vendor)
        };
      }
    }

    // If no healthy vendors, return the first one anyway (will handle errors gracefully)
    const fallback = enabledVendors[0];
    return {
      vendor: fallback,
      reason: 'only_available',
      health: this.getVendorHealth(fallback)
    };
  }

  /**
   * Check if a vendor is available and healthy
   */
  private isVendorAvailable(vendor: MarketDataVendor): boolean {
    try {
      return vendor.isHealthy();
    } catch (error) {
      console.warn(`Vendor ${vendor.name} health check failed:`, error);
      return false;
    }
  }

  /**
   * Get vendor health information
   */
  private getVendorHealth(vendor: MarketDataVendor) {
    try {
      return vendor.getHealth?.() || {
        isHealthy: vendor.isHealthy(),
        lastError: undefined,
        lastErrorTime: undefined,
        responseTime: undefined,
        uptime: undefined
      };
    } catch (error) {
      return {
        isHealthy: false,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        lastErrorTime: new Date().toISOString(),
        responseTime: undefined,
        uptime: undefined
      };
    }
  }

  /**
   * Initialize all vendors with their configurations
   */
  async initializeAll(): Promise<void> {
    const initPromises = Array.from(this.vendors.values()).map(async (vendor) => {
      try {
        const config = this.configs.get(vendor.name);
        if (config && vendor.initialize) {
          await vendor.initialize(config.config);
        }
      } catch (error) {
        console.warn(`Failed to initialize vendor ${vendor.name}:`, error);
      }
    });

    await Promise.all(initPromises);
  }

  /**
   * Cleanup all vendors
   */
  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.vendors.values()).map(async (vendor) => {
      try {
        if (vendor.cleanup) {
          await vendor.cleanup();
        }
      } catch (error) {
        console.warn(`Failed to cleanup vendor ${vendor.name}:`, error);
      }
    });

    await Promise.all(cleanupPromises);
  }

  /**
   * Get vendor statistics
   */
  getStats(): {
    totalVendors: number;
    enabledVendors: number;
    healthyVendors: number;
    vendors: Array<{
      name: string;
      priority: number;
      enabled: boolean;
      healthy: boolean;
    }>;
  } {
    const allVendors = this.getAllVendors();
    const enabledVendors = this.getEnabledVendors();
    const healthyVendors = enabledVendors.filter(vendor => this.isVendorAvailable(vendor));

    return {
      totalVendors: allVendors.length,
      enabledVendors: enabledVendors.length,
      healthyVendors: healthyVendors.length,
      vendors: allVendors.map(vendor => {
        const config = this.configs.get(vendor.name);
        return {
          name: vendor.name,
          priority: vendor.priority,
          enabled: config?.enabled !== false,
          healthy: this.isVendorAvailable(vendor)
        };
      })
    };
  }
}

/**
 * Global vendor factory instance
 */
export const vendorFactory = new VendorFactory();
