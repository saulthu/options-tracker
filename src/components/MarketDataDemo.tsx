'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { Candle, OptionsEntry } from '@/types/market-data';
import { createAlpacaVendor } from '@/lib/vendors/alpaca/AlpacaVendor';

interface ErrorLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'error' | 'warning' | 'info';
}

interface CacheStatus {
  ticker: string;
  timeframe: string;
  lastUpdated: string;
  candleCount: number;
  isFresh: boolean;
}

export default function MarketDataDemo() {
  const { getMarketIndicator, getMarketOption, getMarketCandlesWithSource, getMarketPriceWithSource, clearMarketCache, listMarketOptionKeys, setupMarketDataVendors } = usePortfolio();
  
  // Form state
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [ticker, setTicker] = useState('AAPL');
  const [dataPlan, setDataPlan] = useState<'free' | 'pro'>('free');
  const [timeframe, setTimeframe] = useState<'1D' | '1W'>('1D');
  const [expiry, setExpiry] = useState('');
  const [strike, setStrike] = useState('');
  
  // Data state
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicators, setIndicators] = useState<number[]>([]);
  const [options, setOptions] = useState<OptionsEntry | null>(null);
  const [optionKeys, setOptionKeys] = useState<{ expiry: string; strike: number }[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [errorLog, setErrorLog] = useState<ErrorLog[]>([]);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus[]>([]);
  const [vendorStatus, setVendorStatus] = useState<{
    name: string;
    healthy: boolean;
    capabilities?: {
      supportsOptions: boolean;
      supportsRealTime: boolean;
      maxCandles: number;
      supportedTimeframes: string[];
      rateLimitPerMinute: number;
      rateLimitPerDay: number;
    };
    priority: number;
  } | null>(null);
  
  // Add error to log
  const addError = useCallback((message: string, type: ErrorLog['type'] = 'error') => {
    const error: ErrorLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      message,
      type
    };
    setErrorLog(prev => [error, ...prev.slice(0, 49)]); // Keep last 50 errors
  }, []);

  // Load saved credentials on mount and set up vendors
  useEffect(() => {
    const savedApiKey = localStorage.getItem('alpaca_api_key');
    const savedSecretKey = localStorage.getItem('alpaca_secret_key');
    const savedPlan = (localStorage.getItem('alpaca_data_plan') as 'free' | 'pro') || 'free';
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedSecretKey) setSecretKey(savedSecretKey);
    setDataPlan(savedPlan);
    
    // If we have both credentials, set up vendors automatically
    if (savedApiKey && savedSecretKey) {
      const setupVendors = async () => {
        try {
          const alpacaVendor = createAlpacaVendor({
            apiKey: savedApiKey,
            secretKey: savedSecretKey,
            dataPlan
          });
          
          await setupMarketDataVendors(savedApiKey, savedSecretKey, dataPlan);
          
          setVendorStatus({
            name: alpacaVendor.name,
            healthy: alpacaVendor.isHealthy(),
            capabilities: alpacaVendor.getCapabilities?.(),
            priority: alpacaVendor.priority
          });
          
          addError('Vendors configured from saved credentials!', 'info');
        } catch (error) {
          addError(`Failed to setup vendors: ${error instanceof Error ? error.message : 'Unknown error'}`, 'warning');
        }
      };
      
      setupVendors();
    }
  }, [addError, setupMarketDataVendors, dataPlan]);

  // Test vendor connection
  const testConnection = useCallback(async () => {
    if (!apiKey || !secretKey) {
      addError('Please enter both API key and secret key', 'warning');
      return;
    }

    setLoading(true);
    try {
      const alpacaVendor = createAlpacaVendor({
        apiKey,
        secretKey,
        dataPlan
      });

      // Test with a simple request
      const isHealthy = alpacaVendor.isHealthy();
      const capabilities = alpacaVendor.getCapabilities?.();
      
      setVendorStatus({
        name: alpacaVendor.name,
        healthy: isHealthy,
        capabilities,
        priority: alpacaVendor.priority
      });

      if (isHealthy) {
        addError('Connection successful!', 'info');
        // Save credentials
        localStorage.setItem('alpaca_api_key', apiKey);
        localStorage.setItem('alpaca_secret_key', secretKey);
        localStorage.setItem('alpaca_data_plan', dataPlan);
        
        // Set vendors in the market data instance
        await setupMarketDataVendors(apiKey, secretKey, dataPlan);
        addError('Vendors configured for market data!', 'info');
      } else {
        addError('Connection failed - vendor not healthy', 'error');
      }
    } catch (error) {
      addError(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [apiKey, secretKey, dataPlan, addError, setupMarketDataVendors]);

  // Fetch candles
  const fetchCandles = useCallback(async (forceRefresh = false) => {
    if (!ticker) {
      addError('Please enter a ticker symbol', 'warning');
      return;
    }

    setLoading(true);
    try {
      const result = await getMarketCandlesWithSource(ticker, timeframe, forceRefresh);
      
      setCandles(result.data);
      const sourceInfo = result.source.cached ? 'cached' : 'fresh';
      const sourceType = result.source.source === 'memory' ? 'memory cache' : 
                        result.source.source === 'database' ? 'database cache' : 
                        'API vendor';
      addError(`Fetched ${result.data.length} candles for ${ticker} from ${sourceType} (${sourceInfo})`, 'info');
      
      // Update cache status
      setCacheStatus(prev => {
        const existing = prev.find(c => c.ticker === ticker && c.timeframe === timeframe);
        if (existing) {
          existing.lastUpdated = new Date().toISOString();
          existing.candleCount = Array.isArray(result) ? result.length : result.data.length;
          existing.isFresh = Array.isArray(result);
        } else {
          prev.push({
            ticker,
            timeframe,
            lastUpdated: new Date().toISOString(),
            candleCount: Array.isArray(result) ? result.length : result.data.length,
            isFresh: Array.isArray(result)
          });
        }
        return [...prev];
      });
    } catch (error) {
      addError(`Failed to fetch candles: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [ticker, timeframe, getMarketCandlesWithSource, addError]);

  // Fetch current price
  const fetchPrice = useCallback(async () => {
    if (!ticker) {
      addError('Please enter a ticker symbol', 'warning');
      return;
    }

    setLoading(true);
    try {
      const result = await getMarketPriceWithSource(ticker);
      setCurrentPrice(result.data);
      const sourceInfo = result.source.cached ? 'cached' : 'fresh';
      const sourceType = result.source.source === 'memory' ? 'memory cache' : 
                        result.source.source === 'database' ? 'database cache' : 
                        'API vendor';
      addError(`Current price for ${ticker}: $${result.data.toFixed(2)} from ${sourceType} (${sourceInfo})`, 'info');
    } catch (error) {
      addError(`Failed to fetch price: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [ticker, getMarketPriceWithSource, addError]);

  // Fetch indicators
  const fetchIndicators = useCallback(async () => {
    if (!ticker) {
      addError('Please enter a ticker symbol', 'warning');
      return;
    }

    setLoading(true);
    try {
      const sma = await getMarketIndicator(ticker, 'SMA', { window: 20 }, timeframe);
      setIndicators(sma);
      addError(`Calculated SMA(20) for ${ticker}: ${sma.length} values`, 'info');
    } catch (error) {
      addError(`Failed to calculate indicators: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [ticker, timeframe, getMarketIndicator, addError]);

  // Fetch options
  const fetchOptions = useCallback(async () => {
    if (!ticker || !expiry || !strike) {
      addError('Please enter ticker, expiry, and strike', 'warning');
      return;
    }

    setLoading(true);
    try {
      const option = await getMarketOption(ticker, { expiry, strike: parseFloat(strike) });
      setOptions(option);
      if (option) {
        addError(`Fetched option data for ${ticker} ${expiry}@${strike}`, 'info');
      } else {
        addError(`No option data found for ${ticker} ${expiry}@${strike}`, 'warning');
      }
    } catch (error) {
      addError(`Failed to fetch options: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [ticker, expiry, strike, getMarketOption, addError]);

  // List option keys
  const listOptions = useCallback(async () => {
    if (!ticker) {
      addError('Please enter a ticker symbol', 'warning');
      return;
    }

    setLoading(true);
    try {
      const keys = await listMarketOptionKeys(ticker);
      setOptionKeys(keys);
      addError(`Found ${keys.length} option keys for ${ticker}`, 'info');
    } catch (error) {
      addError(`Failed to list options: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [ticker, listMarketOptionKeys, addError]);

  // Clear cache
  const clearCache = useCallback(async () => {
    if (!ticker) {
      addError('Please enter a ticker symbol', 'warning');
      return;
    }

    try {
      // Clear the actual market data cache (memory + database)
      await clearMarketCache(ticker);
      
      // Clear UI state
      setCandles([]);
      setIndicators([]);
      setOptions(null);
      setOptionKeys([]);
      setCurrentPrice(null);
      setCacheStatus([]);
      
      addError(`Cache cleared for ${ticker} (memory + database)`, 'info');
    } catch (error) {
      addError(`Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [ticker, clearMarketCache, addError]);

  return (
    <div className="space-y-8">
      {/* API Configuration */}
        <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">API Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#b3b3b3] mb-2">
                Alpaca API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#2d2d2d] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter API key"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#b3b3b3] mb-2">
                Alpaca Secret Key
              </label>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#2d2d2d] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter secret key"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#b3b3b3] mb-2">
                Alpaca Plan
              </label>
              <select
                value={dataPlan}
                onChange={(e) => setDataPlan(e.target.value as 'free' | 'pro')}
                className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#2d2d2d] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="free">Free (IEX, no recent SIP)</option>
                <option value="pro">Pro (SIP, extended/recent)</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={testConnection}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
          {vendorStatus && (
            <div className="mt-4 p-3 bg-[#0f0f0f] rounded-md">
              <h3 className="text-sm font-medium text-white mb-2">Vendor Status</h3>
              <div className="text-sm text-[#b3b3b3] space-y-1">
                <div>Name: {vendorStatus.name}</div>
                <div>Healthy: {vendorStatus.healthy ? '✅' : '❌'}</div>
                <div>Priority: {vendorStatus.priority}</div>
                {vendorStatus.capabilities && (
                  <div>
                    Capabilities: {JSON.stringify(vendorStatus.capabilities, null, 2)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Data Input */}
        <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Data Input</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#b3b3b3] mb-2">
                Ticker Symbol
              </label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#2d2d2d] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., AAPL"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#b3b3b3] mb-2">
                Timeframe
              </label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as '1D' | '1W')}
                className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#2d2d2d] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1D">1 Day</option>
                <option value="1W">1 Week</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#b3b3b3] mb-2">
                Expiry (YYYY-MM-DD)
              </label>
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#2d2d2d] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#b3b3b3] mb-2">
                Strike Price
              </label>
              <input
                type="number"
                value={strike}
                onChange={(e) => setStrike(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#2d2d2d] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 150"
                step="0.01"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Actions</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={fetchPrice}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              Get Price
            </button>
            <button
              onClick={() => fetchCandles(false)}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Fetch Candles
            </button>
            <button
              onClick={() => fetchCandles(true)}
              disabled={loading}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
            >
              Force Refresh
            </button>
            <button
              onClick={fetchIndicators}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Calculate SMA(20)
            </button>
            <button
              onClick={fetchOptions}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              Fetch Option
            </button>
            <button
              onClick={listOptions}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              List Options
            </button>
            <button
              onClick={clearCache}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Clear Cache
            </button>
          </div>
        </div>

        {/* Data Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Current Price */}
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Current Price</h2>
            {currentPrice !== null ? (
              <div className="text-center">
                <div className="text-4xl font-bold text-emerald-400 mb-2">
                  ${currentPrice.toFixed(2)}
                </div>
                <div className="text-sm text-[#b3b3b3]">
                  {ticker} - {new Date().toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <p className="text-[#b3b3b3] text-center">No price data</p>
            )}
          </div>

          {/* Candles */}
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Candles ({candles.length})</h2>
            <div className="max-h-96 overflow-y-auto">
              {candles.length > 0 ? (
                <div className="space-y-2">
                  {candles.slice(-10).map((candle, index) => (
                    <div key={index} className="text-sm text-[#b3b3b3] p-2 bg-[#0f0f0f] rounded">
                      <div>Time: {candle.t}</div>
                      <div>O: {candle.o} H: {candle.h} L: {candle.l} C: {candle.c}</div>
                      <div>Volume: {candle.v}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#b3b3b3]">No candle data</p>
              )}
            </div>
          </div>

          {/* Indicators */}
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">SMA(20) ({indicators.length})</h2>
            <div className="max-h-96 overflow-y-auto">
              {indicators.length > 0 ? (
                <div className="space-y-1">
                  {indicators.slice(-20).map((value, index) => (
                    <div key={index} className="text-sm text-[#b3b3b3] p-1 bg-[#0f0f0f] rounded">
                      {value.toFixed(2)}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#b3b3b3]">No indicator data</p>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Option Data</h2>
            {options ? (
              <div className="text-sm text-[#b3b3b3] space-y-2">
                <div>As Of: {options.asOf}</div>
                <div>Expiry: {options.expiry}</div>
                <div>Strike: {options.strike}</div>
                <div>Spot: {options.spot}</div>
                {options.call && (
                  <div>
                    Call: Bid {options.call.bid} Ask {options.call.ask}
                  </div>
                )}
                {options.put && (
                  <div>
                    Put: Bid {options.put.bid} Ask {options.put.ask}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[#b3b3b3]">No option data</p>
            )}
          </div>

          {/* Option Keys */}
          <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Option Keys ({optionKeys.length})</h2>
            <div className="max-h-96 overflow-y-auto">
              {optionKeys.length > 0 ? (
                <div className="space-y-1">
                  {optionKeys.slice(0, 20).map((key, index) => (
                    <div key={index} className="text-sm text-[#b3b3b3] p-1 bg-[#0f0f0f] rounded">
                      {key.expiry} @ {key.strike}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#b3b3b3]">No option keys</p>
              )}
            </div>
          </div>
        </div>

        {/* Cache Status */}
        <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Cache Status</h2>
          <div className="space-y-2">
            {cacheStatus.length > 0 ? (
              cacheStatus.map((status, index) => (
                <div key={index} className="text-sm text-[#b3b3b3] p-2 bg-[#0f0f0f] rounded flex justify-between">
                  <span>{status.ticker} {status.timeframe}</span>
                  <span>
                    {status.candleCount} candles | {status.isFresh ? 'Fresh' : 'Stale'} | {status.lastUpdated}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[#b3b3b3]">No cached data</p>
            )}
          </div>
        </div>

        {/* Error Log */}
        <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Error Log</h2>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {errorLog.length > 0 ? (
              errorLog.map((error) => (
                <div key={error.id} className={`text-sm p-2 rounded ${
                  error.type === 'error' ? 'bg-red-900/20 text-red-400' :
                  error.type === 'warning' ? 'bg-yellow-900/20 text-yellow-400' :
                  'bg-blue-900/20 text-blue-400'
                }`}>
                  <div className="font-mono text-xs opacity-75">{error.timestamp}</div>
                  <div>{error.message}</div>
                </div>
              ))
            ) : (
              <p className="text-[#b3b3b3]">No errors</p>
            )}
          </div>
        </div>
    </div>
  );
}
