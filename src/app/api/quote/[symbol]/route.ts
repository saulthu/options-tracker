import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// Initialize Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Types for quote data
interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
  source: 'cached' | 'fresh';
  marketStatus?: 'preMarket' | 'regular' | 'afterHours' | 'closed';
}

// Types for market status
interface MarketStatus {
  isOpen: boolean;
  isPreMarket: boolean;
  isAfterHours: boolean;
  nextOpen?: Date;
  nextClose?: Date;
}

// Types for Polygon API responses
interface PolygonOpenCloseResponse {
  status: string;
  from: string;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  afterHours?: number;
  preMarket?: number;
}

interface PolygonAggsResponse {
  status: string;
  ticker: string;
  results: Array<{
    T: string;
    v: number;
    o: number;
    c: number;
    h: number;
    l: number;
    t: number;
  }>;
}

interface QuoteCacheMetadata {
  quote: StockQuote;
  cachedAt: number;
  expiresAt: number;
}

// Configuration
const CACHE_TTL_SECONDS = 300; // 5 minutes TTL
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
const POLYGON_ACCOUNT_TYPE = process.env.POLYGON_ACCOUNT_TYPE || 'free'; // 'free' or 'paid'

/**
 * Market-Aware Quote API
 * 
 * This API intelligently selects the best data source based on market status and account type:
 * 
 * When markets are CLOSED or using FREE account:
 * - Uses Polygon's open-close API (v1/open-close)
 * - Prioritizes: preMarket > afterHours > close
 * - Provides end-of-day data with extended hours information
 * 
 * When markets are OPEN and using PAID account:
 * - Uses Polygon's live data API (v2/aggs/ticker)
 * - Provides 15-minute delayed live data
 * - More accurate for active trading
 * 
 * Environment Variables:
 * - POLYGON_API_KEY: Your Polygon.io API key
 * - POLYGON_ACCOUNT_TYPE: 'free' or 'paid' (defaults to 'free')
 */

// Market hours (EST/EDT)
const MARKET_OPEN_HOUR = 9; // 9:30 AM EST
const MARKET_OPEN_MINUTE = 30;
const MARKET_CLOSE_HOUR = 16; // 4:00 PM EST
const MARKET_CLOSE_MINUTE = 0;
const PRE_MARKET_START_HOUR = 4; // 4:00 AM EST
const PRE_MARKET_START_MINUTE = 0;
const AFTER_HOURS_END_HOUR = 20; // 8:00 PM EST
const AFTER_HOURS_END_MINUTE = 0;

// Helper function to check market status
function getMarketStatus(): MarketStatus {
  const now = new Date();
  const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  
  const currentHour = est.getHours();
  const currentMinute = est.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  
  const marketOpenTime = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MINUTE;
  const marketCloseTime = MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MINUTE;
  const preMarketStartTime = PRE_MARKET_START_HOUR * 60 + PRE_MARKET_START_MINUTE;
  const afterHoursEndTime = AFTER_HOURS_END_HOUR * 60 + AFTER_HOURS_END_MINUTE;
  
  // Check if it's a weekday (Monday = 1, Friday = 5)
  const isWeekday = est.getDay() >= 1 && est.getDay() <= 5;
  
  if (!isWeekday) {
    return {
      isOpen: false,
      isPreMarket: false,
      isAfterHours: false,
      nextOpen: getNextMarketOpen(est)
    };
  }
  
  const isPreMarket = currentTime >= preMarketStartTime && currentTime < marketOpenTime;
  const isRegularHours = currentTime >= marketOpenTime && currentTime < marketCloseTime;
  const isAfterHours = currentTime >= marketCloseTime && currentTime < afterHoursEndTime;
  const isOpen = isRegularHours;
  
  return {
    isOpen,
    isPreMarket,
    isAfterHours,
    nextOpen: !isOpen ? getNextMarketOpen(est) : undefined,
    nextClose: isOpen ? getNextMarketClose(est) : undefined
  };
}

