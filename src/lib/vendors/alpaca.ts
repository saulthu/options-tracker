// Alpaca Markets API Integration
// Provides real-time and historical market data for stocks and options

import { Ticker, Timeframe, Candle, OptionKey, OptionsEntry, VendorCandleData } from '@/types/market-data';

export interface AlpacaConfig {
  apiKey: string;
  secretKey: string;
  baseUrl?: string; // Default: https://paper-api.alpaca.markets for paper trading
  dataUrl?: string; // Default: https://data.alpaca.markets
}

export class AlpacaVendor {
  private apiKey: string;
  private secretKey: string;
  private dataUrl: string;

  constructor(config: AlpacaConfig) {
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
    this.dataUrl = config.dataUrl || 'https://data.alpaca.markets';
  }

  /**
   * Fetch historical candles from Alpaca
   */
  async fetchCandles(ticker: Ticker, timeframe: Timeframe, limit: number = 200): Promise<VendorCandleData> {
    try {
      // Convert our timeframe to Alpaca's format
      const alpacaTimeframe = this.convertTimeframe(timeframe);
      
      // Calculate start date based on timeframe and limit
      const endDate = new Date();
      const startDate = this.calculateStartDate(timeframe, limit);

      // Build URL for Alpaca API
      const url = new URL(`/v2/stocks/${ticker}/bars`, this.dataUrl);
      url.searchParams.set('symbols', ticker);
      url.searchParams.set('start', startDate.toISOString());
      url.searchParams.set('end', endDate.toISOString());
      url.searchParams.set('timeframe', alpacaTimeframe);
      url.searchParams.set('limit', limit.toString());
      url.searchParams.set('feed', 'iex'); // Use IEX feed (free tier)

      // Make HTTP request to Alpaca API
      const response = await fetch(url.toString(), {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const bars = data.bars?.[ticker] || [];

      // Convert Alpaca bars to our Candle format
      const candles: Candle[] = bars.map((bar: { t: string; o: number; h: number; l: number; c: number; v: number }) => ({
        t: bar.t, // ISO timestamp
        o: bar.o, // Open
        h: bar.h, // High
        l: bar.l, // Low
        c: bar.c, // Close
        v: bar.v  // Volume
      }));

      return {
        symbol: ticker,
        timeframe,
        candles: candles.slice(-limit) // Ensure we don't exceed limit
      };

    } catch (error) {
      console.error(`Alpaca API error fetching candles for ${ticker}:`, error);
      throw new Error(`Failed to fetch candles from Alpaca: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch options data from Alpaca
   * Note: Alpaca's options data is limited on free tier
   */
  async fetchOption(ticker: Ticker, key: OptionKey): Promise<OptionsEntry> {
    try {
      // Alpaca's options data is limited, so we'll return a basic structure
      // In production, you might need to use a different vendor for comprehensive options data
      console.warn(`Alpaca options data is limited. Consider using a specialized options data provider for ${ticker} ${key.expiry}@${key.strike}`);
      
      // For now, return a placeholder with current timestamp
      return {
        asOf: new Date().toISOString(),
        expiry: key.expiry,
        strike: key.strike,
        spot: 0, // Would need to fetch current stock price
        call: undefined, // Not available on free tier
        put: undefined   // Not available on free tier
      };

    } catch (error) {
      console.error(`Alpaca API error fetching option for ${ticker} ${key.expiry}@${key.strike}:`, error);
      throw new Error(`Failed to fetch option from Alpaca: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current stock price (for options spot price)
   */
  async getCurrentPrice(ticker: Ticker): Promise<number> {
    try {
      const url = new URL(`/v2/stocks/${ticker}/bars/latest`, this.dataUrl);
      url.searchParams.set('symbols', ticker);
      url.searchParams.set('feed', 'iex');

      const response = await fetch(url.toString(), {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const latestBar = data.bars?.[ticker]?.[0];
      return latestBar?.c || 0; // Return close price

    } catch (error) {
      console.error(`Alpaca API error fetching current price for ${ticker}:`, error);
      return 0;
    }
  }

  /**
   * Check if ticker is tradeable on Alpaca
   */
  async isTickerTradeable(ticker: Ticker): Promise<boolean> {
    try {
      const url = new URL(`/v2/assets/${ticker}`, this.dataUrl);
      
      const response = await fetch(url.toString(), {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey,
        },
      });

      if (!response.ok) {
        return false;
      }

      const asset = await response.json();
      return asset?.tradable === true;
    } catch (error) {
      console.error(`Alpaca API error checking if ${ticker} is tradeable:`, error);
      return false;
    }
  }

  /**
   * Convert our timeframe format to Alpaca's format
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
   * Calculate start date based on timeframe and desired number of candles
   */
  private calculateStartDate(timeframe: Timeframe, limit: number): Date {
    const now = new Date();
    
    switch (timeframe) {
      case '1D':
        // For daily candles, go back by the number of days (with some buffer for weekends)
        const daysBack = Math.ceil(limit * 1.4); // 40% buffer for weekends
        return new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
      
      case '1W':
        // For weekly candles, go back by the number of weeks
        const weeksBack = Math.ceil(limit * 1.1); // 10% buffer
        return new Date(now.getTime() - (weeksBack * 7 * 24 * 60 * 60 * 1000));
      
      default:
        throw new Error(`Unsupported timeframe: ${timeframe}`);
    }
  }
}

// Factory function to create Alpaca vendor instance
export function createAlpacaVendor(config: AlpacaConfig): AlpacaVendor {
  return new AlpacaVendor(config);
}
