# Market Data System Usage Guide

## Overview

The Market Data System provides a comprehensive, extensible solution for fetching, caching, and managing financial market data. It supports multiple vendors, intelligent caching, and real-time data processing.

## Architecture

### Core Components

1. **MarketDataVendor Interface** - Extensible interface for market data providers
2. **VendorFactory** - Manages vendor registration and selection
3. **MarketData Class** - Core caching and data management
4. **AlpacaVendor** - Alpaca Markets implementation
5. **MarketDataDemo** - Interactive demonstration UI

### Key Features

- **Multi-Vendor Support**: Pluggable architecture for different data providers
- **Intelligent Caching**: Memory + database caching with freshness controls
- **Current Price Caching**: Real-time price caching with configurable freshness rules
- **Background Refresh**: Serves stale data immediately while refreshing in background
- **Error Handling**: Comprehensive error management with user-friendly messages
- **Extensibility**: Easy to add new vendors and features

## Quick Start

### 1. Vendor Setup and Configuration

**Important**: The market data system requires vendors to be configured before use. Vendors are NOT automatically set up from environment variables - they must be configured by the user through the UI or programmatically.

#### Option A: Using PortfolioContext (Recommended)

```typescript
import { usePortfolio } from '@/contexts/PortfolioContext';

function MyComponent() {
  const { setupMarketDataVendors, getMarketPrice } = usePortfolio();
  
  // Set up vendors with user credentials
  const handleSetup = async (apiKey: string, secretKey: string) => {
    try {
      await setupMarketDataVendors(apiKey, secretKey);
      console.log('Vendors configured successfully');
    } catch (error) {
      console.error('Failed to setup vendors:', error);
    }
  };
  
  // Now you can use market data methods
  const fetchPrice = async () => {
    const price = await getMarketPrice('AAPL');
    console.log('Current price:', price);
  };
}
```

#### Option B: Direct MarketData Usage

```typescript
import { marketData } from '@/lib/market-data';
import { createAlpacaVendor } from '@/lib/vendors/alpaca/AlpacaVendor';

// Initialize vendor
const alpacaVendor = createAlpacaVendor({
  apiKey: 'your-api-key',
  secretKey: 'your-secret-key'
});

// Set vendors in market data
marketData.setVendors([alpacaVendor], 'alpaca');
```

#### Option C: Using the Demo Page

1. Navigate to the Market Data Demo page
2. Enter your Alpaca API credentials
3. Click "Test Connection" - this automatically configures vendors
4. Use the "Get Price" button to test the setup

### 2. Basic Usage

```typescript
import { marketData } from '@/lib/market-data';
import { createAlpacaVendor } from '@/lib/vendors/alpaca/AlpacaVendor';

// Initialize vendor
const alpacaVendor = createAlpacaVendor({
  apiKey: 'your-api-key',
  secretKey: 'your-secret-key'
});

// Set vendors in market data
marketData.setVendors([alpacaVendor], 'alpaca');

// Fetch candles
const candles = await marketData.getCandles('AAPL', '1D');

// Calculate indicators
const sma = await marketData.getIndicator('AAPL', 'SMA', { window: 20 }, '1D');

// Fetch options
const option = await marketData.getOption('AAPL', { 
  expiry: '2025-02-15', 
  strike: 150 
});
```

### 2. Using with PortfolioContext

The system is integrated with PortfolioContext for easy access throughout the app:

```typescript
import { usePortfolio } from '@/contexts/PortfolioContext';

function MyComponent() {
  const { getMarketCandles, getMarketIndicator, getMarketOption } = usePortfolio();
  
  const handleFetchData = async () => {
    const candles = await getMarketCandles('AAPL', '1D');
    const sma = await getMarketIndicator('AAPL', 'SMA', { window: 20 }, '1D');
    const option = await getMarketOption('AAPL', { expiry: '2025-02-15', strike: 150 });
  };
}
```

## Adding New Vendors

### 1. Implement MarketDataVendor Interface

```typescript
import { MarketDataVendor } from '@/lib/vendors/base/MarketDataVendor';

export class MyVendor implements MarketDataVendor {
  name = 'my-vendor';
  priority = 2; // Lower number = higher priority

  isHealthy(): boolean {
    // Check if vendor is available
    return true;
  }

  async fetchCandles(ticker: string, timeframe: '1D' | '1W'): Promise<Candle[]> {
    // Implement candle fetching logic
    return [];
  }

  async fetchOption(ticker: string, key: { expiry: string; strike: number }): Promise<OptionsEntry> {
    // Implement option fetching logic
    return {
      asOf: new Date().toISOString(),
      expiry: key.expiry,
      strike: key.strike,
      spot: 0
    };
  }

  async getCurrentPrice(ticker: string): Promise<number> {
    // Implement current price fetching
    return 0;
  }

  async isTickerTradeable(ticker: string): Promise<boolean> {
    // Check if ticker is tradeable
    return true;
  }

  // Optional methods for advanced features
  getCapabilities?(): VendorCapabilities {
    return {
      supportsOptions: true,
      supportsRealTime: false,
      maxCandles: 200,
      supportedTimeframes: ['1D', '1W'],
      rateLimitPerMinute: 100,
      rateLimitPerDay: 1000
    };
  }

  getRateLimit?(): RateLimitInfo {
    return {
      requestsPerMinute: 100,
      requestsPerDay: 1000
    };
  }
}
```

