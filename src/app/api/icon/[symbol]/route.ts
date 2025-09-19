import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { put, head, del } from '@vercel/blob';
import { 
  IconCacheMetadata,
  IconFetchResult, 
  IconCacheConfig,
  IconCacheError,
  PolygonTickerOverview 
} from '@/types/icon-cache';

// Configuration
const CONFIG: IconCacheConfig = {
  ttlSeconds: 60 * 60 * 24 * 7, // 7 days
  faviconSize: 128,
  maxIconSize: 1024 * 1024, // 1MB
  minIconSize: 50, // 50 bytes
};

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

// Initialize Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * GET /api/icon/[symbol] - Retrieve cached ticker icon
 * 
 * Flow:
 * 1. Check Vercel Blob for cached icon
 * 2. If not found, fetch from Polygon.io or Google Favicon
 * 3. Cache result in Vercel Blob
 * 4. Serve with appropriate cache headers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const resolvedParams = await params;
  const symbol = (resolvedParams.symbol || '').toUpperCase().trim();
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get('refresh') === 'true' || url.searchParams.get('force') === 'true';
  
  if (!symbol) {
    return NextResponse.json(
      { error: 'Missing symbol parameter' },
      { status: 400 }
    );
  }

  if (!POLYGON_API_KEY) {
    console.error('POLYGON_API_KEY environment variable is not set');
    return NextResponse.json(
      { error: 'Icon service not configured' },
      { status: 500 }
    );
  }

  // Check if Redis and Blob are available
  const redisAvailable = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
  const blobAvailable = process.env.BLOB_READ_WRITE_TOKEN;

  const kvKey = `icon:${symbol}`;
  let meta: IconCacheMetadata | null = null;

  try {
    // 1. Check Redis cache for metadata (fast path) - only if Redis is available and not forcing refresh
    if (redisAvailable && !forceRefresh) {
      try {
        meta = await redis.get<IconCacheMetadata>(kvKey);
        
        if (meta && Date.now() < meta.expiresAt) {
          // Cache is valid, redirect directly to blob URL for fastest access
          if (meta.blobUrl) {
            return NextResponse.redirect(meta.blobUrl, 302);
          }
          
          // Migration: Update old cache entries to include blobUrl
          if (blobAvailable && meta.blobKey && !meta.blobUrl) {
            try {
              const blob = await Promise.race([
                tryGetBlob(meta.blobKey),
                new Promise<null>((_, reject) => 
                  setTimeout(() => reject(new Error('Blob fetch timeout')), 500)
                )
              ]);
              
              if (blob) {
                // Update the cache entry with blobUrl for future requests
                const updatedMeta: IconCacheMetadata = {
                  ...meta,
                  blobUrl: blob.url
                };
                
                // Update Redis in background (don't wait)
                redis.setex(kvKey, CONFIG.ttlSeconds, updatedMeta).catch(err => 
                  console.warn('Failed to update cache with blobUrl:', err)
                );
                
                return streamBlob(blob, meta.contentType, true, 200, {
                  'X-Icon-Source': meta.source,
                  'X-Icon-Cached': 'true',
                  'X-Icon-Size': meta.size.toString(),
                  'X-Force-Refresh': 'false',
                });
              }
            } catch (blobError) {
              console.warn('Blob fetch failed or timed out:', blobError);
              // Fall through to refetch
            }
          }
          
          // Final fallback: try to serve from Blob with timeout
          if (blobAvailable && meta.blobKey) {
            try {
              const blob = await Promise.race([
                tryGetBlob(meta.blobKey),
                new Promise<null>((_, reject) => 
                  setTimeout(() => reject(new Error('Blob fetch timeout')), 300)
                )
              ]);
              
              if (blob) {
                return streamBlob(blob, meta.contentType, true, 200, {
                  'X-Icon-Source': meta.source,
                  'X-Icon-Cached': 'true',
                  'X-Icon-Size': meta.size.toString(),
                  'X-Force-Refresh': 'false',
                });
              }
            } catch (blobError) {
              console.warn('Blob fetch failed or timed out:', blobError);
              // Fall through to refetch
            }
          }
        }
      } catch (redisError) {
        console.warn('Redis not available, falling back to fresh fetch:', redisError);
        // Fall through to fresh fetch
      }
    }

    // 2. Stable blob fallback removed - all icons should go through fresh fetch and redirect process

    // 3. Fetch fresh icon
    const fetchResult = await fetchIconBytes(symbol);
    
    // 4. Store in Vercel Blob and update Redis in parallel for speed
    const ext = guessExtension(fetchResult.contentType) || 'png';
    const version = Math.floor(Date.now() / 1000);
    const blobKey = `icons/${symbol}.${version}.${ext}`;

    // Start blob storage and Redis update in parallel
    const storagePromises: Promise<unknown>[] = [];
    let blobUrl = '';

    if (blobAvailable) {
      // Store in blob storage
      storagePromises.push(
        put(blobKey, Buffer.from(fetchResult.bytes), { 
          contentType: fetchResult.contentType,
          access: 'public'
        }).then(async (blob) => {
          blobUrl = blob.url;
          return blob;
        }).catch((blobError) => {
          console.warn('Vercel Blob storage failed:', blobError);
          return null;
        })
      );
    }

    if (redisAvailable) {
      // Prepare Redis metadata (will be updated with blobUrl after storage)
      const newMeta: IconCacheMetadata = {
        blobKey,
        blobUrl: '', // Will be updated after blob storage
        contentType: fetchResult.contentType,
        expiresAt: Date.now() + CONFIG.ttlSeconds * 1000,
        source: fetchResult.source,
        size: fetchResult.size,
        cachedAt: Date.now(),
      };
      
      storagePromises.push(
        redis.setex(kvKey, CONFIG.ttlSeconds, newMeta).catch((redisError) => {
          console.warn('Redis storage failed:', redisError);
          return null;
        })
      );
    }

    // Wait for all storage operations to complete
    if (storagePromises.length > 0) {
      await Promise.allSettled(storagePromises);
      
      // Update Redis with final blobUrl if we got it
      if (redisAvailable && blobUrl) {
        try {
          const finalMeta: IconCacheMetadata = {
            blobKey,
            blobUrl,
            contentType: fetchResult.contentType,
            expiresAt: Date.now() + CONFIG.ttlSeconds * 1000,
            source: fetchResult.source,
            size: fetchResult.size,
            cachedAt: Date.now(),
          };
          await redis.setex(kvKey, CONFIG.ttlSeconds, finalMeta);
        } catch (redisError) {
          console.warn('Failed to update Redis with blobUrl:', redisError);
        }
      }
    }

    // 7. Serve freshly fetched icon - redirect to blob URL for consistency
    if (blobAvailable && blobUrl) {
      return NextResponse.redirect(blobUrl, 302);
    }
    
    // Fallback: serve directly if blob URL not available
    return new Response(Buffer.from(fetchResult.bytes), {
      status: 200,
      headers: {
        'Content-Type': fetchResult.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Icon-Source': fetchResult.source,
        'X-Icon-Cached': 'false',
        'X-Icon-Size': fetchResult.size.toString(),
        'X-Force-Refresh': forceRefresh ? 'true' : 'false',
      },
    });

  } catch (error: unknown) {
    console.error(`Icon cache error for ${symbol}:`, error);
    
    // Final fallback: try to generate a default icon
    try {
      console.warn(`All icon sources failed for ${symbol}, using default icon`);
      const defaultResult = generateDefaultIcon(symbol);
      
      // Cache the default icon in Vercel Blob (if available)
      const ext = guessExtension(defaultResult.contentType) || 'svg';
      const version = Math.floor(Date.now() / 1000);
      const blobKey = `icons/${symbol}.${version}.${ext}`;
      const stableBlobKey = `icons/${symbol}.latest.${ext}`;

      if (blobAvailable) {
        try {
          // Store with versioned key (for immutable caching)
          await put(blobKey, Buffer.from(defaultResult.bytes), { 
            contentType: defaultResult.contentType,
            access: 'public'
          });

          // Also store with stable key (for Redis-less fallback)
          await put(stableBlobKey, Buffer.from(defaultResult.bytes), { 
            contentType: defaultResult.contentType,
            access: 'public',
            allowOverwrite: true
          });
        } catch (blobError) {
          console.warn('Failed to cache default icon:', blobError);
          // Continue without caching
        }
      }

      // Get blob URL for redirect
      let blobUrl = '';
      if (blobAvailable) {
        try {
          const blobMeta = await head(blobKey);
          blobUrl = blobMeta?.url || '';
        } catch (urlError) {
          console.warn('Failed to get blob URL for default icon:', urlError);
        }
      }

      // Cache the default icon metadata in Redis (if available)
      if (redisAvailable) {
        try {
          const newMeta: IconCacheMetadata = {
            blobKey,
            blobUrl,
            contentType: defaultResult.contentType,
            expiresAt: Date.now() + CONFIG.ttlSeconds * 1000,
            source: defaultResult.source,
            size: defaultResult.size,
            cachedAt: Date.now(),
          };
          
          await redis.setex(kvKey, CONFIG.ttlSeconds, newMeta);
        } catch (redisError) {
          console.warn('Failed to update Redis cache for default icon:', redisError);
          // Continue without caching
        }
      }
      
      // Redirect to blob URL for consistency
      if (blobAvailable && blobUrl) {
        return NextResponse.redirect(blobUrl, 302);
      }
      
      // Fallback: serve directly if blob URL not available
      return new Response(Buffer.from(defaultResult.bytes), {
        status: 200,
        headers: {
          'Content-Type': defaultResult.contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Icon-Source': defaultResult.source,
          'X-Icon-Cached': 'false',
          'X-Icon-Size': defaultResult.size.toString(),
          'X-Force-Refresh': forceRefresh ? 'true' : 'false',
        },
      });
    } catch (defaultError) {
      console.error(`Failed to generate default icon for ${symbol}:`, defaultError);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResponse: IconCacheError = {
        error: 'Icon not found',
        detail: errorMessage,
        symbol,
        timestamp: Date.now(),
      };

      return NextResponse.json(errorResponse, { 
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        }
      });
    }
  }
}

