import { Ticker, Timeframe, Candle, OptionKey, OptionsEntry } from '@/types/market-data';

/**
 * Vendor capabilities for advanced features
 */
export interface VendorCapabilities {
  supportsOptions: boolean;
  supportsRealTime: boolean;
  maxCandles: number;
  supportedTimeframes: Timeframe[];
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
}

/**
 * Rate limit information for monitoring
 */
export interface RateLimitInfo {
  requestsPerMinute: number;
  requestsPerDay: number;
  currentUsage?: {
    minute: number;
    day: number;
  };
  resetTime?: {
    minute: string;
    day: string;
  };
}

/**
 * Vendor health status
 */
export interface VendorHealth {
  isHealthy: boolean;
  lastError?: string;
  lastErrorTime?: string;
  responseTime?: number;
  uptime?: number;
}

/**
 * Base interface for all market data vendors
 * Designed to be extensible for future vendors without breaking changes
 */
export interface MarketDataVendor {
  /** Unique vendor name */
  name: string;
  
  /** Priority for vendor selection (lower = higher priority) */
  priority: number;
  
  /** Check if vendor is currently healthy and available */
  isHealthy(): boolean;
  
  /** Get detailed health information */
  getHealth?(): VendorHealth;
  
  /** Fetch candle data for a ticker and timeframe */
  fetchCandles(ticker: Ticker, timeframe: Timeframe): Promise<Candle[]>;
  
  /** Fetch option data for a specific ticker and option key */
  fetchOption(ticker: Ticker, key: OptionKey): Promise<OptionsEntry>;
  
  /** Get current price for a ticker */
  getCurrentPrice(ticker: Ticker): Promise<number>;
  
  /** Check if a ticker is tradeable on this vendor */
  isTickerTradeable(ticker: Ticker): Promise<boolean>;
  
  /** Get vendor capabilities (optional - for advanced features) */
  getCapabilities?(): VendorCapabilities;
  
  /** Get rate limit information (optional - for monitoring) */
  getRateLimit?(): RateLimitInfo;
  
  /** Initialize vendor with configuration (optional) */
  initialize?(config: Record<string, unknown>): Promise<void>;
  
  /** Cleanup resources (optional) */
  cleanup?(): Promise<void>;
}

/**
 * Vendor configuration interface
 */
export interface VendorConfig {
  name: string;
  priority: number;
  enabled: boolean;
  config: Record<string, unknown>;
}

/**
 * Vendor selection result
 */
export interface VendorSelection {
  vendor: MarketDataVendor;
  reason: 'primary' | 'fallback' | 'only_available';
  health: VendorHealth;
}
