'use client';

import React, { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { TimeRange } from '@/components/TimeRangeSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Shield } from 'lucide-react';
import { CurrencyAmount, CurrencyCode } from '@/lib/currency-amount';
import { MultiCurrencyBalanceInline } from '@/components/MultiCurrencyBalance';
import { PositionEpisode } from '@/types/episodes';

interface SharesPageProps {
  selectedRange: TimeRange;
}

interface SharePosition {
  ticker: string;
  quantity: number;
  costBasis: CurrencyAmount;
  totalCost: CurrencyAmount;
  currentValue: CurrencyAmount;
  unrealizedPnL: CurrencyAmount;
  coveredCalls: number;
  realizedPnL: CurrencyAmount;
}

export default function SharesPage({ selectedRange }: SharesPageProps) {
  const { user } = useAuth();
  const { getFilteredEpisodes, getEpisodesByKind, loading, error } = usePortfolio();

  // Get filtered episodes for the selected time range
  const filteredEpisodes = useMemo(() => {
    return getFilteredEpisodes(selectedRange);
  }, [getFilteredEpisodes, selectedRange]);

  // Calculate share positions from episodes
  const sharePositions = useMemo((): SharePosition[] => {
    if (!filteredEpisodes) return [];

    const positions: SharePosition[] = [];
    
    // Get all share episodes
    const shareEpisodes = getEpisodesByKind('SHARES');
    
    // Group episodes by ticker
    const tickerGroups = new Map<string, typeof shareEpisodes>();
    
    shareEpisodes.forEach(episode => {
      if (episode.episodeKey && episode.episodeKey !== 'CASH') {
        const ticker = episode.episodeKey;
        if (!tickerGroups.has(ticker)) {
          tickerGroups.set(ticker, []);
        }
        tickerGroups.get(ticker)!.push(episode);
      }
    });
    
    // Calculate positions for each ticker
    tickerGroups.forEach((episodes, ticker) => {
      // Group episodes by currency to avoid mixing currencies
      const currencyGroups = new Map<CurrencyCode, PositionEpisode[]>();
      episodes.forEach(episode => {
        const currency = episode.avgPrice.currency;
        if (!currencyGroups.has(currency)) {
          currencyGroups.set(currency, []);
        }
        currencyGroups.get(currency)!.push(episode);
      });
      
      // Process each currency group separately
      currencyGroups.forEach((currencyEpisodes, currency) => {
        // Calculate total quantity and cost basis for this currency
        let totalQuantity = 0;
        let totalCost = CurrencyAmount.zero(currency);
        let totalRealizedPnL = CurrencyAmount.zero(currency);
        
        currencyEpisodes.forEach(episode => {
          totalQuantity += episode.qty;
          totalCost = totalCost.add(episode.avgPrice.multiply(episode.qty));
          totalRealizedPnL = totalRealizedPnL.add(episode.realizedPnLTotal);
        });
      
        // Calculate covered calls for this ticker and currency
        const optionEpisodes = getEpisodesByKind('OPTION');
        const coveredCalls = optionEpisodes
          .filter(episode => 
            episode.episodeKey?.startsWith(`${ticker}|`) &&
            episode.currentRight === 'CALL' &&
            episode.qty < 0 && // Short calls
            episode.avgPrice.currency === currency // Same currency
          )
          .reduce((sum, episode) => sum + Math.abs(episode.qty), 0);
        
        if (totalQuantity > 0) { // Only show long positions
          positions.push({
            ticker: `${ticker} (${currency})`, // Include currency in ticker name
            quantity: totalQuantity,
            costBasis: totalCost.divide(totalQuantity),
            totalCost,
            currentValue: totalCost, // Placeholder - will be replaced with real market data
            unrealizedPnL: CurrencyAmount.zero(currency), // Placeholder - will be calculated when we have market prices
            coveredCalls,
            realizedPnL: totalRealizedPnL
          });
        }
      });
    });

    return positions;
  }, [filteredEpisodes, getEpisodesByKind]);


  const formatNumber = useMemo(() => (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading share positions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <Card className="border-red-500">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-400 mb-4">Error loading share positions</p>
                <p className="text-gray-400 text-sm">{error}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-400">Please log in to view your share positions</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Calculate summary statistics - group by currency first
  const valueByCurrency = new Map<CurrencyCode, CurrencyAmount>();
  const unrealizedPnLByCurrency = new Map<CurrencyCode, CurrencyAmount>();
  const realizedPnLByCurrency = new Map<CurrencyCode, CurrencyAmount>();
  
  sharePositions.forEach(pos => {
    // Extract currency from ticker name (format: "TICKER (CURRENCY)")
    const currencyMatch = pos.ticker.match(/\(([A-Z]{3})\)$/);
    const currency = (currencyMatch ? currencyMatch[1] : 'USD') as CurrencyCode;
    
    // Add to currency groups
    if (valueByCurrency.has(currency)) {
      valueByCurrency.set(currency, valueByCurrency.get(currency)!.add(pos.currentValue));
      unrealizedPnLByCurrency.set(currency, unrealizedPnLByCurrency.get(currency)!.add(pos.unrealizedPnL));
      realizedPnLByCurrency.set(currency, realizedPnLByCurrency.get(currency)!.add(pos.realizedPnL));
    } else {
      valueByCurrency.set(currency, pos.currentValue);
      unrealizedPnLByCurrency.set(currency, pos.unrealizedPnL);
      realizedPnLByCurrency.set(currency, pos.realizedPnL);
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Share Positions</h1>
          <p className="text-gray-400 mt-2">
            Current holdings grouped by ticker with covered call information
          </p>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{sharePositions.length}</p>
                <p className="text-gray-400 text-sm">Total Positions</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
            <CardContent className="pt-6">
              <div className="text-center">
                <MultiCurrencyBalanceInline 
                  balances={valueByCurrency} 
                  className="text-2xl font-bold text-white"
                />
                <p className="text-gray-400 text-sm">Total Value</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
            <CardContent className="pt-6">
              <div className="text-center">
                <MultiCurrencyBalanceInline 
                  balances={unrealizedPnLByCurrency} 
                  className="text-2xl font-bold"
                />
                <p className="text-gray-400 text-sm">Unrealized P&L</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
            <CardContent className="pt-6">
              <div className="text-center">
                <MultiCurrencyBalanceInline 
                  balances={realizedPnLByCurrency} 
                  className="text-2xl font-bold"
                />
                <p className="text-gray-400 text-sm">Realized P&L</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Share Positions Table */}
        <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Share Positions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sharePositions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">No share positions found for the selected time period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2d2d2d]">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Ticker</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Quantity</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Cost Basis</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Total Cost</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Current Value</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Unrealized P&L</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Realized P&L</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Covered Calls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sharePositions.map((position, index) => (
                      <tr key={position.ticker} className={index % 2 === 0 ? 'bg-[#0f0f0f]' : ''}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{position.ticker}</span>
                            {position.coveredCalls > 0 && (
                              <Badge variant="outline" className="bg-blue-600 text-white border-blue-600 text-xs">
                                {position.coveredCalls} calls
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-white">
                          {formatNumber(position.quantity)}
                        </td>
                        <td className="py-3 px-4 text-right text-white">
                          {position.costBasis.format()}
                        </td>
                        <td className="py-3 px-4 text-right text-white">
                          {position.totalCost.format()}
                        </td>
                        <td className="py-3 px-4 text-right text-white">
                          {position.currentValue.format()}
                        </td>
                        <td className={`py-3 px-4 text-right ${position.unrealizedPnL.isPositive() ? 'text-green-400' : 'text-red-400'}`}>
                          {position.unrealizedPnL.format()}
                        </td>
                        <td className={`py-3 px-4 text-right ${position.realizedPnL.isPositive() ? 'text-green-400' : 'text-red-400'}`}>
                          {position.realizedPnL.format()}
                        </td>
                        <td className="py-3 px-4 text-right text-white">
                          {position.coveredCalls > 0 ? (
                            <div className="flex items-center justify-end gap-1">
                              <Shield className="w-4 h-4 text-blue-400" />
                              <span>{position.coveredCalls}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}