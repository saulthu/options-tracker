'use client';

import React, { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { TimeRange } from '@/components/TimeRangeSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Shield } from 'lucide-react';
import { CurrencyAmount, CurrencyCode, isValidCurrencyCode } from '@/lib/currency-amount';

interface SharesPageProps {
  selectedRange: TimeRange;
}

interface SharePosition {
  ticker: string;
  quantity: number;
  costBasis: number;
  totalCost: number;
  currentValue: number;
  unrealizedPnL: number;
  coveredCalls: number;
  realizedPnL: number;
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
      // Calculate total quantity and cost basis
      let totalQuantity = 0;
      let totalCost = 0;
      let totalRealizedPnL = 0;
      
      episodes.forEach(episode => {
        totalQuantity += episode.qty;
        totalCost += episode.qty * episode.avgPrice;
        totalRealizedPnL += episode.realizedPnLTotal;
      });
      
      // Calculate covered calls for this ticker
      const optionEpisodes = getEpisodesByKind('OPTION');
      const coveredCalls = optionEpisodes
        .filter(episode => 
          episode.episodeKey?.startsWith(`${ticker}|`) &&
          episode.currentRight === 'CALL' &&
          episode.qty < 0 // Short calls
        )
        .reduce((sum, episode) => sum + Math.abs(episode.qty), 0);
      
      if (totalQuantity > 0) { // Only show long positions
        positions.push({
          ticker,
          quantity: totalQuantity,
          costBasis: totalCost / totalQuantity,
          totalCost,
          currentValue: totalCost, // Placeholder - will be replaced with real market data
          unrealizedPnL: 0, // Placeholder - will be calculated when we have market prices
          coveredCalls,
          realizedPnL: totalRealizedPnL
        });
      }
    });

    return positions;
  }, [filteredEpisodes, getEpisodesByKind]);

  // Memoize expensive calculations
  const formatCurrency = useMemo(() => (amount: number, currency: string = 'USD') => {
    if (!isValidCurrencyCode(currency)) {
      console.warn(`Invalid currency code: ${currency}, falling back to USD`);
      currency = 'USD';
    }
    return new CurrencyAmount(amount, currency as CurrencyCode).format();
  }, []);

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

  // Calculate summary statistics
  const totalValue = sharePositions.reduce((sum, pos) => sum + pos.currentValue, 0);
  const totalUnrealizedPnL = sharePositions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
  const totalRealizedPnL = sharePositions.reduce((sum, pos) => sum + pos.realizedPnL, 0);

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
                <p className="text-2xl font-bold text-white">{formatNumber(totalValue)}</p>
                <p className="text-gray-400 text-sm">Total Value</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className={`text-2xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(totalUnrealizedPnL)}
                </p>
                <p className="text-gray-400 text-sm">Unrealized P&L</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className={`text-2xl font-bold ${totalRealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(totalRealizedPnL)}
                </p>
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
                          {formatCurrency(position.costBasis)}
                        </td>
                        <td className="py-3 px-4 text-right text-white">
                          {formatCurrency(position.totalCost)}
                        </td>
                        <td className="py-3 px-4 text-right text-white">
                          {formatCurrency(position.currentValue)}
                        </td>
                        <td className={`py-3 px-4 text-right ${position.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(position.unrealizedPnL)}
                        </td>
                        <td className={`py-3 px-4 text-right ${position.realizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(position.realizedPnL)}
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