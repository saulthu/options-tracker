# Icon Cache Invalidation Guide

This guide explains how to force reload and invalidate cached icons in the Options Tracker icon system.

## 🔄 Force Refresh (Query Parameters)

### Single Icon Force Refresh

Force a specific icon to be re-fetched from the original source:

```bash
# Force refresh AAPL icon
curl "http://localhost:3000/api/icon/AAPL?refresh=true"

# Alternative parameter name
curl "http://localhost:3000/api/icon/AAPL?force=true"
```

**Response Headers:**
- `X-Force-Refresh: true` - Indicates this was a forced refresh
- `X-Icon-Cached: false` - Icon was fetched fresh, not from cache
- `X-Icon-Source: polygon|favicon|default` - Source of the fresh icon

### Browser Usage

In your frontend code, you can force refresh by adding query parameters:

```javascript
// Force refresh an icon
const iconUrl = `/api/icon/${symbol}?refresh=true`;

// Or use the force parameter
const iconUrl = `/api/icon/${symbol}?force=true`;
```

## 🗑️ Cache Invalidation (API Endpoints)

### 1. Clear Single Symbol

Delete cached icon for a specific symbol:

```bash
curl -X DELETE "http://localhost:3000/api/icon/AAPL"
```

**Response:**
```json
{
  "message": "Cache cleared for AAPL",
  "symbol": "AAPL"
}
```

### 2. Clear Multiple Symbols

Clear cached icons for multiple symbols at once:

```bash
curl -X POST "http://localhost:3000/api/icon/clear-multiple" \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["AAPL", "MSFT", "GOOGL", "TSLA"]}'
```

**Response:**
```json
{
  "message": "Processed 4 symbols",
  "results": [
    {
      "symbol": "AAPL",
      "results": [
        {"extension": "png", "status": "deleted"},
        {"extension": "jpg", "status": "deleted"},
        {"extension": "svg", "status": "deleted"}
      ]
    },
    // ... more symbols
  ],
  "cleared": 4
}
```

### 3. Clear All Cache (Information Only)

```bash
curl -X DELETE "http://localhost:3000/api/icon/clear-all"
```

**Response:**
```json
{
  "message": "Clear all operation not directly supported",
  "detail": "Vercel Blob does not provide a bulk delete operation...",
  "suggestion": "Use DELETE /api/icon/[symbol] to clear individual symbols..."
}
```

## 📊 Cache Status Headers

All icon responses include these headers for debugging:

| Header | Description | Values |
|--------|-------------|--------|
| `X-Icon-Cached` | Whether icon was served from cache | `true` / `false` |
| `X-Icon-Source` | Source of the icon | `cached-blob` / `polygon` / `favicon` / `default` |
| `X-Icon-Size` | Size of the icon in bytes | Number or `unknown` |
| `X-Force-Refresh` | Whether this was a forced refresh | `true` / `false` |

## 🔧 Implementation Examples

### React Component with Force Refresh

```tsx
import { useState } from 'react';

function TickerIcon({ symbol, forceRefresh = false }) {
  const [refreshKey, setRefreshKey] = useState(0);
  
  const handleForceRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };
  
  const iconUrl = `/api/icon/${symbol}${forceRefresh ? '?refresh=true' : ''}`;
  
  return (
    <div>
      <img 
        key={refreshKey}
        src={iconUrl} 
        alt={`${symbol} icon`}
        onError={() => console.log('Icon failed to load')}
      />
      <button onClick={handleForceRefresh}>
        Force Refresh
      </button>
    </div>
  );
}
```

### JavaScript Cache Management

```javascript
class IconCacheManager {
  // Force refresh a single icon
  async forceRefresh(symbol) {
    const response = await fetch(`/api/icon/${symbol}?refresh=true`);
    return response.ok;
  }
  
  // Clear cache for multiple symbols
  async clearMultiple(symbols) {
    const response = await fetch('/api/icon/clear-multiple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols })
    });
    return await response.json();
  }
  
  // Clear cache for single symbol
  async clear(symbol) {
    const response = await fetch(`/api/icon/${symbol}`, {
      method: 'DELETE'
    });
    return await response.json();
  }
}

// Usage
const cacheManager = new IconCacheManager();
await cacheManager.forceRefresh('AAPL');
await cacheManager.clearMultiple(['AAPL', 'MSFT']);
```

## 🚀 Performance Considerations

### When to Use Force Refresh

- **Development/Testing**: When testing new icon sources
- **Icon Updates**: When you know a company has updated their branding
- **Debugging**: When investigating icon loading issues
- **User Request**: When users report outdated icons

### When to Use Cache Invalidation

- **Bulk Updates**: When updating many symbols at once
- **Maintenance**: During scheduled cache maintenance
- **Storage Cleanup**: When cleaning up unused cached icons
- **Error Recovery**: When cached icons are corrupted

### Cache Behavior

1. **Normal Request**: Checks Vercel Blob cache first, serves if available
2. **Force Refresh**: Skips cache, fetches fresh from source, updates cache
3. **After Invalidation**: Next request will fetch fresh and cache again

## 🔍 Debugging Cache Issues

### Check Cache Status

```bash
# Check if icon is cached
curl -I "http://localhost:3000/api/icon/AAPL"

# Look for these headers:
# X-Icon-Cached: true/false
# X-Icon-Source: cached-blob/polygon/favicon/default
```

### Force Refresh and Check

```bash
# Force refresh and check response
curl -I "http://localhost:3000/api/icon/AAPL?refresh=true"

# Should show:
# X-Force-Refresh: true
# X-Icon-Cached: false
# X-Icon-Source: polygon (or favicon/default)
```

### Clear and Re-fetch

```bash
# Clear cache
curl -X DELETE "http://localhost:3000/api/icon/AAPL"

# Next request will be fresh
curl -I "http://localhost:3000/api/icon/AAPL"
```

## 📝 Best Practices

1. **Use Force Refresh Sparingly**: Only when necessary to avoid API rate limits
2. **Batch Operations**: Use clear-multiple for bulk operations
3. **Monitor Headers**: Check response headers to understand cache behavior
4. **Handle Errors**: Implement proper error handling for cache operations
5. **User Feedback**: Provide visual feedback when forcing refresh
6. **Rate Limiting**: Be aware of Polygon.io rate limits when forcing refresh

## 🛠️ Troubleshooting

### Common Issues

1. **Icons Not Updating**: Check if cache invalidation was successful
2. **Rate Limit Errors**: Wait before forcing more refreshes
3. **Default Icons**: May indicate original source is unavailable
4. **CORS Issues**: Ensure proper headers in API responses

### Debug Commands

```bash
# Check cache status
curl -I "http://localhost:3000/api/icon/SYMBOL"

# Force refresh
curl -I "http://localhost:3000/api/icon/SYMBOL?refresh=true"

# Clear cache
curl -X DELETE "http://localhost:3000/api/icon/SYMBOL"

# Clear multiple
curl -X POST "http://localhost:3000/api/icon/clear-multiple" \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["SYMBOL1", "SYMBOL2"]}'
```

This comprehensive cache invalidation system gives you full control over icon caching behavior! 🎉

