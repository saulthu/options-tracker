// Market Data Types
// Based on market_data_plan.md specification

export type Ticker = string;
export type Timeframe = '1D' | '1W';

export interface Candle {
  t: string; // ISO timestamp
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v?: number; // volume (optional)
}

export interface OptionKey {
  expiry: string; // ISO date (YYYY-MM-DD)
  strike: number;
}

export interface OptionQuote {
  bid?: number;
  ask?: number;
  last?: number;
  iv?: number; // implied volatility
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  volume?: number;
  openInterest?: number;
}

export interface OptionsEntry {
  asOf: string; // ISO timestamp when data was fetched
  expiry: string; // ISO date (YYYY-MM-DD)
  strike: number;
  call?: OptionQuote;
  put?: OptionQuote;
  spot: number; // underlying spot price at time of fetch
}

export interface CandleSeries {
  series: Candle[];
  lastUpdated: string; // ISO timestamp
}

export interface OptionsData {
  lastUpdated: string; // ISO timestamp
  entries: Record<string, OptionsEntry>; // keyed by "expiry@strike"
}

export interface MarketDataBlob {
  schemaVersion: number;
  asOf: string; // ISO timestamp
  candles: {
    [K in Timeframe]: CandleSeries;
  };
  options: OptionsData;
}

export interface MarketDataConfig {
  optionsRetentionDays?: number; // default 7
  candleFreshnessMinutes?: {
    '1D': { marketHours: number; afterHours: number };
    '1W': { marketHours: number; afterHours: number };
  };
  optionsFreshnessMinutes?: {
    marketHours: number;
    afterHours: number;
  };
}

export interface IndicatorParams {
  window: number;
}

export type IndicatorType = 'SMA' | 'EMA';

// In-memory cache structures
export interface CandleCache {
  [ticker: string]: {
    [K in Timeframe]: {
      data: Candle[];
      lastUpdated: string;
    };
  };
}

export interface OptionsCache {
  [ticker: string]: Map<string, OptionsEntry>; // keyed by "expiry@strike"
}

// Vendor API interfaces (placeholder for future implementation)
export interface VendorCandleData {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
}

export interface VendorOptionsData {
  symbol: string;
  options: OptionsEntry[];
}

// Error types
export class MarketDataError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'MarketDataError';
  }
}

export class StaleDataError extends MarketDataError {
  constructor(message: string, public data: unknown) {
    super(message, 'STALE_DATA');
    this.name = 'StaleDataError';
  }
}
