"use client";

import { useMemo } from "react";
import { TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeRange } from "./TimeRangeSelector";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useAuth } from "@/contexts/AuthContext";

interface SharesPageProps {
  selectedRange: TimeRange;
}

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

export default function SharesPage({ selectedRange }: SharesPageProps) {
  const { user } = useAuth();
  const { getFilteredPortfolio, loading, error } = usePortfolio();

  // Get filtered portfolio for the selected time range
  const filteredPortfolio = useMemo(() => {
    return getFilteredPortfolio(selectedRange);
  }, [getFilteredPortfolio, selectedRange]);

  // Calculate share positions from filtered portfolio
  const sharePositions = useMemo((): SharePosition[] => {
    if (!filteredPortfolio) return [];

    const positions: SharePosition[] = [];
    
    // Get all account IDs from the filtered portfolio
    const accountIds = [...new Set(Array.from(filteredPortfolio.positions.values()).map(pos => pos.accountId))];
    
    accountIds.forEach(accountId => {
      // Get positions for this account
      const accountPositions = Array.from(filteredPortfolio.positions.values()).filter(pos => 
        pos.accountId === accountId && pos.instrumentKind === 'SHARES'
      );
      
      accountPositions.forEach(position => {
        if (position.ticker) {
          // Calculate covered calls for this ticker
          const coveredCalls = Array.from(filteredPortfolio.positions.values())
            .filter(pos => 
              pos.accountId === accountId && 
              pos.instrumentKind === 'CALL' && 
              pos.ticker === position.ticker &&
              pos.qty < 0 // Short calls
            )
            .reduce((sum, pos) => sum + Math.abs(pos.qty), 0);

          positions.push({
            ticker: position.ticker,
            tickerId: position.ticker, // We'll need to get the actual ticker ID from transactions
            quantity: position.qty,
            costBasis: position.avgPrice,
            totalCost: position.qty * position.avgPrice,
            currentValue: position.qty * position.avgPrice, // Placeholder - will be replaced with real market data
            unrealizedPnL: 0, // Placeholder - will be calculated when we have market prices
            coveredCalls: coveredCalls
          });
        }
      });
    });

    return positions;
  }, [filteredPortfolio]);

  // Memoize expensive calculations
  const formatCurrency = useMemo(() => (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }, []);

  const formatPercentage = useMemo(() => (amount: number, total: number) => {
    if (total === 0) return '0.00%';
    return `${((amount / total) * 100).toFixed(2)}%`;
  }, []);

  const getPnLColor = useMemo(() => (pnl: number) => {
    if (pnl > 0) return 'text-green-400';
    if (pnl < 0) return 'text-red-400';
    return 'text-gray-400';
  }, []);

  const getCoverageStatus = useMemo(() => (quantity: number, coveredCalls: number) => {
    if (coveredCalls === 0) return { status: 'Uncovered', color: 'text-red-400', bgColor: 'bg-red-900/20' };
    if (coveredCalls >= quantity) return { status: 'Full', color: 'text-green-400', bgColor: 'bg-green-900/20' };
    return { status: 'Partial', color: 'text-yellow-400', bgColor: 'bg-yellow-900/20' };
  }, []);

  const rangeDescription = useMemo(() => {
    const startStr = selectedRange.startDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    const endStr = selectedRange.endDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    return `${startStr} - ${endStr}`;
  }, [selectedRange]);

  // Memoize totals calculation
  const totals = useMemo(() => {
    const totalCost = sharePositions.reduce((sum, position) => sum + position.totalCost, 0);
    const totalValue = sharePositions.reduce((sum, position) => sum + position.currentValue, 0);
    const totalPnL = sharePositions.reduce((sum, position) => sum + position.unrealizedPnL, 0);
    return { totalCost, totalValue, totalPnL };
  }, [sharePositions]);

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

  if (loading) {
    return (
      <div className="text-center py-8 text-[#b3b3b3]">
        <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Loading share positions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-[#b3b3b3]">
        <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-red-400">Error loading share positions</p>
        <p className="text-sm text-[#b3b3b3]">{error}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-8 text-[#b3b3b3]">
        <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Please log in to view your portfolio</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{formatCurrency(totals.totalCost)}</div>
            <p className="text-xs text-[#b3b3b3]">Total amount invested</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Current Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{formatCurrency(totals.totalValue)}</div>
            <p className="text-xs text-[#b3b3b3]">Current market value</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Unrealized P&L</CardTitle>
            <DollarSign className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPnLColor(totals.totalPnL)}`}>
              {totals.totalPnL >= 0 ? '+' : ''}{formatCurrency(totals.totalPnL)}
            </div>
            <p className="text-xs text-[#b3b3b3]">
              {formatPercentage(totals.totalPnL, totals.totalCost)} return
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
                Share positions grouped by ticker for {rangeDescription} ({selectedRange.scale})
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
              <p className="text-sm">No share trades found for {rangeDescription} ({selectedRange.scale})</p>
              <p className="text-xs mt-2">Try selecting a different date range or add some share trades</p>
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