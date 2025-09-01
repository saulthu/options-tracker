"use client";

import { useState } from "react";
import { TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRange } from "./DateRangeSelector";
import PageHeader from "@/components/ui/page-header";

interface SharePosition {
  ticker: string;
  quantity: number;
  costBasis: number;
  totalCost: number;
  currentValue: number;
  unrealizedPnL: number;
}

interface SharesPageProps {
  selectedDateRange: DateRange;
}

export default function SharesPage({ selectedDateRange }: SharesPageProps) {
  const [sharePositions] = useState<SharePosition[]>([
    // Mock data - will be replaced with real data from database
    {
      ticker: "AAPL",
      quantity: 15,
      costBasis: 147.83,
      totalCost: 2217.45,
      currentValue: 2325.00,
      unrealizedPnL: 107.55
    },
    {
      ticker: "MSFT",
      quantity: 8,
      costBasis: 315.25,
      totalCost: 2522.00,
      currentValue: 2680.00,
      unrealizedPnL: 158.00
    },
    {
      ticker: "GOOGL",
      quantity: 5,
      costBasis: 128.50,
      totalCost: 642.50,
      currentValue: 675.00,
      unrealizedPnL: 32.50
    }
  ]);

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



  const getRangeDescription = (range: DateRange) => {
    const now = new Date();
    switch (range) {
      case '7d': {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
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
          <CardTitle className="text-white flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Current Positions
          </CardTitle>
          <CardDescription className="text-[#b3b3b3]">
            Share positions grouped by ticker for {getRangeDescription(selectedDateRange)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sharePositions.length === 0 ? (
            <div className="text-center py-8 text-[#b3b3b3]">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No share positions yet</p>
              <p className="text-sm">Your share positions will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#404040]">
                    <th className="text-left py-2 px-3 font-medium text-[#b3b3b3] text-sm">Ticker</th>
                    <th className="text-left py-2 px-3 font-medium text-[#b3b3b3] text-sm">Quantity</th>
                    <th className="text-left py-2 px-3 font-medium text-[#b3b3b3] text-sm">Cost Basis</th>
                    <th className="text-left py-2 px-3 font-medium text-[#b3b3b3] text-sm">Total Cost</th>
                    <th className="text-left py-2 px-3 font-medium text-[#b3b3b3] text-sm">Current Value</th>
                    <th className="text-left py-2 px-3 font-medium text-[#b3b3b3] text-sm">Unrealized P&L</th>
                    <th className="text-left py-2 px-3 font-medium text-[#b3b3b3] text-sm">Return %</th>
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