### 2. Register with VendorFactory

```typescript
import { vendorFactory } from '@/lib/vendors/VendorFactory';

const myVendor = new MyVendor();
vendorFactory.registerVendor(myVendor, {
  name: 'my-vendor',
  priority: 2,
  enabled: true,
  config: { /* vendor-specific config */ }
});

// Set vendors in market data
marketData.setVendors([alpacaVendor, myVendor], 'alpaca');
```

## Configuration

### MarketData Configuration

```typescript
const config: MarketDataConfig = {
  optionsRetentionDays: 7, // Days to keep expired options
  candleFreshnessMinutes: {
    '1D': { marketHours: 1, afterHours: 30 },
    '1W': { marketHours: 24 * 60, afterHours: 24 * 60 }
  },
  optionsFreshnessMinutes: {
    marketHours: 5,
    afterHours: 60
  },
  returnStaleMarkers: false // Return stale data markers instead of stale data
};

const marketData = new MarketData(config);
```

### Vendor Configuration

```typescript
const alpacaConfig: AlpacaConfig = {
  apiKey: 'your-api-key',
  secretKey: 'your-secret-key',
  baseUrl: 'https://paper-api.alpaca.markets', // Optional
  dataUrl: 'https://data.alpaca.markets' // Optional
};
```

## Caching System

### How It Works

1. **Memory Cache**: Fast access to recently fetched data
2. **Database Cache**: Persistent storage in `tickers.market_data` JSONB column
3. **Freshness Checks**: Automatic staleness detection based on market hours
4. **Background Refresh**: Serves stale data immediately while refreshing in background

### Cache Management

```typescript
// Force refresh (bypass cache)
const freshCandles = await marketData.getCandles('AAPL', '1D', { forceRefresh: true });

// Check cache status
const cacheStatus = marketData.getCacheStatus();

// Clear cache
marketData.clearCache();
```

## Error Handling

### Built-in Error Types

- **MarketDataError**: General market data errors
- **StaleDataError**: When data is stale but served anyway
- **VendorError**: Vendor-specific errors

### Error Handling Example

```typescript
try {
  const candles = await marketData.getCandles('AAPL', '1D');
  // Handle success
} catch (error) {
  if (error instanceof StaleDataError) {
    // Data is stale but usable
    console.log('Using stale data:', error.data);
  } else if (error instanceof MarketDataError) {
    // Handle market data error
    console.error('Market data error:', error.message);
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

## Demo Page

The Market Data Demo page (`/market-data-demo`) provides an interactive interface to:

- Test vendor connections
- Fetch and display market data
- View cache status and performance
- Test error handling scenarios
- Experiment with different configurations

### Accessing the Demo

1. Navigate to the sidebar
2. Click "Market Data" 
3. Enter your Alpaca API credentials
4. Test the various features

## Performance Considerations

### Caching Strategy

- **Memory Cache**: Instant access for frequently used data
- **Database Cache**: Persistent storage across sessions
- **Background Refresh**: Non-blocking data updates
- **Intelligent Pruning**: Automatic cleanup of expired data

### Rate Limiting

- Respect vendor rate limits
- Implement exponential backoff
- Queue requests during high load
- Monitor usage patterns

### Memory Management

- Limit candle data to 200 per timeframe
- Prune expired options automatically
- Clean up unused cache entries
- Monitor memory usage

## Testing

### Unit Tests

```bash
# Run vendor tests
npm test -- src/lib/__tests__/alpaca-vendor.test.ts

# Run vendor factory tests
npm test -- src/lib/__tests__/vendor-factory.test.ts

# Run market data tests
npm test -- src/lib/__tests__/market-data.test.ts
```

### Integration Tests

```bash
# Run demo component tests
npm test -- src/components/__tests__/MarketDataDemo.test.tsx
```

## Troubleshooting

### Common Issues

#### "No vendors available. Please call setVendors() first."

**Cause**: The market data system has no vendors configured.

**Solutions**:
1. **Use PortfolioContext**: Call `setupMarketDataVendors(apiKey, secretKey)` first
2. **Use Demo Page**: Enter credentials and click "Test Connection"
3. **Direct Setup**: Call `marketData.setVendors([vendor], 'vendorName')` directly

**Example Fix**:
```typescript
// Before using market data methods
await setupMarketDataVendors(apiKey, secretKey);