// Helper function to get next market open
function getNextMarketOpen(currentDate: Date): Date {
  const nextOpen = new Date(currentDate);
  nextOpen.setHours(MARKET_OPEN_HOUR, MARKET_OPEN_MINUTE, 0, 0);
  
  // If it's already past today's open, get next weekday
  if (nextOpen <= currentDate) {
    const daysUntilMonday = (8 - currentDate.getDay()) % 7;
    nextOpen.setDate(currentDate.getDate() + (daysUntilMonday === 0 ? 1 : daysUntilMonday));
  }
  
  return nextOpen;
}

// Helper function to get next market close
function getNextMarketClose(currentDate: Date): Date {
  const nextClose = new Date(currentDate);
  nextClose.setHours(MARKET_CLOSE_HOUR, MARKET_CLOSE_MINUTE, 0, 0);
  
  // If it's already past today's close, get next weekday
  if (nextClose <= currentDate) {
    const daysUntilMonday = (8 - currentDate.getDay()) % 7;
    nextClose.setDate(currentDate.getDate() + (daysUntilMonday === 0 ? 1 : daysUntilMonday));
  }
  
  return nextClose;
}

// Helper function to fetch quote from Polygon.io with market-aware logic
async function fetchQuoteFromPolygon(symbol: string): Promise<StockQuote | null> {
  if (!POLYGON_API_KEY) {
    throw new Error("POLYGON_API_KEY not configured");
  }

  const marketStatus = getMarketStatus();
  const isPaidAccount = POLYGON_ACCOUNT_TYPE === 'paid';
  
  try {
    let quote: StockQuote | null = null;
    
    // Strategy 1: If markets are closed OR free account, use open-close API
    if (!marketStatus.isOpen || !isPaidAccount) {
      quote = await fetchQuoteFromOpenClose(symbol, marketStatus);
    }
    // Strategy 2: If markets are open AND paid account, use live data
    else if (marketStatus.isOpen && isPaidAccount) {
      quote = await fetchQuoteFromLiveData(symbol);
    }
    
    return quote;
  } catch (error) {
    console.error(`Failed to fetch quote for ${symbol}:`, error);
    throw error;
  }
}

// Helper function to fetch quote from open-close API (supports preMarket/afterHours)
async function fetchQuoteFromOpenClose(symbol: string, marketStatus: MarketStatus): Promise<StockQuote | null> {
  const url = `https://api.polygon.io/v1/open-close/${symbol.toUpperCase()}/today?adjusted=true&apikey=${POLYGON_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Polygon open-close API error: ${response.status} ${response.statusText}`);
  }

  const data: PolygonOpenCloseResponse = await response.json();
  
  if (data.status !== 'OK') {
    return null;
  }

  // Determine the best price based on priority: preMarket > afterHours > close
  let price = data.close;
  let marketStatusType: 'preMarket' | 'regular' | 'afterHours' | 'closed' = 'closed';
  
  if (data.preMarket && marketStatus.isPreMarket) {
    price = data.preMarket;
    marketStatusType = 'preMarket';
  } else if (data.afterHours && marketStatus.isAfterHours) {
    price = data.afterHours;
    marketStatusType = 'afterHours';
  } else if (marketStatus.isOpen) {
    marketStatusType = 'regular';
  }

  const change = price - data.open;
  const changePercent = (change / data.open) * 100;

  return {
    symbol: symbol.toUpperCase(),
    price,
    change,
    changePercent,
    volume: data.volume,
    high: data.high,
    low: data.low,
    open: data.open,
    previousClose: data.open, // Previous close is the open price
    timestamp: Date.now(),
    source: 'fresh',
    marketStatus: marketStatusType
  };
}

