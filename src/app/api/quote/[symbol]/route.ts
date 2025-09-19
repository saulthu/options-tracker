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
}

interface QuoteCacheMetadata {
  quote: StockQuote;
  cachedAt: number;
  expiresAt: number;
}

// Configuration
const CACHE_TTL_SECONDS = 60; // 1 minute TTL
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

// Helper function to fetch quote from Polygon.io using aggregates
async function fetchQuoteFromPolygon(symbol: string): Promise<StockQuote | null> {
  if (!POLYGON_API_KEY) {
    throw new Error("POLYGON_API_KEY not configured");
  }

  // Get current time and previous day for comparison
  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // First, try to get today's data (includes pre-market/after-hours)
  const todayUrl = `https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}/range/1/minute/${today}/${today}?adjusted=true&apikey=${POLYGON_API_KEY}`;
  
  try {
    const response = await fetch(todayUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Polygon API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      // No data for today, try yesterday's data
      const yesterdayData = await fetchYesterdayData(symbol, yesterday);
      if (!yesterdayData) {
        return null;
      }
      
      // Return yesterday's data as the quote
      return {
        symbol: symbol.toUpperCase(),
        price: yesterdayData.previousClose,
        change: 0,
        changePercent: 0,
        volume: 0,
        high: yesterdayData.previousClose,
        low: yesterdayData.previousClose,
        open: yesterdayData.previousClose,
        previousClose: yesterdayData.previousClose,
        timestamp: Date.now(),
        source: 'fresh'
      };
    }

    // Get the most recent minute bar from today
    const latestBar = data.results[data.results.length - 1];
    
    // Get yesterday's close for comparison
    const yesterdayData = await fetchYesterdayData(symbol, yesterday);
    const previousClose = yesterdayData?.previousClose || latestBar.o;

    const price = latestBar.c; // close price (most recent)
    const change = price - previousClose;
    const changePercent = (change / previousClose) * 100;

    return {
      symbol: symbol.toUpperCase(),
      price,
      change,
      changePercent,
      volume: latestBar.v,
      high: latestBar.h,
      low: latestBar.l,
      open: latestBar.o,
      previousClose,
      timestamp: latestBar.t,
      source: 'fresh'
    };
  } catch (error) {
    console.error(`Failed to fetch quote for ${symbol}:`, error);
    throw error;
  }
}

// Helper function to fetch yesterday's closing data
async function fetchYesterdayData(symbol: string, yesterday: string): Promise<{ previousClose: number } | null> {
  try {
    const url = `https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}/range/1/day/${yesterday}/${yesterday}?adjusted=true&apikey=${POLYGON_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];
    return {
      previousClose: result.c // yesterday's close
    };
  } catch (error) {
    console.error(`Failed to fetch yesterday's data for ${symbol}:`, error);
    return null;
  }
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
