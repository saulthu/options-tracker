// Market Data Module
// Implements caching, persistence, and vendor API integration for market data
// Based on market_data_plan.md specification

import { supabase } from './supabase';
import { MarketDataVendor } from './vendors/base/MarketDataVendor';
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
  CurrentPriceCache,
  CurrentPrice,
  CandleDataWithSource,
  CurrentPriceWithSource,
  MarketDataError,
  VendorCandleData,
  StaleCandleData
} from '@/types/market-data';

export class MarketData {
  private candleCache: CandleCache = {};
  private optionsCache: OptionsCache = {};
  private currentPriceCache: CurrentPriceCache = {};
  private writeQueue: Set<string> = new Set(); // Track queued writes by ticker
  private refreshQueue: Set<string> = new Set(); // Track background refreshes by ticker
  private primedTickers: Set<string> = new Set(); // Track which tickers have been hydrated from DB at least once
  private config: Required<MarketDataConfig>;
  private vendors: MarketDataVendor[] = [];
  private preferredVendor?: string;
  private errorLogger?: (message: string, type: 'info' | 'warning' | 'error') => void;

  constructor(config: MarketDataConfig = {}, errorLogger?: (message: string, type: 'info' | 'warning' | 'error') => void) {
    this.config = {
      optionsRetentionDays: config.optionsRetentionDays ?? 7,
      candleFreshnessMinutes: config.candleFreshnessMinutes ?? {
        '1D': { marketHours: 1, afterHours: 30 },
        '1W': { marketHours: 24 * 60, afterHours: 24 * 60 }
      },
      optionsFreshnessMinutes: config.optionsFreshnessMinutes ?? {
        marketHours: 5,
        afterHours: 60
      },
      currentPriceFreshnessMinutes: config.currentPriceFreshnessMinutes ?? {
        marketHours: 1,
        afterHours: 30
      },
      returnStaleMarkers: config.returnStaleMarkers ?? false
    };
    this.errorLogger = errorLogger;
  }

  /**
   * Log debug information to the error logger if available
   */
  private log(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    if (this.errorLogger) {
      this.errorLogger(message, type);
    }
    // No-op when no logger is set to avoid affecting timing/behavior
  }

  /**
   * Set error logger for debug output
   */
  setErrorLogger(errorLogger: (message: string, type: 'info' | 'warning' | 'error') => void): void {
    this.errorLogger = errorLogger;
  }

  /**
   * Set vendors for market data fetching
   */
  setVendors(vendors: MarketDataVendor[], preferredVendor?: string): void {
    this.vendors = vendors;
    this.preferredVendor = preferredVendor;
  }

