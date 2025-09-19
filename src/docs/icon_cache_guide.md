# Icon Cache System Guide

A comprehensive icon caching system for ticker symbols using Vercel services, Polygon.io API, and Google Favicon service.

## Overview

The icon cache system provides fast, reliable access to ticker icons by:
1. **Primary Source**: Polygon.io Ticker Overview API for high-quality branding icons
2. **Fallback Source**: Google Favicon service for company website icons
3. **Caching**: Vercel Blob storage for binary data + Vercel KV for metadata
4. **Performance**: Long-term browser/CDN caching with versioned URLs

## Architecture

```
Client Request → API Route → KV Cache Check → Blob Storage → Polygon.io/Google → Cache & Serve
```

### Components

- **`/api/icon/[symbol]`** - Main API route for fetching icons
- **`/api/icon/stats`** - Cache statistics endpoint
- **`/api/icon/clear`** - Cache management endpoints
- **`TickerIcon`** - React component for displaying icons
- **`TickerIconGrid`** - React component for multiple icons
- **`icon-cache.ts`** - Utility functions

## Setup

### 1. Install Dependencies

```bash
npm install @vercel/blob @upstash/redis
```

### 2. Environment Variables

Add to your `.env.local`:

```env
# Required
POLYGON_API_KEY=your_polygon_io_api_key
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
KV_URL=your_vercel_kv_url
KV_REST_API_URL=your_vercel_kv_rest_api_url
KV_REST_API_TOKEN=your_vercel_kv_rest_api_token

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Vercel Configuration

In your Vercel project settings:

1. **Enable Vercel Blob** - For storing icon binary data
2. **Enable Vercel KV** - For storing cache metadata
3. **Add Environment Variables** - Set all required env vars

## Usage

### Basic Usage

```tsx
import { TickerIcon } from '@/components/TickerIcon';

function MyComponent() {
  return (
    <TickerIcon 
      symbol="AAPL" 
      size={48} 
      className="rounded-lg" 
    />
  );
}
```

### Multiple Icons

```tsx
import { TickerIconGrid } from '@/components/TickerIcon';

function PortfolioIcons() {
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA'];
  
  return (
    <TickerIconGrid 
      symbols={symbols}
      iconSize={32}
      columns={4}
      onAllLoaded={() => console.log('All icons loaded!')}
    />
  );
}
```

### Utility Functions

```tsx
import { 
  getTickerIconUrl, 
  preloadTickerIcons,
  getIconCacheStats 
} from '@/lib/icon-cache';

// Get icon URL
const iconUrl = getTickerIconUrl('AAPL');

// Preload icons for better performance
await preloadTickerIcons(['AAPL', 'MSFT', 'GOOGL']);

// Get cache statistics
const stats = await getIconCacheStats();
console.log(`Cached ${stats.totalCached} icons`);
```

## API Endpoints

### GET `/api/icon/[symbol]`

Fetch a ticker icon.

**Parameters:**
- `symbol` - Ticker symbol (e.g., "AAPL")

**Response:**
- `200` - Icon binary data with appropriate headers
- `404` - Icon not found
- `500` - Server error

**Headers:**
- `X-Icon-Source` - Source of icon (polygon/favicon)
- `X-Icon-Cached` - Cache status (true/false/stale)
- `X-Icon-Size` - Size in bytes

### GET `/api/icon/stats`

Get cache statistics.

**Response:**
```json
{
  "totalCached": 150,
  "polygonIcons": 120,
  "faviconIcons": 30,
  "totalSize": 2048000,
  "hitRate": 0.95
}
```

### DELETE `/api/icon/[symbol]`

Clear cache for a specific symbol.

**Response:**
```json
{
  "message": "Cache cleared for AAPL",
  "symbol": "AAPL"
}
```

### DELETE `/api/icon/clear`

Clear all icon cache.

**Response:**
```json
{
  "message": "Cleared 150 icon cache entries",
  "clearedCount": 150
}
```

## Configuration

### Cache Settings

```typescript
const CONFIG: IconCacheConfig = {
  ttlSeconds: 60 * 60 * 24 * 7, // 7 days
  faviconSize: 128,              // Google favicon size
  maxIconSize: 1024 * 1024,      // 1MB max
  minIconSize: 50,               // 50 bytes min
};
```

### Supported Image Formats

- PNG
- JPEG/JPG
- SVG
- WebP
- GIF

## Error Handling

The system provides comprehensive error handling:

1. **Network Errors** - Graceful fallback to stale cache
2. **Invalid Images** - Validation and rejection of bad data
3. **Missing APIs** - Clear error messages for configuration issues
4. **Rate Limiting** - Proper handling of API limits

## Performance Features

### Caching Strategy

1. **KV Metadata** - Fast lookup for cache status
2. **Blob Storage** - CDN-backed binary storage
3. **Versioned URLs** - Immutable cache with timestamp-based keys
4. **Browser Caching** - Long-term cache headers for performance

### Optimization

- **Lazy Loading** - Icons load only when needed
- **Preloading** - Batch preload for better UX
- **Error Recovery** - Serve stale data when possible
- **Size Validation** - Prevent oversized icons

## Monitoring

### Cache Statistics

Monitor cache performance with the stats endpoint:

```typescript
const stats = await getIconCacheStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
console.log(`Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
```

### Logging

The system logs important events:

- Cache hits/misses
- API errors
- Image validation failures
- Storage operations

## Troubleshooting

### Common Issues

1. **Missing Icons**
   - Check Polygon.io API key
   - Verify ticker symbol format
   - Check network connectivity

2. **Slow Performance**
   - Check Vercel KV/Blob configuration
   - Monitor cache hit rates
   - Consider preloading strategies

3. **Storage Issues**
   - Monitor Blob storage usage
   - Check KV storage limits
   - Implement cleanup routines

### Debug Mode

Enable detailed logging by setting:

```env
NODE_ENV=development
```

## Security Considerations

- **API Keys** - Never expose Polygon.io key to client
- **Rate Limiting** - Respect API limits
- **Input Validation** - Sanitize ticker symbols
- **Error Messages** - Don't leak sensitive information

## Cost Optimization

- **TTL Management** - Balance freshness vs. cost
- **Size Limits** - Prevent oversized icons
- **Cleanup** - Regular cache cleanup for unused icons
- **Monitoring** - Track storage usage and costs

## Future Enhancements

- **Multiple Sources** - Add more icon providers
- **Image Processing** - Resize/optimize icons
- **Analytics** - Track usage patterns
- **Batch Operations** - Bulk icon fetching
- **WebP Conversion** - Automatic format optimization

