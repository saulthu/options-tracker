import { 
  MarketDataVendor, 
  VendorCapabilities, 
  RateLimitInfo, 
  VendorHealth 
} from '../base/MarketDataVendor';
import { Ticker, Timeframe, Candle, OptionKey, OptionsEntry } from '@/types/market-data';

export interface AlpacaConfig {
  apiKey: string;
  secretKey: string;
  baseUrl?: string; // Default: https://paper-api.alpaca.markets for paper trading
  dataUrl?: string; // Default: https://data.alpaca.markets
  dataPlan: 'free' | 'pro';
}

export class AlpacaVendor implements MarketDataVendor {
  public readonly name = 'alpaca';
  public readonly priority = 1; // High priority

  private apiKey: string;
  private secretKey: string;
  private dataUrl: string;
  private baseUrl: string;
  private dataPlan: 'free' | 'pro';
  private lastError?: string;
  private lastErrorTime?: string;
  private startTime: number;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(config: AlpacaConfig) {
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
    this.dataUrl = config.dataUrl || 'https://data.alpaca.markets';
    this.baseUrl = config.baseUrl || 'https://paper-api.alpaca.markets';
    this.dataPlan = config.dataPlan;
    this.startTime = Date.now();
  }

  /**
   * Check if vendor is healthy
   */
  isHealthy(): boolean {
    // Basic health check - no recent errors and API keys are present
    return !!(this.apiKey && this.secretKey && !this.lastError);
  }

