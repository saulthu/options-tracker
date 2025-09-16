// Client-side Alpaca service
// Makes requests to our server-side API route to avoid exposing API keys

import { Ticker, Timeframe, OptionKey, OptionsEntry, VendorCandleData } from '@/types/market-data';

export interface AlpacaClientConfig {
  baseUrl?: string; // Default: current origin
}

export class AlpacaClient {
  private baseUrl: string;

  constructor(config: AlpacaClientConfig = {}) {
    this.baseUrl = config.baseUrl || '';
  }

  /**
   * Fetch historical candles from our API route
   */
  async fetchCandles(ticker: Ticker, timeframe: Timeframe): Promise<VendorCandleData> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/market-data?type=candles&ticker=${encodeURIComponent(ticker)}&timeframe=${timeframe}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error(`Failed to fetch candles for ${ticker} ${timeframe}:`, error);
      throw new Error(`Failed to fetch candles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch options data from our API route
   */
  async fetchOption(ticker: Ticker, key: OptionKey): Promise<OptionsEntry> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/market-data?type=option&ticker=${encodeURIComponent(ticker)}&expiry=${key.expiry}&strike=${key.strike}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error(`Failed to fetch option for ${ticker} ${key.expiry}@${key.strike}:`, error);
      throw new Error(`Failed to fetch option: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current stock price from our API route
   */
  async getCurrentPrice(ticker: Ticker): Promise<number> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/market-data?type=price&ticker=${encodeURIComponent(ticker)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.price || 0;

    } catch (error) {
      console.error(`Failed to fetch current price for ${ticker}:`, error);
      return 0;
    }
  }

  /**
   * Check if ticker is tradeable from our API route
   */
  async isTickerTradeable(ticker: Ticker): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/market-data?type=tradeable&ticker=${encodeURIComponent(ticker)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.tradeable || false;

    } catch (error) {
      console.error(`Failed to check if ${ticker} is tradeable:`, error);
      return false;
    }
  }
}

// Factory function to create Alpaca client instance
export function createAlpacaClient(config: AlpacaClientConfig = {}): AlpacaClient {
  return new AlpacaClient(config);
}
