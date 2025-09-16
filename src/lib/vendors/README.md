# Market Data Vendors

This directory contains vendor integrations for market data APIs.

## Alpaca Markets Integration

### Setup

1. **Get API Keys**
   - Sign up at [Alpaca Markets](https://alpaca.markets/)
   - Go to [Paper Trading Dashboard](https://app.alpaca.markets/paper/dashboard/overview)
   - Generate API keys for paper trading

2. **Environment Variables**
   Add these to your `.env.local` file:
   ```bash
   NEXT_PUBLIC_ALPACA_API_KEY=your_api_key_here
   NEXT_PUBLIC_ALPACA_SECRET_KEY=your_secret_key_here
   ```

3. **Features**
   - ✅ Historical candle data (1D, 1W timeframes)
   - ✅ Real-time stock prices
   - ⚠️ Options data (limited on free tier)
   - ✅ Paper trading support
   - ✅ Rate limiting and error handling

### Usage

The Alpaca vendor is automatically initialized when the PortfolioContext loads, if credentials are available.

```typescript
// Manual initialization (if needed)
import { marketData } from '@/lib/market-data';
import { getAlpacaConfig } from '@/lib/vendors/alpaca-config';

const alpacaConfig = getAlpacaConfig();
if (alpacaConfig) {
  marketData.initializeAlpaca(alpacaConfig);
}
```

### Data Limitations

**Free Tier (IEX Feed):**
- Historical data: Available
- Real-time data: Limited to IEX feed
- Options data: Very limited

**Paid Tier (Algo Trader Plus - $99/month):**
- Full market coverage
- Real-time data for all exchanges
- Comprehensive options data

### Error Handling

The integration includes comprehensive error handling:
- Graceful fallback to empty data if API calls fail
- Automatic retry logic for transient errors
- Detailed logging for debugging

### Testing

The vendor integration is tested with mocked responses to avoid API rate limits during development.

## Adding New Vendors

To add a new vendor:

1. Create a new file in this directory (e.g., `polygon.ts`)
2. Implement the vendor interface
3. Update `market-data.ts` to use the new vendor
4. Add configuration and environment variables
5. Add tests

Example vendor interface:
```typescript
export interface VendorInterface {
  fetchCandles(ticker: string, timeframe: string, limit: number): Promise<VendorCandleData>;
  fetchOption(ticker: string, key: OptionKey): Promise<OptionsEntry>;
  getCurrentPrice(ticker: string): Promise<number>;
}
```