  /**
   * Get the best available vendor for a request
   */
  private getVendor(): MarketDataVendor | null {
    if (this.vendors.length === 0) {
      return null;
    }

    // If preferred vendor is specified, try to use it
    if (this.preferredVendor) {
      const preferred = this.vendors.find(v => v.name === this.preferredVendor);
      if (preferred && preferred.isHealthy()) {
        return preferred;
      }
    }

    // Find the first healthy vendor
    for (const vendor of this.vendors) {
      if (vendor.isHealthy()) {
        return vendor;
      }
    }

    // If no healthy vendors, return the first one (will handle errors gracefully)
    return this.vendors[0] || null;
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
  ): Promise<Candle[] | StaleCandleData> {
    const { forceRefresh = false } = opts;

    // Ensure DB blob has been loaded at least once for this ticker
    await this.ensurePrimed(ticker);

    // Check memory cache first
    if (!forceRefresh && this.candleCache[ticker]?.[timeframe]) {
      const cached = this.candleCache[ticker][timeframe];
      if (cached.data.length > 0 && this.isCandleDataFresh(cached.lastUpdated, timeframe)) {
        return cached.data;
      } else if (cached.data.length > 0) {
        // Data is stale, serve cached immediately and trigger background refresh
        this.triggerBackgroundRefresh(ticker, timeframe);
        
        if (this.config.returnStaleMarkers) {
          return {
            type: 'stale' as const,
            data: cached.data,
            lastUpdated: cached.lastUpdated,
            staleReason: 'Data is stale, background refresh triggered'
          };
        }
        
        return cached.data;
      } else {
        // Empty cached data should not be used; proceed to DB/vendor
      }
    }

    // Try to load from database
    if (!forceRefresh) {
      this.log(`[DEBUG] Checking database for ${ticker} ${timeframe}`);
      const dbData = await this.loadCandlesFromDB(ticker, timeframe);
      if (dbData && dbData.data.length > 0) {
        if (this.isCandleDataFresh(dbData.lastUpdated, timeframe)) {
          this.log(`[DEBUG] Database cache is fresh, returning ${dbData.data.length} candles`, 'info');
          this.updateCandleCache(ticker, timeframe, dbData.data, dbData.lastUpdated);
          return dbData.data;
        } else {
          this.log(`[DEBUG] Database cache is stale for ${ticker} ${timeframe}, serving stale and refreshing in background`, 'info');
          // Serve stale DB data and kick off background refresh
          this.updateCandleCache(ticker, timeframe, dbData.data, dbData.lastUpdated);
          this.triggerBackgroundRefresh(ticker, timeframe);
          if (this.config.returnStaleMarkers) {
            return {
              type: 'stale' as const,
              data: dbData.data,
              lastUpdated: dbData.lastUpdated,
              staleReason: 'DB data is stale, background refresh triggered'
            };
          }
          return dbData.data;
        }
      }
      this.log(`[DEBUG] Database cache not available for ${ticker} ${timeframe}`, 'info');
    }

    // Fetch from vendor API
    let vendorData = await this.fetchCandlesFromVendor(ticker, timeframe);
    let trimmedCandles = vendorData.candles.slice(-200);

    // If we received zero candles and this wasn't a force refresh, retry once
    if (!forceRefresh && trimmedCandles.length === 0) {
      this.log(`[DEBUG] Vendor returned 0 candles for ${ticker} ${timeframe}. Retrying once...`, 'warning');
      vendorData = await this.fetchCandlesFromVendor(ticker, timeframe);
      trimmedCandles = vendorData.candles.slice(-200);
    }

    // Avoid caching/persisting empty results
    if (trimmedCandles.length === 0) {
      this.log(`[DEBUG] Still 0 candles for ${ticker} ${timeframe} after retry. Returning empty without caching.`, 'warning');
      return trimmedCandles;
    }

    this.updateCandleCache(ticker, timeframe, trimmedCandles, new Date().toISOString());
    this.queueWrite(ticker);

    return trimmedCandles;
  }