// Now this will work
const price = await getMarketPrice('AAPL');
```

#### Empty Data Returned Without Errors

**Cause**: Vendors not configured, so system returns empty data silently.

**Solution**: Ensure vendors are set up before calling market data methods.

#### Authentication Errors

**Cause**: Invalid API credentials or network issues.

**Solution**: Verify credentials and network connectivity.

#### Other Common Issues

1. **API key errors**: Check vendor credentials and permissions
2. **Stale data warnings**: Normal behavior, data will refresh in background
3. **Rate limit exceeded**: Wait for rate limit reset or implement backoff

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
// Set debug mode in environment
process.env.DEBUG_MARKET_DATA = 'true';
```

### Health Checks

```typescript
// Check vendor health
const vendor = vendorFactory.getVendor('alpaca');
const health = vendor?.getHealth();
console.log('Vendor health:', health);

// Check system status
const stats = vendorFactory.getStats();
console.log('System stats:', stats);
```

## Future Extensions

### Planned Features

- **Real-time Data**: WebSocket support for live updates
- **More Vendors**: Polygon, IEX, Alpha Vantage integration
- **Advanced Indicators**: RSI, MACD, Bollinger Bands
- **Data Visualization**: Charts and graphs
- **Performance Analytics**: Detailed metrics and monitoring

### Contributing

To add new features or vendors:

1. Follow the existing patterns
2. Add comprehensive tests
3. Update documentation
4. Ensure backward compatibility
5. Test with the demo page

## Current Price Caching

The market data system now includes intelligent caching for current stock prices, providing fast access to real-time price data while minimizing API calls.

### Features

- **Memory Caching**: Current prices are cached in memory for instant access
- **Database Persistence**: Prices are persisted to the database for durability
- **Freshness Control**: Configurable freshness rules based on market hours
- **Background Refresh**: Stale data is served immediately while refreshing in background
- **Source Tracking**: Tracks whether price came from ask, bid, or last trade

### Configuration

Current price caching can be configured through the `MarketDataConfig`:

```typescript
const config: MarketDataConfig = {
  currentPriceFreshnessMinutes: {
    marketHours: 1,    // 1 minute during market hours
    afterHours: 30     // 30 minutes after market hours
  }
};
```

### Usage

```typescript
// Get current price (uses caching)
const price = await marketData.getCurrentPrice('AAPL');

// The system will:
// 1. Check memory cache first
// 2. If fresh, return cached price
// 3. If stale, return stale price and refresh in background
// 4. If not cached, fetch from vendor and cache result
```

### Freshness Rules

- **Market Hours (9:30 AM - 4:00 PM ET)**: 1 minute freshness
- **After Hours**: 30 minutes freshness
- **Stale Data**: Served immediately with background refresh

### Database Storage

Current prices are stored in the `tickers.market_data` JSONB column as part of the `MarketDataBlob`:

```typescript
interface MarketDataBlob {
  schemaVersion: number;
  asOf: string;
  candles: { [K in Timeframe]: CandleSeries };
  options: OptionsData;
  currentPrice?: CurrentPrice;  // New field
}

interface CurrentPrice {
  price: number;
  lastUpdated: string;
  source: 'ask' | 'bid' | 'last';
}
```

## API Reference

### MarketDataVendor Interface

```typescript
interface MarketDataVendor {
  name: string;
  priority: number;
  isHealthy(): boolean;
  getHealth?(): VendorHealth;
  fetchCandles(ticker: string, timeframe: '1D' | '1W'): Promise<Candle[]>;
  fetchOption(ticker: string, key: { expiry: string; strike: number }): Promise<OptionsEntry>;
  getCurrentPrice(ticker: string): Promise<number>;
  isTickerTradeable(ticker: string): Promise<boolean>;
  getCapabilities?(): VendorCapabilities;
  getRateLimit?(): RateLimitInfo;
  initialize?(config: Record<string, unknown>): Promise<void>;
  cleanup?(): Promise<void>;
}
```

### MarketData Class

```typescript
class MarketData {
  constructor(config?: MarketDataConfig);
  setVendors(vendors: MarketDataVendor[], preferredVendor?: string): void;
  getCandles(ticker: string, timeframe: '1D' | '1W', opts?: { forceRefresh?: boolean }): Promise<Candle[] | StaleCandleData>;
  getIndicator(ticker: string, indicator: 'SMA' | 'EMA', params: { window: number }, timeframe: '1D' | '1W'): Promise<number[]>;
  getOption(ticker: string, key: { expiry: string; strike: number }, opts?: { forceRefresh?: boolean }): Promise<OptionsEntry>;
  listOptionKeys(ticker: string): Promise<{ expiry: string; strike: number }[]>;
  primeFromDB(tickers: string[]): Promise<void>;
}
```

This guide provides everything needed to understand, use, and extend the Market Data System. For more specific examples, see the test files and demo page implementation.
