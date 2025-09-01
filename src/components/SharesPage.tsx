"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRange } from "./DateRangeSelector";
import PageHeader from "@/components/ui/page-header";
import { supabase } from "@/lib/supabase";


interface SharePosition {
  ticker: string;
  tickerId: string;
  quantity: number;
  costBasis: number;
  totalCost: number;
  currentValue: number;
  unrealizedPnL: number;
  coveredCalls: number;
}

interface SharesPageProps {
  selectedDateRange: DateRange;
}

export default function SharesPage({ selectedDateRange }: SharesPageProps) {
  const [sharePositions, setSharePositions] = useState<SharePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch share positions from database
  const fetchSharePositions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Calculate date range for filtering
      const now = new Date();
      let startDate: Date;
      const endDate: Date = now;

      switch (selectedDateRange) {
        case '7d': {
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        }
        case '30d': {
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 30);
          break;
        }
        case '90d': {
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 90);
          break;
        }
        case '1y': {
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        }
        case 'all': {
          startDate = new Date(0); // Beginning of time
          break;
        }
        case 'custom': {
          // For custom dates, we'll need to implement this when custom date picker is added
          startDate = new Date(0);
          break;
        }
        default: {
          // Default to current trading week (Saturday to Friday)
          startDate = new Date(now);
          // Find the most recent Saturday
          const daysSinceSaturday = (now.getDay() + 1) % 7;
          startDate.setDate(now.getDate() - daysSinceSaturday);
          break;
        }
      }

      // Format dates for Supabase query
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Fetch share trades for the user within the selected date range
      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select(`
          *,
          ticker:tickers(name)
        `)
        .eq('user_id', user.id)
        .eq('type', 'Shares')
        .gte('opened', startDateStr)
        .lte('opened', endDateStr)
        .order('opened', { ascending: true });

      console.log('Fetched trades:', trades);
      console.log('Date range:', startDateStr, 'to', endDateStr);

      if (tradesError) {
        throw new Error(`Error fetching trades: ${tradesError.message}`);
      }

      // Fetch covered call options to calculate coverage within the same date range
      const { data: coveredCalls, error: ccError } = await supabase
        .from('trades')
        .select('ticker_id, quantity')
        .eq('user_id', user.id)
        .eq('type', 'CC')
        .eq('action', 'Sell')
        .is('closed', null)
        .gte('opened', startDateStr)
        .lte('opened', endDateStr);

      if (ccError) {
        throw new Error(`Error fetching covered calls: ${ccError.message}`);
      }

      console.log('Fetched covered calls:', coveredCalls);

      // Group trades by ticker and calculate positions
      const positionsMap = new Map<string, SharePosition>();

      trades?.forEach((trade) => {
        const tickerName = (trade.ticker as { name: string })?.name;
        if (!tickerName) return;

        const existing = positionsMap.get(tickerName);
        const tradeValue = Math.abs(trade.value); // Use absolute value for calculations
        const isBuy = trade.action === 'Buy' || trade.action === 'Assigned';
        const isSell = trade.action === 'Sell' || trade.action === 'Called Away';

        if (existing) {
          if (isBuy) {
            // Add to position
            const newQuantity = existing.quantity + trade.quantity;
            const newTotalCost = existing.totalCost + tradeValue;
            existing.quantity = newQuantity;
            existing.totalCost = newTotalCost;
            existing.costBasis = newTotalCost / newQuantity;
          } else if (isSell) {
            // Reduce position (FIFO-like, but simplified)
            const newQuantity = Math.max(0, existing.quantity - trade.quantity);
            if (newQuantity === 0) {
              // Position closed, remove from map
              positionsMap.delete(tickerName);
            } else {
              // Adjust cost basis proportionally
              const remainingRatio = newQuantity / existing.quantity;
              existing.quantity = newQuantity;
              existing.totalCost = existing.totalCost * remainingRatio;
              existing.costBasis = existing.totalCost / newQuantity;
            }
          }
        } else if (isBuy) {
          // New position
          positionsMap.set(tickerName, {
            ticker: tickerName,
            tickerId: trade.ticker_id!,
            quantity: trade.quantity,
            costBasis: trade.price,
            totalCost: tradeValue,
            currentValue: 0, // Will be calculated later
            unrealizedPnL: 0, // Will be calculated later
            coveredCalls: 0
          });
        }
      });

      // Calculate covered calls for each position
      coveredCalls?.forEach((cc) => {
        if (cc.ticker_id) {
          // Find the position by ticker ID
          for (const position of positionsMap.values()) {
            if (position.tickerId === cc.ticker_id) {
              position.coveredCalls += cc.quantity;
              break;
            }
          }
        }
      });

      // Convert to array and calculate current values (placeholder for now)
      const positions = Array.from(positionsMap.values()).map(position => ({
        ...position,
        currentValue: position.totalCost, // Placeholder - will be replaced with real market data
        unrealizedPnL: 0 // Placeholder - will be calculated when we have market prices
      }));

      console.log('Calculated positions:', positions);
      setSharePositions(positions);
    } catch (err) {
      console.error('Error fetching share positions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [selectedDateRange]);

  // Fetch data on component mount
  useEffect(() => {
    fetchSharePositions();
  }, [fetchSharePositions]);

  // Refresh data when date range changes
  useEffect(() => {
    fetchSharePositions();
  }, [selectedDateRange, fetchSharePositions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (amount: number, total: number) => {
    if (total === 0) return '0.00%';
    return `${((amount / total) * 100).toFixed(2)}%`;
  };

  const getPnLColor = (pnl: number) => {
    if (pnl > 0) return 'text-green-400';
    if (pnl < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const handleBuyShares = (ticker?: string) => {
    if (ticker) {
      console.log(`Buy shares for ${ticker}`);
      // TODO: Open buy form for specific ticker
    } else {
      console.log('Buy shares (general)');
      // TODO: Open general buy form
    }
  };

  const handleSellShares = (ticker?: string) => {
    if (ticker) {
      console.log(`Sell shares for ${ticker}`);
      // TODO: Open sell form for specific ticker
    } else {
      console.log('Sell shares (general)');
      // TODO: Open general sell form
    }
  };

  const getCoverageStatus = (quantity: number, coveredCalls: number) => {
    if (coveredCalls === 0) return { status: 'Uncovered', color: 'text-red-400', bgColor: 'bg-red-900/20' };
    if (coveredCalls >= quantity) return { status: 'Full', color: 'text-green-400', bgColor: 'bg-green-900/20' };
    return { status: 'Partial', color: 'text-yellow-400', bgColor: 'bg-yellow-900/20' };
  };

  const getRangeDescription = (range: DateRange) => {
    const now = new Date();
    switch (range) {
      case '7d': {
        const startOfWeek = new Date(now);
        // Find the most recent Saturday
        const daysSinceSaturday = (now.getDay() + 1) % 7;
        startOfWeek.setDate(now.getDate() - daysSinceSaturday);
        return `${startOfWeek.toLocaleDateString()} - ${now.toLocaleDateString()}`;
      }
      case '30d': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return `${startOfMonth.toLocaleDateString()} - ${now.toLocaleDateString()}`;
      }
      case '90d': {
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        return `${threeMonthsAgo.toLocaleDateString()} - ${now.toLocaleDateString()}`;
      }
      case '1y': {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return `${startOfYear.toLocaleDateString()} - ${now.toLocaleDateString()}`;
      }
      case 'all': return 'All available data';
      case 'custom': return 'Custom date range';
      default: return '';
    }
  };

  // Calculate totals
  const totalCost = sharePositions.reduce((sum, position) => sum + position.totalCost, 0);
  const totalValue = sharePositions.reduce((sum, position) => sum + position.currentValue, 0);
  const totalPnL = sharePositions.reduce((sum, position) => sum + position.unrealizedPnL, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Share Positions"
          icon={TrendingUp}
          description={`Current holdings grouped by ticker for ${getRangeDescription(selectedDateRange)}`}
          selectedDateRange={selectedDateRange}
          onDateRangeChange={() => {}} // This will be handled by the parent component
          customStartDate=""
          customEndDate=""
          onCustomDateChange={() => {}}
        />
        <div className="text-center py-8 text-[#b3b3b3]">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Loading share positions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Share Positions"
          icon={TrendingUp}
          description={`Current holdings grouped by ticker for ${getRangeDescription(selectedDateRange)}`}
          selectedDateRange={selectedDateRange}
          onDateRangeChange={() => {}} // This will be handled by the parent component
          customStartDate=""
          customEndDate=""
          onCustomDateChange={() => {}}
        />
        <div className="text-center py-8 text-[#b3b3b3]">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-red-400">Error loading share positions</p>
          <p className="text-sm text-[#b3b3b3]">{error}</p>
          <button 
            onClick={fetchSharePositions}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Share Positions"
        icon={TrendingUp}
        description={`Current holdings grouped by ticker for ${getRangeDescription(selectedDateRange)}`}
        selectedDateRange={selectedDateRange}
        onDateRangeChange={() => {}} // This will be handled by the parent component
        customStartDate=""
        customEndDate=""
        onCustomDateChange={() => {}}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{formatCurrency(totalCost)}</div>
            <p className="text-xs text-[#b3b3b3]">Total amount invested</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Current Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-[#b3b3b3]">Current market value</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Unrealized P&L</CardTitle>
            <DollarSign className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPnLColor(totalPnL)}`}>
              {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
            </div>
            <p className="text-xs text-[#b3b3b3]">
              {formatPercentage(totalPnL, totalCost)} return
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Share Positions Table */}
      <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-white flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Positions
              </CardTitle>
              <CardDescription className="text-[#b3b3b3]">
                Share positions grouped by ticker for {getRangeDescription(selectedDateRange)}
              </CardDescription>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => handleBuyShares()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center space-x-2"
              >
                <span className="text-sm">Buy Shares</span>
              </button>
              <button
                onClick={() => handleSellShares()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex items-center space-x-2"
              >
                <span className="text-sm">Sell Shares</span>
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sharePositions.length === 0 ? (
            <div className="text-center py-8 text-[#b3b3b3]">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No share positions found</p>
              <p className="text-sm">No share trades found for {getRangeDescription(selectedDateRange)}</p>
              <p className="text-xs mt-2">Try selecting a different date range or add some share trades</p>
              <button 
                onClick={fetchSharePositions}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-sm"
              >
                Refresh Data
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#404040]">
                    <th className="text-left py-2 px-3 font-medium text-[#b3b3b3] text-sm">Ticker</th>
                    <th className="text-left py-2 px-3 font-medium text-[#b3b3b3] text-sm">Qty</th>
                    <th className="text-left py-2 px-3 font-medium text-[#b3b3b3] text-sm">Basis</th>
                    <th className="text-left py-2 px-3 font-medium text-[#b3b3b3] text-sm">Cost</th>
                    <th className="text-left py-2 px-3 font-medium text-[#b3b3b3] text-sm">Value</th>
                    <th className="text-left py-2 px-3 font-medium text-[#b3b3b3] text-sm">P&L</th>
                    <th className="text-left py-2 px-3 font-medium text-[#b3b3b3] text-sm">Return</th>
                    <th className="text-left py-2 px-3 font-medium text-[#b3b3b3] text-sm">CC</th>
                    <th className="text-left py-2 px-3 font-medium text-[#b3b3b3] text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sharePositions.map((position) => (
                    <tr key={position.ticker} className="border-b border-[#2d2d2d] hover:bg-[#2d2d2d] transition-colors">
                      <td className="py-2 px-3">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="w-4 h-4 text-blue-400" />
                          <span className="text-white font-semibold">{position.ticker}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-white">{position.quantity}</td>
                      <td className="py-2 px-3 text-white">{formatCurrency(position.costBasis)}</td>
                      <td className="py-2 px-3 text-white">{formatCurrency(position.totalCost)}</td>
                      <td className="py-2 px-3 text-white font-semibold">{formatCurrency(position.currentValue)}</td>
                      <td className="py-2 px-3">
                        <span className={`font-medium ${getPnLColor(position.unrealizedPnL)}`}>
                          {position.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(position.unrealizedPnL)}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`font-medium ${getPnLColor(position.unrealizedPnL)}`}>
                          {formatPercentage(position.unrealizedPnL, position.totalCost)}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {(() => {
                          const coverage = getCoverageStatus(position.quantity, position.coveredCalls);
                          return (
                            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${coverage.bgColor} ${coverage.color}`}>
                              {coverage.status}
                              {position.coveredCalls > 0 && (
                                <span className="ml-1 text-xs opacity-75">
                                  ({position.coveredCalls})
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleBuyShares(position.ticker)}
                            className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                          >
                            Buy
                          </button>
                          <button
                            onClick={() => handleSellShares(position.ticker)}
                            className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                          >
                            Sell
                          </button>
                        </div>
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
  );
}
