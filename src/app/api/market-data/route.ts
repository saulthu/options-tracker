// Market Data API Route
// Handles server-side market data requests to avoid client-side API key exposure

import { NextRequest, NextResponse } from 'next/server';
import { createAlpacaVendor } from '@/lib/vendors/alpaca';

// Server-side Alpaca configuration
const alpacaConfig = {
  apiKey: process.env.ALPACA_API_KEY || '',
  secretKey: process.env.ALPACA_SECRET_KEY || '',
  baseUrl: process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
  dataUrl: process.env.ALPACA_DATA_URL || 'https://data.alpaca.markets'
};

// Initialize Alpaca vendor
const alpacaVendor = createAlpacaVendor(alpacaConfig);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const ticker = searchParams.get('ticker');
    const timeframe = searchParams.get('timeframe');
    const expiry = searchParams.get('expiry');
    const strike = searchParams.get('strike');

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    switch (type) {
      case 'candles':
        if (!timeframe) {
          return NextResponse.json({ error: 'Timeframe is required for candles' }, { status: 400 });
        }
        
        const candles = await alpacaVendor.fetchCandles(ticker, timeframe as '1D' | '1W', 200);
        return NextResponse.json(candles);

      case 'option':
        if (!expiry || !strike) {
          return NextResponse.json({ error: 'Expiry and strike are required for options' }, { status: 400 });
        }
        
        const option = await alpacaVendor.fetchOption(ticker, {
          expiry,
          strike: parseFloat(strike)
        });
        return NextResponse.json(option);

      case 'price':
        const price = await alpacaVendor.getCurrentPrice(ticker);
        return NextResponse.json({ price });

      case 'tradeable':
        const isTradeable = await alpacaVendor.isTickerTradeable(ticker);
        return NextResponse.json({ tradeable: isTradeable });

      default:
        return NextResponse.json({ error: 'Invalid type. Use: candles, option, price, or tradeable' }, { status: 400 });
    }

  } catch (error) {
    console.error('Market data API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }
}