// Helper function to fetch live quote data (paid accounts only)
async function fetchQuoteFromLiveData(symbol: string): Promise<StockQuote | null> {
  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}/prev?adjusted=true&apikey=${POLYGON_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Polygon aggs API error: ${response.status} ${response.statusText}`);
  }

  const data: PolygonAggsResponse = await response.json();
  
  if (!data.results || data.results.length === 0) {
    return null;
  }

  const result = data.results[0];
  const price = result.c; // close price
  const previousClose = result.o; // open price (previous close)
  const change = price - previousClose;
  const changePercent = (change / previousClose) * 100;

  return {
    symbol: symbol.toUpperCase(),
    price,
    change,
    changePercent,
    volume: result.v,
    high: result.h,
    low: result.l,
    open: result.o,
    previousClose,
    timestamp: result.t,
    source: 'fresh',
    marketStatus: 'regular'
  };
}

// Helper function to get cached quote
async function getCachedQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const key = `quote:${symbol.toUpperCase()}`;
    const cached = await redis.get<QuoteCacheMetadata>(key);
    
    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    if (Date.now() > cached.expiresAt) {
      // Cache expired, delete it
      await redis.del(key);
      return null;
    }

    return {
      ...cached.quote,
      source: 'cached'
    };
  } catch (error) {
    console.error(`Failed to get cached quote for ${symbol}:`, error);
    return null;
  }
}

// Helper function to cache quote
async function cacheQuote(symbol: string, quote: StockQuote): Promise<void> {
  try {
    const key = `quote:${symbol.toUpperCase()}`;
    const now = Date.now();
    const expiresAt = now + (CACHE_TTL_SECONDS * 1000);
    
    const metadata: QuoteCacheMetadata = {
      quote,
      cachedAt: now,
      expiresAt
    };

    await redis.setex(key, CACHE_TTL_SECONDS, metadata);
  } catch (error) {
    console.error(`Failed to cache quote for ${symbol}:`, error);
    // Don't throw - caching failure shouldn't break the API
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const resolvedParams = await params;
    const symbol = resolvedParams.symbol;
    
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    const symbolUpper = symbol.toUpperCase();
    
    // Check if Redis is available
    const redisAvailable = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
    
    if (!redisAvailable) {
      return NextResponse.json(
        { error: 'Quote caching not available - Redis not configured' },
        { status: 503 }
      );
    }

    // Try to get cached quote first
    let quote = await getCachedQuote(symbolUpper);
    
    if (!quote) {
      // No cached quote, fetch fresh from Polygon
      if (!POLYGON_API_KEY) {
        return NextResponse.json(
          { error: 'Quote API not configured - POLYGON_API_KEY missing' },
          { status: 503 }
        );
      }

      try {
        const freshQuote = await fetchQuoteFromPolygon(symbolUpper);
        
        if (!freshQuote) {
          return NextResponse.json(
            { error: `No quote data found for symbol: ${symbolUpper}` },
            { status: 404 }
          );
        }

        // Cache the fresh quote
        await cacheQuote(symbolUpper, freshQuote);
        quote = freshQuote;
      } catch (error) {
        console.error(`Failed to fetch quote for ${symbolUpper}:`, error);
        return NextResponse.json(
          { 
            error: 'Failed to fetch quote data',
            detail: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    }

    // Return the quote with cache headers
    const response = NextResponse.json(quote);
    
    // Set cache headers for client-side caching
    response.headers.set('Cache-Control', `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`);
    response.headers.set('X-Cache-Status', quote.source);
    response.headers.set('X-Cache-TTL', CACHE_TTL_SECONDS.toString());
    
    return response;

  } catch (error) {
    console.error('Quote API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        detail: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Optional: Add a method to clear quote cache
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const resolvedParams = await params;
    const symbol = resolvedParams.symbol;
    
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    const key = `quote:${symbol.toUpperCase()}`;
    const deleted = await redis.del(key);
    
    return NextResponse.json({
      message: `Quote cache cleared for ${symbol.toUpperCase()}`,
      deleted: deleted > 0
    });

  } catch (error) {
    console.error('Failed to clear quote cache:', error);
    return NextResponse.json(
      { 
        error: 'Failed to clear quote cache',
        detail: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
