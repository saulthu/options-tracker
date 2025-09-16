// Market Data Module
// Implements caching, persistence, and vendor API integration for market data
// Based on market_data_plan.md specification

import { supabase } from './supabase';
import {
  Ticker,
  Timeframe,
  Candle,
  OptionKey,
  OptionsEntry,
  MarketDataBlob,
  MarketDataConfig,
  IndicatorParams,
  IndicatorType,
  CandleCache,
  OptionsCache,
  MarketDataError,
  VendorCandleData
} from '@/types/market-data';

export class MarketData {
  private candleCache: CandleCache = {};
  private optionsCache: OptionsCache = {};
  private writeQueue: Set<string> = new Set(); // Track queued writes by ticker
  private config: Required<MarketDataConfig>;

  constructor(config: MarketDataConfig = {}) {
    this.config = {
      optionsRetentionDays: config.optionsRetentionDays ?? 7,
      candleFreshnessMinutes: config.candleFreshnessMinutes ?? {
        '1D': { marketHours: 1, afterHours: 30 },
        '1W': { marketHours: 24 * 60, afterHours: 24 * 60 }
      },
      optionsFreshnessMinutes: config.optionsFreshnessMinutes ?? {
        marketHours: 5,
        afterHours: 60
      }
    };
  }

  // Public API Methods

  /**
   * Get candles for a ticker and timeframe
   * Returns ≤200 candles; memory → DB → vendor
   */
  async getCandles(
    ticker: Ticker,
    timeframe: Timeframe,
    opts: { forceRefresh?: boolean } = {}
  ): Promise<Candle[]> {
    const { forceRefresh = false } = opts;

    // Check memory cache first
    if (!forceRefresh && this.candleCache[ticker]?.[timeframe]) {
      const cached = this.candleCache[ticker][timeframe];
      if (this.isCandleDataFresh(cached.lastUpdated, timeframe)) {
        return cached.data;
      }
    }

    // Try to load from database
    if (!forceRefresh) {
      const dbData = await this.loadCandlesFromDB(ticker, timeframe);
      if (dbData && this.isCandleDataFresh(dbData.lastUpdated, timeframe)) {
        this.updateCandleCache(ticker, timeframe, dbData.data, dbData.lastUpdated);
        return dbData.data;
      }
    }

    // Fetch from vendor API
    const vendorData = await this.fetchCandlesFromVendor(ticker, timeframe);
    // Trim to ≤200 candles before caching and returning
    const trimmedCandles = vendorData.candles.slice(-200);
    this.updateCandleCache(ticker, timeframe, trimmedCandles, new Date().toISOString());
    this.queueWrite(ticker);

    return trimmedCandles;
  }

  /**
   * Get technical indicator values
   * Computes from getCandles data
   */
  async getIndicator(
    ticker: Ticker,
    indicator: IndicatorType,
    params: IndicatorParams,
    timeframe: Timeframe
  ): Promise<number[]> {
    const candles = await this.getCandles(ticker, timeframe);
    return this.calculateIndicator(candles, indicator, params);
  }

  /**
   * Get option data for specific expiry/strike
   * Returns the latest value per key
   */
  async getOption(
    ticker: Ticker,
    key: OptionKey,
    opts: { forceRefresh?: boolean } = {}
  ): Promise<OptionsEntry> {
    const { forceRefresh = false } = opts;
    const cacheKey = `${key.expiry}@${key.strike}`;

    // Check memory cache first
    if (!forceRefresh && this.optionsCache[ticker]?.has(cacheKey)) {
      const cached = this.optionsCache[ticker].get(cacheKey)!;
      if (this.isOptionsDataFresh(cached.asOf)) {
        return cached;
      }
    }

    // Try to load from database
    if (!forceRefresh) {
      const dbData = await this.loadOptionsFromDB(ticker, key);
      if (dbData && this.isOptionsDataFresh(dbData.asOf)) {
        this.updateOptionsCache(ticker, key, dbData);
        return dbData;
      }
    }

    // Fetch from vendor API
    const vendorData = await this.fetchOptionsFromVendor(ticker, key);
    this.updateOptionsCache(ticker, key, vendorData);
    this.queueWrite(ticker);

    return vendorData;
  }

  /**
   * List all cached option keys for a ticker
   * Returns keys after pruning expired entries
   */
  async listOptionKeys(ticker: Ticker): Promise<OptionKey[]> {
    // Ensure we have data loaded
    if (!this.optionsCache[ticker]) {
      await this.loadOptionsFromDB(ticker);
    }

    const keys: OptionKey[] = [];
    const now = new Date();
    const retentionDate = new Date(now.getTime() - this.config.optionsRetentionDays * 24 * 60 * 60 * 1000);

    for (const [cacheKey, entry] of this.optionsCache[ticker] || new Map()) {
      const expiryDate = new Date(entry.expiry);
      if (expiryDate > retentionDate) {
        const [expiry, strike] = cacheKey.split('@');
        keys.push({ expiry, strike: parseFloat(strike) });
      }
    }

    return keys;
  }