/**
 * Fetch icon bytes from Polygon.io or Google Favicon service
 */
async function fetchIconBytes(symbol: string): Promise<IconFetchResult> {
  // 1. Try Polygon.io Ticker Overview first
  const overview = await fetchPolygonOverview(symbol);
  const iconUrl = overview?.results?.branding?.icon_url;
  const homepage = overview?.results?.homepage_url;

  // Create fetch promises for both sources in parallel
  const fetchPromises: Promise<IconFetchResult>[] = [];

  // Prefer Polygon branding.icon_url if available
  if (iconUrl) {
    fetchPromises.push(
      fetchWithTimeout(`${iconUrl}?apiKey=${POLYGON_API_KEY}`, {
        cache: 'no-store',
        headers: {
          'User-Agent': 'Options-Tracker/1.0',
        }
      }, 5000).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Polygon icon fetch failed: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || 'image/png';
        const bytes = new Uint8Array(await response.arrayBuffer());
        
        if (!isValidIcon(contentType, bytes)) {
          throw new Error('Polygon icon is not a valid image');
        }

        return {
          bytes,
          contentType,
          source: 'polygon' as const,
          size: bytes.length,
        };
      }).catch((error) => {
        console.warn(`Polygon icon fetch failed for ${symbol}:`, error);
        throw error;
      })
    );
  }

  // Fallback to Google Favicon service using homepage_url
  if (homepage) {
    fetchPromises.push(
      fetchWithTimeout(`https://www.google.com/s2/favicons?sz=${CONFIG.faviconSize}&domain_url=${encodeURIComponent(homepage)}`, {
        cache: 'no-store',
        headers: {
          'User-Agent': 'Options-Tracker/1.0',
        }
      }, 3000).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Favicon fetch failed: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || 'image/png';
        const bytes = new Uint8Array(await response.arrayBuffer());
        
        if (!isValidIcon(contentType, bytes)) {
          throw new Error('Favicon is not a valid image');
        }

        return {
          bytes,
          contentType,
          source: 'favicon' as const,
          size: bytes.length,
        };
      }).catch((error) => {
        console.warn(`Favicon fetch failed for ${symbol}:`, error);
        throw error;
      })
    );
  }

  // Try all available sources in parallel, return first successful result
  if (fetchPromises.length === 0) {
    console.warn(`No icon sources available for ${symbol}, using default icon`);
    return generateDefaultIcon(symbol);
  }

  try {
    const result = await Promise.any(fetchPromises);
    return result;
  } catch {
    console.warn(`All icon sources failed for ${symbol}, using default icon`);
    return generateDefaultIcon(symbol);
  }
}

