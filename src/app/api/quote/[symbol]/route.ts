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
const CACHE_TTL_SECONDS = 300; // 5 minutes TTL
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

// Helper function to fetch quote from Polygon.io
async function fetchQuoteFromPolygon(symbol: string): Promise<StockQuote | null> {
  if (!POLYGON_API_KEY) {
    throw new Error("POLYGON_API_KEY not configured");
  }

  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}/prev?adjusted=true&apikey=${POLYGON_API_KEY}`;
  
  try {
    const response = await fetch(url, {
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
      source: 'fresh'
    };
  } catch (error) {
    console.error(`Failed to fetch quote for ${symbol}:`, error);
    throw error;
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