  /**
   * Get detailed health information
   */
  getHealth(): VendorHealth {
    return {
      isHealthy: this.isHealthy(),
      lastError: this.lastError,
      lastErrorTime: this.lastErrorTime,
      responseTime: this.lastRequestTime > 0 ? this.lastRequestTime : undefined,
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Get vendor capabilities
   */
  getCapabilities(): VendorCapabilities {
    return {
      supportsOptions: true,
      supportsRealTime: false, // Alpaca data API is not real-time
      maxCandles: 200,
      supportedTimeframes: ['1D', '1W'],
      rateLimitPerMinute: 200, // Alpaca free tier limit
      rateLimitPerDay: 10000
    };
  }

  /**
   * Get rate limit information
   */
  getRateLimit(): RateLimitInfo {
    return {
      requestsPerMinute: 200,
      requestsPerDay: 10000,
      currentUsage: {
        minute: this.requestCount, // Simplified - would need proper tracking
        day: this.requestCount
      }
    };
  }

  /**
   * Initialize vendor with configuration
   */
  async initialize(): Promise<void> {
    // Alpaca vendor is initialized in constructor
    // This method is for future extensibility
    console.log('Alpaca vendor initialized');
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // No cleanup needed for Alpaca vendor
    console.log('Alpaca vendor cleaned up');
  }

  /**
   * Fetch historical candles from Alpaca
   */
  async fetchCandles(ticker: Ticker, timeframe: Timeframe): Promise<Candle[]> {
    const startTime = Date.now();
    
    try {
      // Convert our timeframe to Alpaca's format
      const alpacaTimeframe = this.convertTimeframe(timeframe);
      
      // Request the last 200 days of candles
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 1); // yesterday to avoid recent SIP restrictions
      endDate.setHours(23, 59, 59, 999);

      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 900); // ~3 years back to safely cover ≥200 trading days

      console.log(`[DEBUG] Alpaca API request for ${ticker}:`, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timeframe: alpacaTimeframe,
        ticker
      });

      // Build URL for Alpaca API - use the correct endpoint format
      const url = new URL('/v2/stocks/bars', this.dataUrl);
      url.searchParams.set('symbols', ticker);
      url.searchParams.set('start', startDate.toISOString().split('T')[0]); // Date only: YYYY-MM-DD
      url.searchParams.set('end', endDate.toISOString().split('T')[0]); // Date only: YYYY-MM-DD
      url.searchParams.set('timeframe', alpacaTimeframe);
      url.searchParams.set('limit', '10000'); // fetch large range, we slice to 200 later
      // Remove feed parameter to use default feed (might work better than IEX)

      console.log(`[DEBUG] Alpaca API URL:`, url.toString());

      // Make HTTP request to Alpaca API
      const response = await fetch(url.toString(), {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // Handle specific subscription errors
        if (response.status === 403) {
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.message?.includes('subscription does not permit')) {
              errorMessage += ` - ${errorData.message}. Please check your Alpaca subscription level or try using historical data only.`;
            } else {
              errorMessage += ` - ${errorText}`;
            }
          } catch {
            errorMessage += ` - ${errorText}`;
          }
        } else {
          errorMessage += ` - ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Debug logging to see what we're getting from Alpaca
      console.log(`Alpaca API response for ${ticker}:`, {
        hasBars: !!data.bars,
        barsKeys: data.bars ? Object.keys(data.bars) : 'no bars',
        tickerBars: data.bars?.[ticker]?.length || 0,
        fullResponse: data
      });
      
      const bars = data.bars?.[ticker] || [];
      
      // Additional debugging for empty results
      if (bars.length === 0) {
        console.warn(`[DEBUG] No bars returned for ${ticker}. API response:`, {
          status: response.status,
          statusText: response.statusText,
          data: data,
          url: url.toString()
        });
      }

      // Convert Alpaca bars to our Candle format
      const candles: Candle[] = bars.map((bar: { 
        t: string; 
        o: number; 
        h: number; 
        l: number; 
        c: number; 
        v: number 
      }) => ({
        t: bar.t,
        o: bar.o,
        h: bar.h,
        l: bar.l,
        c: bar.c,
        v: bar.v
      }));

      this.lastRequestTime = Date.now() - startTime;
      this.requestCount++;
      this.clearError();

      return candles.slice(-200); // Ensure we don't exceed 200 candles

    } catch (error) {
      this.setError(error);
      throw new Error(`Failed to fetch candles from Alpaca: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch option data from Alpaca
   */
  async fetchOption(ticker: Ticker, key: OptionKey): Promise<OptionsEntry> {
    const startTime = Date.now();
    
    try {
      // Alpaca doesn't provide options data in their free tier
      // This is a placeholder implementation
      const currentPrice = await this.getCurrentPrice(ticker);
      
      this.lastRequestTime = Date.now() - startTime;
      this.requestCount++;
      this.clearError();

      return {
        asOf: new Date().toISOString(),
        expiry: key.expiry,
        strike: key.strike,
        spot: currentPrice,
        // No options data available in free tier
        call: undefined,
        put: undefined
      };

    } catch (error) {
      this.setError(error);
      throw new Error(`Failed to fetch option from Alpaca: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current price for a ticker
   */
  async getCurrentPrice(ticker: Ticker): Promise<number> {
    const startTime = Date.now();
    
    try {
      // On free plan, return last daily close instead of latest quote to avoid recent SIP restrictions
      if (this.dataPlan === 'free') {
        try {
          const candles = await this.fetchCandles(ticker, '1D');
          const last = candles[candles.length - 1];
          if (last && typeof last.c === 'number') {
            this.lastRequestTime = Date.now() - startTime;
            this.requestCount++;
            this.clearError();
            return last.c;
          }
        } catch {
          // For free plan, do NOT return pre/after-hours quotes; signal upstream to use DB or retry later
          throw new Error(`Free plan: unable to fetch last close for ${ticker}`);
        }
        // If we reached here without returning, no valid close found
        throw new Error(`Free plan: no daily candles for ${ticker}`);
      }

      // Use the correct Alpaca API endpoint for latest quotes
      const url = new URL('/v2/stocks/quotes/latest', this.dataUrl);
      url.searchParams.set('symbols', ticker);
      // Remove feed parameter to use default feed

      const response = await fetch(url.toString(), {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const quote = data.quotes?.[ticker];

      if (!quote) {
        throw new Error(`No quote data found for ${ticker}`);
      }

      this.lastRequestTime = Date.now() - startTime;
      this.requestCount++;
      this.clearError();

      // Use ask price, bid price, or last price (whichever is available)
      return quote.ap || quote.bp || quote.lp || 0;

    } catch (error) {
      this.setError(error);
      throw new Error(`Failed to get current price from Alpaca: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a ticker is tradeable on Alpaca
   */
  async isTickerTradeable(ticker: Ticker): Promise<boolean> {
    try {
      const url = new URL(`/v2/stocks/${ticker}`, this.baseUrl);

      const response = await fetch(url.toString(), {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey,
        },
      });

      this.clearError();
      return response.ok;

    } catch (error) {
      this.setError(error);
      return false;
    }
  }

  /**
   * Convert our timeframe to Alpaca's format
   */
  private convertTimeframe(timeframe: Timeframe): string {
    switch (timeframe) {
      case '1D':
        return '1Day';
      case '1W':
        return '1Week';
      default:
        throw new Error(`Unsupported timeframe: ${timeframe}`);
    }
  }

  /**
   * Calculate start date based on timeframe and limit
   * Use historical data that's old enough for free tier access
   */
  private calculateStartDate(timeframe: Timeframe): Date {
    // Use data from 1 year ago to ensure it's historical enough for free tier
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    
    switch (timeframe) {
      case '1D':
        // For daily candles, use 1 year ago as start date
        return oneYearAgo;
      case '1W':
        // For weekly candles, use 1 year ago as start date
        return oneYearAgo;
      default:
        throw new Error(`Unsupported timeframe: ${timeframe}`);
    }
  }

  /**
   * Set error state
   */
  private setError(error: unknown): void {
    this.lastError = error instanceof Error ? error.message : 'Unknown error';
    this.lastErrorTime = new Date().toISOString();
  }

  /**
   * Clear error state
   */
  private clearError(): void {
    this.lastError = undefined;
    this.lastErrorTime = undefined;
  }
}

/**
 * Create an Alpaca vendor instance
 */
export function createAlpacaVendor(config: AlpacaConfig): AlpacaVendor {
  return new AlpacaVendor(config);
}