  /**
   * Prime memory cache from database for initial page load
   */
  async primeFromDB(tickers: Ticker[]): Promise<void> {
    const promises = tickers.map(async (ticker) => {
      try {
        const { data, error } = await supabase
          .from('tickers')
          .select('market_data')
          .eq('name', ticker)
          .single();

        if (error || !data?.market_data) return;

        const blob: MarketDataBlob = data.market_data;
        this.hydrateFromBlob(ticker, blob);
      } catch (error) {
        console.warn(`Failed to prime market data for ${ticker}:`, error);
      }
    });

    await Promise.all(promises);
  }

  // Private Helper Methods

  private isCandleDataFresh(lastUpdated: string, timeframe: Timeframe): boolean {
    const now = new Date();
    const updated = new Date(lastUpdated);
    const diffMinutes = (now.getTime() - updated.getTime()) / (1000 * 60);

    const freshness = this.config.candleFreshnessMinutes[timeframe];
    const isMarketHours = this.isMarketHours(now);
    const maxAge = isMarketHours ? freshness.marketHours : freshness.afterHours;

    return diffMinutes <= maxAge;
  }

  private isOptionsDataFresh(lastUpdated: string): boolean {
    const now = new Date();
    const updated = new Date(lastUpdated);
    const diffMinutes = (now.getTime() - updated.getTime()) / (1000 * 60);

    const isMarketHours = this.isMarketHours(now);
    const maxAge = isMarketHours 
      ? this.config.optionsFreshnessMinutes.marketHours 
      : this.config.optionsFreshnessMinutes.afterHours;

    return diffMinutes <= maxAge;
  }

  private isMarketHours(date: Date): boolean {
    // Simple market hours check (9:30 AM - 4:00 PM ET, Monday-Friday)
    // This is a simplified implementation - in production you'd want more sophisticated logic
    
    // Convert to ET (UTC-5 or UTC-4 depending on DST)
    // For simplicity, we'll use UTC-5 (EST) - in production you'd want proper timezone handling
    const etDate = new Date(date.getTime() - 5 * 60 * 60 * 1000);
    
    const day = etDate.getUTCDay();
    const hour = etDate.getUTCHours();
    const minute = etDate.getUTCMinutes();
    const time = hour * 60 + minute;

    if (day === 0 || day === 6) return false; // Weekend
    if (time < 9 * 60 + 30) return false; // Before 9:30 AM ET
    if (time >= 16 * 60) return false; // After 4:00 PM ET

    return true;
  }

  private updateCandleCache(ticker: Ticker, timeframe: Timeframe, data: Candle[], lastUpdated: string): void {
    if (!this.candleCache[ticker]) {
      this.candleCache[ticker] = { '1D': { data: [], lastUpdated: '' }, '1W': { data: [], lastUpdated: '' } };
    }
    
    // Trim to ≤200 candles before caching
    const trimmedData = data.slice(-200);
    this.candleCache[ticker][timeframe] = {
      data: trimmedData,
      lastUpdated
    };
  }

  private updateOptionsCache(ticker: Ticker, key: OptionKey, entry: OptionsEntry): void {
    if (!this.optionsCache[ticker]) {
      this.optionsCache[ticker] = new Map();
    }
    
    const cacheKey = `${key.expiry}@${key.strike}`;
    this.optionsCache[ticker].set(cacheKey, entry);
  }

  private queueWrite(ticker: Ticker): void {
    if (this.writeQueue.has(ticker)) return; // Already queued

    this.writeQueue.add(ticker);
    
    // Debounce writes - wait a bit for more changes before persisting
    setTimeout(() => {
      this.persistToDB(ticker);
      this.writeQueue.delete(ticker);
    }, 1000);
  }

  private async persistToDB(ticker: Ticker): Promise<void> {
    try {
      const blob = this.serializeToBlob(ticker);
      
      const { error } = await supabase
        .from('tickers')
        .update({ 
          market_data: blob,
          updated_at: new Date().toISOString()
        })
        .eq('name', ticker);

      if (error) {
        console.error(`Failed to persist market data for ${ticker}:`, error);
      }
    } catch (error) {
      console.error(`Error persisting market data for ${ticker}:`, error);
    }
  }

  private serializeToBlob(ticker: Ticker): MarketDataBlob {
    const now = new Date().toISOString();
    
    // Serialize candles
    const candles: MarketDataBlob['candles'] = {
      '1D': {
        series: this.candleCache[ticker]?.['1D']?.data || [],
        lastUpdated: this.candleCache[ticker]?.['1D']?.lastUpdated || now
      },
      '1W': {
        series: this.candleCache[ticker]?.['1W']?.data || [],
        lastUpdated: this.candleCache[ticker]?.['1W']?.lastUpdated || now
      }
    };

    // Serialize options with pruning
    const options: MarketDataBlob['options'] = {
      lastUpdated: now,
      entries: {}
    };

    if (this.optionsCache[ticker]) {
      const now = new Date();
      const retentionDate = new Date(now.getTime() - this.config.optionsRetentionDays * 24 * 60 * 60 * 1000);

      for (const [cacheKey, entry] of this.optionsCache[ticker]) {
        const expiryDate = new Date(entry.expiry);
        if (expiryDate > retentionDate) {
          options.entries[cacheKey] = entry;
        }
      }
    }

    return {
      schemaVersion: 1,
      asOf: now,
      candles,
      options
    };
  }