  /**
   * Get candles with data source information
   * Returns data along with source tracking for debugging
   */
  async getCandlesWithSource(
    ticker: Ticker,
    timeframe: Timeframe,
    opts: { forceRefresh?: boolean } = {}
  ): Promise<CandleDataWithSource> {
    const { forceRefresh = false } = opts;
    const timestamp = new Date().toISOString();

    console.log(`[DEBUG] getCandlesWithSource called for ${ticker} ${timeframe}, forceRefresh: ${forceRefresh}`);

    // Ensure DB blob has been loaded at least once for this ticker
    await this.ensurePrimed(ticker);

    // Check memory cache first
    if (!forceRefresh && this.candleCache[ticker]?.[timeframe]) {
      const cached = this.candleCache[ticker][timeframe];
      console.log(`[DEBUG] Found memory cache for ${ticker} ${timeframe}, fresh: ${this.isCandleDataFresh(cached.lastUpdated, timeframe)}`);
      if (this.isCandleDataFresh(cached.lastUpdated, timeframe)) {
        return {
          data: cached.data,
          source: {
            source: 'memory',
            timestamp: cached.lastUpdated,
            cached: true
          }
        };
      }
    }

    // Try to load from database
    if (!forceRefresh) {
      console.log(`[DEBUG] Checking database for ${ticker} ${timeframe}`);
      const dbData = await this.loadCandlesFromDB(ticker, timeframe);
      console.log(`[DEBUG] Database data for ${ticker} ${timeframe}:`, dbData ? `found ${dbData.data.length} candles` : 'null');
      if (dbData && this.isCandleDataFresh(dbData.lastUpdated, timeframe)) {
        console.log(`[DEBUG] Using database data for ${ticker} ${timeframe}`);
        this.updateCandleCache(ticker, timeframe, dbData.data, dbData.lastUpdated);
        return {
          data: dbData.data,
          source: {
            source: 'database',
            timestamp: dbData.lastUpdated,
            cached: true
          }
        };
      }
    }

    // Fetch from vendor API
    console.log(`[DEBUG] Fetching from vendor API for ${ticker} ${timeframe}`);
    const vendorData = await this.fetchCandlesFromVendor(ticker, timeframe);
    console.log(`[DEBUG] Vendor returned ${vendorData.candles.length} candles for ${ticker} ${timeframe}`);
    // Trim to ≤200 candles before caching and returning
    const trimmedCandles = vendorData.candles.slice(-200);
    this.updateCandleCache(ticker, timeframe, trimmedCandles, timestamp);
    this.queueWrite(ticker);

    return {
      data: trimmedCandles,
      source: {
        source: 'vendor',
        timestamp,
        cached: false
      }
    };
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
    const result = await this.getCandles(ticker, timeframe);
    const candles = Array.isArray(result) ? result : result.data;
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

    // Ensure DB blob has been loaded at least once for this ticker
    await this.ensurePrimed(ticker);

    // Check memory cache first
    if (!forceRefresh && this.optionsCache[ticker]?.has(cacheKey)) {
      const cached = this.optionsCache[ticker].get(cacheKey)!;
      if (this.isOptionsDataFresh(cached.asOf)) {
        return cached;
      } else {
        // Data is stale, serve cached immediately and trigger background refresh
        this.triggerBackgroundRefresh(ticker, '1D'); // Use 1D as default for options refresh
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
    // Ensure DB blob has been loaded at least once for this ticker
    await this.ensurePrimed(ticker);

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
   * Get current price for a ticker
   */
  async getCurrentPrice(ticker: Ticker): Promise<number> {
    // Ensure DB blob has been loaded at least once for this ticker
    await this.ensurePrimed(ticker);
    // Check cache first
    const cached = this.currentPriceCache[ticker];
    if (cached && this.isCurrentPriceFresh(cached)) {
      return cached.price;
    }

    // If stale but available, serve stale data and refresh in background
    if (cached) {
      this.triggerBackgroundRefresh(ticker, 'currentPrice');
      return cached.price;
    }

    // Try to load current price from database if not in memory yet
    const dbPrice = await this.loadCurrentPriceFromDB(ticker);
    if (dbPrice) {
      // Cache DB value
      this.currentPriceCache[ticker] = dbPrice;
      // If stale, serve and refresh in background; if fresh, just serve
      if (!this.isCurrentPriceFresh(dbPrice)) {
        this.triggerBackgroundRefresh(ticker, 'currentPrice');
      }
      return dbPrice.price;
    }

    // No cache, fetch from vendor
    const vendor = this.getVendor();
    if (!vendor) {
      throw new Error('No vendors available. Please call setVendors() first.');
    }

    try {
      const price = await vendor.getCurrentPrice(ticker);
      
      // Cache the result
      this.currentPriceCache[ticker] = {
        price,
        lastUpdated: new Date().toISOString(),
        source: 'last' // We don't know the source from the vendor interface
      };

      // Queue write to database
      this.queueWrite(ticker);

      return price;
    } catch (error) {
      console.error(`Failed to fetch current price for ${ticker}:`, error);
      throw error;
    }
  }

  /**
   * Clear all caches for a specific ticker
   * Removes data from memory cache and database
   */
  async clearCache(ticker: Ticker): Promise<void> {
    // Clear memory cache
    if (this.candleCache[ticker]) {
      delete this.candleCache[ticker];
    }
    if (this.optionsCache[ticker]) {
      delete this.optionsCache[ticker];
    }
    if (this.currentPriceCache[ticker]) {
      delete this.currentPriceCache[ticker];
    }

    // Clear database cache
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.warn(`Authentication error when clearing cache for ${ticker}:`, authError);
        return;
      }

      const { error } = await supabase
        .from('tickers')
        .update({ 
          market_data: null,
          updated_at: new Date().toISOString()
        })
        .eq('name', ticker)
        .eq('user_id', user.id);

      if (error) {
        console.warn(`Failed to clear database cache for ${ticker}:`, error);
      } else {
        console.log(`Successfully cleared database cache for ${ticker}`);
      }
    } catch (error) {
      console.warn(`Error clearing database cache for ${ticker}:`, error);
    }
  }

  /**
   * Get current price with data source information
   * Returns price along with source tracking for debugging
   */
  async getCurrentPriceWithSource(ticker: Ticker): Promise<CurrentPriceWithSource> {
    const timestamp = new Date().toISOString();

    // Ensure DB blob has been loaded at least once for this ticker
    await this.ensurePrimed(ticker);

    // Check cache first
    const cached = this.currentPriceCache[ticker];
    if (cached && this.isCurrentPriceFresh(cached)) {
      return {
        data: cached.price,
        source: {
          source: 'memory',
          timestamp: cached.lastUpdated,
          cached: true
        }
      };
    }

    // If stale but available, serve stale data and refresh in background
    if (cached) {
      this.triggerBackgroundRefresh(ticker, 'currentPrice');
      return {
        data: cached.price,
        source: {
          source: 'memory',
          timestamp: cached.lastUpdated,
          cached: true
        }
      };
    }

    // Try to load from database if memory has nothing
    const dbPrice = await this.loadCurrentPriceFromDB(ticker);
    if (dbPrice) {
      this.currentPriceCache[ticker] = dbPrice;
      const fresh = this.isCurrentPriceFresh(dbPrice);
      if (!fresh) {
        this.triggerBackgroundRefresh(ticker, 'currentPrice');
      }
      return {
        data: dbPrice.price,
        source: {
          source: 'database',
          timestamp: dbPrice.lastUpdated,
          cached: true
        }
      };
    }

    // No cache, fetch from vendor
    const vendor = this.getVendor();
    if (!vendor) {
      throw new Error('No vendors available. Please call setVendors() first.');
    }

    try {
      const price = await vendor.getCurrentPrice(ticker);
      
      // Cache the result
      this.currentPriceCache[ticker] = {
        price,
        lastUpdated: timestamp,
        source: 'last' // We don't know the source from the vendor interface
      };

      // Queue write to database
      this.queueWrite(ticker);

      return {
        data: price,
        source: {
          source: 'vendor',
          timestamp,
          cached: false
        }
      };
    } catch (error) {
      console.error(`Failed to fetch current price for ${ticker}:`, error);
      throw error;
    }
  }

  /**
   * Prime memory cache from database for initial page load
   */
  async primeFromDB(tickers: Ticker[]): Promise<void> {
    const promises = tickers.map(async (ticker) => {
      try {
        const blob = await this.loadBlobFromDB(ticker);
        if (blob) {
          this.hydrateFromBlob(ticker, blob);
          this.primedTickers.add(ticker);
        }
      } catch (error) {
        console.warn(`Failed to prime market data for ${ticker}:`, error);
      }
    });

    await Promise.all(promises);
  }

  // Private Helper Methods

  private triggerBackgroundRefresh(ticker: Ticker, timeframe: Timeframe | 'currentPrice'): void {
    const refreshKey = `${ticker}:${timeframe}`;
    if (this.refreshQueue.has(refreshKey)) return; // Already refreshing

    this.refreshQueue.add(refreshKey);
    
    // Trigger background refresh
    setTimeout(async () => {
      try {
        if (timeframe === 'currentPrice') {
          await this.getCurrentPrice(ticker);
        } else {
          await this.getCandles(ticker, timeframe as Timeframe, { forceRefresh: true });
        }
      } catch (error) {
        console.warn(`Background refresh failed for ${ticker} ${timeframe}:`, error);
      } finally {
        this.refreshQueue.delete(refreshKey);
      }
    }, 100); // Small delay to avoid blocking
  }

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

  private isCurrentPriceFresh(currentPrice: CurrentPrice): boolean {
    const now = new Date();
    const updated = new Date(currentPrice.lastUpdated);
    const diffMinutes = (now.getTime() - updated.getTime()) / (1000 * 60);

    const isMarketHours = this.isMarketHours(now);
    const maxAge = isMarketHours 
      ? this.config.currentPriceFreshnessMinutes.marketHours 
      : this.config.currentPriceFreshnessMinutes.afterHours;

    return diffMinutes <= maxAge;
  }

  private isMarketHours(date: Date): boolean {
    // Market hours check (9:30 AM - 4:00 PM America/New_York, Monday-Friday)
    // Use IANA timezone so DST is handled correctly regardless of user local timezone
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
        if (p.type !== 'literal') acc[p.type] = p.value;
        return acc;
      }, {});