/**
 * Generate a default icon for symbols without available icons
 */
function generateDefaultIcon(symbol: string): IconFetchResult {
  // Create a simple SVG icon with the ticker symbol (up to 4 characters)
  const displaySymbol = symbol.substring(0, 4);
  const fontSize = displaySymbol.length <= 3 ? 48 : 36; // Smaller font for 4+ chars
  const yPosition = displaySymbol.length <= 3 ? 80 : 82; // Slight adjustment for smaller font
  
  const svg = `
    <svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="24" fill="url(#grad)"/>
      <text x="64" y="${yPosition}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" 
            text-anchor="middle" fill="white">${displaySymbol}</text>
    </svg>
  `;
  
  const bytes = new TextEncoder().encode(svg);
  
  return {
    bytes: new Uint8Array(bytes),
    contentType: 'image/svg+xml',
    source: 'default',
    size: bytes.length,
  };
}

/**
 * Fetch Polygon.io Ticker Overview
 */
async function fetchPolygonOverview(symbol: string): Promise<PolygonTickerOverview> {
  const url = `https://api.polygon.io/v3/reference/tickers/${encodeURIComponent(symbol)}?apiKey=${POLYGON_API_KEY}`;
  
  const response = await fetchWithTimeout(url, { 
    cache: 'no-store',
    headers: {
      'User-Agent': 'Options-Tracker/1.0',
    }
  }, 3000); // 3 second timeout for overview
  
  if (!response.ok) {
    throw new Error(`Polygon overview fetch failed: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Validate that the fetched data is a valid icon
 */
function isValidIcon(contentType: string, bytes: Uint8Array): boolean {
  // Check content type
  if (!contentType.startsWith('image/')) {
    return false;
  }
  
  // Check size constraints
  if (bytes.length < CONFIG.minIconSize || bytes.length > CONFIG.maxIconSize) {
    return false;
  }
  
  // Basic image format validation
  const validImageHeaders = [
    [0xFF, 0xD8, 0xFF], // JPEG
    [0x89, 0x50, 0x4E, 0x47], // PNG
    [0x47, 0x49, 0x46], // GIF
    [0x52, 0x49, 0x46, 0x46], // WEBP (RIFF)
    [0x3C, 0x3F, 0x78, 0x6D, 0x6C], // SVG (XML)
  ];
  
  return validImageHeaders.some(header => 
    header.every((byte, index) => bytes[index] === byte)
  );
}

/**
 * Guess file extension from content type
 */
function guessExtension(contentType: string): string | null {
  if (contentType.includes('svg')) return 'svg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return null;
}

/**
 * Try to get blob from Vercel Blob storage
 */
async function tryGetBlob(blobKey: string) {
  try {
    // Check if blob exists
    const meta = await head(blobKey);
    if (!meta) return null;
    
    // Return the blob URL for fetching
    return meta;
  } catch (error) {
    console.warn(`Failed to get blob ${blobKey}:`, error);
    return null;
  }
}

/**
 * Stream blob response with appropriate headers
 */
function streamBlob(
  blobMeta: Awaited<ReturnType<typeof head>>,
  contentType: string,
  longCache: boolean,
  status = 200,
  extraHeaders: Record<string, string> = {}
) {
  if (!blobMeta) {
    throw new Error('Blob metadata is null');
  }

  // Fetch the blob content
  return fetch(blobMeta.url).then(response => {
    if (!response.ok) {
      throw new Error(`Failed to fetch blob: ${response.status}`);
    }
    
    return new Response(response.body, {
      status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': longCache
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=300, stale-while-revalidate=86400',
        ...extraHeaders,
      },
    });
  });
}

/**
 * DELETE /api/icon/[symbol] - Clear cache for a specific symbol
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const resolvedParams = await params;
  const symbol = (resolvedParams.symbol || '').toUpperCase().trim();
  
  if (!symbol) {
    return NextResponse.json(
      { error: 'Missing symbol parameter' },
      { status: 400 }
    );
  }

  try {
    // Delete from Redis (if available)
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const kvKey = `icon:${symbol}`;
        await redis.del(kvKey);
      } catch (error) {
        console.warn(`Failed to delete Redis cache for ${symbol}:`, error);
        // Don't fail the request if Redis deletion fails
      }
    }

    // Try to delete from Blob (if available)
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const stableBlobKey = `icons/${symbol}.latest.${guessExtension('image/png') || 'png'}`;
        await del(stableBlobKey);
      } catch (error) {
        console.warn(`Failed to delete blob for ${symbol}:`, error);
        // Don't fail the request if blob deletion fails
      }
    }
    
    return NextResponse.json({
      message: `Cache cleared for ${symbol}`,
      symbol,
    });
  } catch (error: unknown) {
    console.error(`Failed to clear cache for ${symbol}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to clear cache', detail: errorMessage },
      { status: 500 }
    );
  }
}