  private hydrateFromBlob(ticker: Ticker, blob: MarketDataBlob): void {
    // Hydrate candle cache
    if (blob.candles) {
      this.candleCache[ticker] = {
        '1D': {
          data: blob.candles['1D']?.series || [],
          lastUpdated: blob.candles['1D']?.lastUpdated || ''
        },
        '1W': {
          data: blob.candles['1W']?.series || [],
          lastUpdated: blob.candles['1W']?.lastUpdated || ''
        }
      };
    }

    // Hydrate options cache
    if (blob.options?.entries) {
      this.optionsCache[ticker] = new Map();
      for (const [cacheKey, entry] of Object.entries(blob.options.entries)) {
        this.optionsCache[ticker].set(cacheKey, entry);
      }
    }
  }

  private async loadCandlesFromDB(ticker: Ticker, timeframe: Timeframe): Promise<{ data: Candle[]; lastUpdated: string } | null> {
    try {
      const { data, error } = await supabase
        .from('tickers')
        .select('market_data')
        .eq('name', ticker)
        .single();

      if (error || !data?.market_data?.candles?.[timeframe]) return null;

      const series = data.market_data.candles[timeframe];
      return {
        data: series.series || [],
        lastUpdated: series.lastUpdated || ''
      };
    } catch (error) {
      console.warn(`Failed to load candles from DB for ${ticker}:`, error);
      return null;
    }
  }

  private async loadOptionsFromDB(ticker: Ticker, key?: OptionKey): Promise<OptionsEntry | null> {
    try {
      const { data, error } = await supabase
        .from('tickers')
        .select('market_data')
        .eq('name', ticker)
        .single();

      if (error || !data?.market_data?.options?.entries) return null;

      if (key) {
        const cacheKey = `${key.expiry}@${key.strike}`;
        return data.market_data.options.entries[cacheKey] || null;
      } else {
        // Load all options for the ticker
        this.optionsCache[ticker] = new Map();
        for (const [cacheKey, entry] of Object.entries(data.market_data.options.entries)) {
          this.optionsCache[ticker].set(cacheKey, entry as OptionsEntry);
        }
        return null;
      }
    } catch (error) {
      console.warn(`Failed to load options from DB for ${ticker}:`, error);
      return null;
    }
  }

  private async fetchCandlesFromVendor(ticker: Ticker, timeframe: Timeframe): Promise<VendorCandleData> {
    // Placeholder implementation - in production this would call a real vendor API
    // For now, return empty data to avoid errors
    console.warn(`Vendor API not implemented for candles: ${ticker} ${timeframe}`);
    return {
      symbol: ticker,
      timeframe,
      candles: []
    };
  }

  private async fetchOptionsFromVendor(ticker: Ticker, key: OptionKey): Promise<OptionsEntry> {
    // Placeholder implementation - in production this would call a real vendor API
    // For now, return empty data to avoid errors
    console.warn(`Vendor API not implemented for options: ${ticker} ${key.expiry}@${key.strike}`);
    return {
      asOf: new Date().toISOString(),
      expiry: key.expiry,
      strike: key.strike,
      spot: 0
    };
  }

  private calculateIndicator(candles: Candle[], indicator: IndicatorType, params: IndicatorParams): number[] {
    const { window } = params;
    const prices = candles.map(c => c.c);
    
    if (prices.length < window) {
      return new Array(prices.length).fill(NaN);
    }

    switch (indicator) {
      case 'SMA':
        return this.calculateSMA(prices, window);
      case 'EMA':
        return this.calculateEMA(prices, window);
      default:
        throw new MarketDataError(`Unknown indicator: ${indicator}`);
    }
  }

  private calculateSMA(prices: number[], window: number): number[] {
    const result: number[] = new Array(prices.length).fill(NaN);
    
    for (let i = window - 1; i < prices.length; i++) {
      const sum = prices.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
      result[i] = sum / window;
    }
    
    return result;
  }

  private calculateEMA(prices: number[], window: number): number[] {
    const result: number[] = new Array(prices.length).fill(NaN);
    const multiplier = 2 / (window + 1);
    
    // Start with SMA for the first value
    const sum = prices.slice(0, window).reduce((a, b) => a + b, 0);
    result[window - 1] = sum / window;
    
    // Calculate EMA for remaining values
    for (let i = window; i < prices.length; i++) {
      result[i] = (prices[i] * multiplier) + (result[i - 1] * (1 - multiplier));
    }
    
    return result;
  }
}

// Export singleton instance
export const marketData = new MarketData();