      const weekday = parts.weekday; // e.g., "Mon", "Tue"
      if (weekday === 'Sat' || weekday === 'Sun') return false;

      const hour = Number(parts.hour);
      const minute = Number(parts.minute);
      const minutesOfDay = hour * 60 + minute;

      if (minutesOfDay < (9 * 60 + 30)) return false; // before 9:30
      if (minutesOfDay >= (16 * 60)) return false; // at/after 16:00

      return true;
    } catch {
      // Fallback: if formatter/timezone unsupported, default to conservative false
      return false;
    }
  }

  private updateCandleCache(ticker: Ticker, timeframe: Timeframe, data: Candle[], lastUpdated: string): void {
    if (!this.candleCache[ticker]) {
      this.candleCache[ticker] = { '1D': { data: [], lastUpdated: '' }, '1W': { data: [], lastUpdated: '' } };
    }
    
    // Trim to ≤200 candles before caching
    const trimmedData = data.slice(-200);
    if (trimmedData.length === 0) {
      // Do not overwrite non-empty cache with empty data
      const existing = this.candleCache[ticker][timeframe];
      if (existing && existing.data.length > 0) {
        return;
      }
    }
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
      
      // Get current user for RLS
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error(`Authentication error when persisting market data for ${ticker}:`, authError);
        return;
      }
      
      const { error } = await supabase
        .from('tickers')
        .update({ 
          market_data: blob,
          updated_at: new Date().toISOString()
        })
        .eq('name', ticker)
        .eq('user_id', user.id);

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

    // Serialize current price
    const currentPrice = this.currentPriceCache[ticker];

    return {
      schemaVersion: 1,
      asOf: now,
      candles,
      options,
      currentPrice
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

    // Hydrate current price cache
    if (blob.currentPrice) {
      this.currentPriceCache[ticker] = blob.currentPrice;
    }
  }

  private async loadCandlesFromDB(ticker: Ticker, timeframe: Timeframe): Promise<{ data: Candle[]; lastUpdated: string } | null> {
    try {
      this.log(`[DEBUG] loadCandlesFromDB called for ${ticker} ${timeframe}`);
      
      // Get current user for RLS
      let { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        // Auth may not be ready immediately after page load; retry briefly once
        await new Promise(resolve => setTimeout(resolve, 200));
        ({ data: { user }, error: authError } = await supabase.auth.getUser());
      }
      if (authError || !user) {
        this.log(`Authentication not ready when loading candles for ${ticker} - skipping DB cache on this attempt`, 'warning');
        return null;
      }

      this.log(`[DEBUG] User authenticated, querying database for ${ticker} ${timeframe}`);

      const { data, error } = await supabase
        .from('tickers')
        .select('market_data')
        .eq('name', ticker)
        .eq('user_id', user.id)
        .single();

      this.log(`[DEBUG] Database query result for ${ticker}: error=${!!error}, hasData=${!!data}, hasMarketData=${!!data?.market_data}, hasCandles=${!!data?.market_data?.candles}, hasTimeframe=${!!data?.market_data?.candles?.[timeframe]}`);

      if (error || !data?.market_data?.candles?.[timeframe]) {
        this.log(`[DEBUG] No database data found for ${ticker} ${timeframe}`, 'info');
        return null;
      }

      const series = data.market_data.candles[timeframe];
      const result = {
        data: Array.isArray(series.series) ? series.series : [],
        lastUpdated: series.lastUpdated || ''
      };
      
      this.log(`[DEBUG] Database data loaded for ${ticker} ${timeframe}: ${result.data.length} candles, lastUpdated=${result.lastUpdated}`, 'info');
      if (result.data.length === 0) {
        this.log(`[DEBUG] Ignoring empty series from DB for ${ticker} ${timeframe}`, 'warning');
        return null;
      }
      
      return result;
    } catch (error) {
      this.log(`Failed to load candles from DB for ${ticker}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'warning');
      return null;
    }
  }

  private async loadOptionsFromDB(ticker: Ticker, key?: OptionKey): Promise<OptionsEntry | null> {
    try {
      // Get current user for RLS
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.warn(`Authentication error when loading options for ${ticker}:`, authError);
        return null;
      }

      const { data, error } = await supabase
        .from('tickers')
        .select('market_data')
        .eq('name', ticker)
        .eq('user_id', user.id)
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

  private async ensurePrimed(ticker: Ticker): Promise<void> {
    if (this.primedTickers.has(ticker)) return;
    const blob = await this.loadBlobFromDB(ticker);
    if (blob) {
      this.hydrateFromBlob(ticker, blob);
    }
    this.primedTickers.add(ticker);
  }

  private async loadBlobFromDB(ticker: Ticker): Promise<MarketDataBlob | null> {
    try {
      // Get current user for RLS
      let { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        // Small retry to avoid race on page load
        await new Promise(resolve => setTimeout(resolve, 200));
        ({ data: { user }, error: authError } = await supabase.auth.getUser());
      }
      if (authError || !user) {
        return null;
      }

      const { data, error } = await supabase
        .from('tickers')
        .select('market_data')
        .eq('name', ticker)
        .eq('user_id', user.id)
        .single();

      if (error || !data?.market_data) return null;
      return data.market_data as MarketDataBlob;
    } catch {
      return null;
    }
  }

  private async loadCurrentPriceFromDB(ticker: Ticker): Promise<CurrentPrice | null> {
    try {
      // Get current user for RLS
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return null;
      }

      const { data, error } = await supabase
        .from('tickers')
        .select('market_data')
        .eq('name', ticker)
        .eq('user_id', user.id)
        .single();

      if (error || !data?.market_data?.currentPrice) return null;

      const currentPrice = data.market_data.currentPrice as CurrentPrice;
      if (!currentPrice || typeof currentPrice.price !== 'number') return null;

      return currentPrice;
    } catch {
      return null;
    }
  }

  private async fetchCandlesFromVendor(ticker: Ticker, timeframe: Timeframe): Promise<VendorCandleData> {
    const vendor = this.getVendor();
    if (!vendor) {
      console.warn(`No vendors available. Please call setVendors() first.`);
      return { symbol: ticker, timeframe, candles: [] };
    }
    
    try {
      const candles = await vendor.fetchCandles(ticker, timeframe);
      return { symbol: ticker, timeframe, candles };
    } catch (error) {
      console.error(`Failed to fetch candles from ${vendor.name} for ${ticker} ${timeframe}:`, error);
      return { symbol: ticker, timeframe, candles: [] };
    }
  }

  private async fetchOptionsFromVendor(ticker: Ticker, key: OptionKey): Promise<OptionsEntry> {
    const vendor = this.getVendor();
    if (!vendor) {
      console.warn(`No vendors available. Please call setVendors() first.`);
      return {
        asOf: new Date().toISOString(),
        expiry: key.expiry,
        strike: key.strike,
        spot: 0
      };
    }

    try {
      return await vendor.fetchOption(ticker, key);
    } catch (error) {
      console.error(`Failed to fetch option from ${vendor.name} for ${ticker} ${key.expiry}@${key.strike}:`, error);
      return {
        asOf: new Date().toISOString(),
        expiry: key.expiry,
        strike: key.strike,
        spot: 0
      };
    }
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
