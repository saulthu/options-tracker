'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Activity } from "lucide-react";
import { MultiCurrencyBalanceInline } from '@/components/MultiCurrencyBalance';
import PnLChart from "@/components/PnLChart";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useAuth } from "@/contexts/AuthContext";

export default function OverviewPage() {
  const { user } = useAuth();
  const { transactions, getEpisodes, getBalance, getTotalPnL, loading } = usePortfolio();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-white text-xl">Loading portfolio...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-white text-xl">Please log in to view your portfolio</div>
      </div>
    );
  }

  // Calculate portfolio metrics using the new business logic
  const totalTrades = transactions.length;
  const episodes = getEpisodes();
  const openPositions = episodes.filter(ep => ep.qty !== 0).length;
  const cashBalances = getBalance(user.id);
  const realizedPnL = getTotalPnL(user.id);
  
  // Get recent transactions (last 5)
  const recentTransactions = transactions
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Summary Cards */}
      <div className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#b3b3b3]">Cash Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-[#b3b3b3]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                <MultiCurrencyBalanceInline 
                  balances={cashBalances} 
                  className="text-2xl font-bold"
                />
              </div>
              <p className="text-xs text-[#b3b3b3]">
                Available cash
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#b3b3b3]">Open Positions</CardTitle>
              <Activity className="h-4 w-4 text-[#b3b3b3]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{openPositions}</div>
              <p className="text-xs text-[#b3b3b3]">
                Active positions
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#b3b3b3]">Total Transactions</CardTitle>
              <TrendingUp className="h-4 w-4 text-[#b3b3b3]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{totalTrades}</div>
              <p className="text-xs text-[#b3b3b3]">
                All time transactions
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#b3b3b3]">Realized P&L</CardTitle>
              <TrendingUp className="h-4 w-4 text-[#b3b3b3]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                <MultiCurrencyBalanceInline 
                  balances={realizedPnL} 
                  className="text-2xl font-bold"
                />
              </div>
              <p className="text-xs text-[#b3b3b3]">
                Closed positions P&L
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts and Recent Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* P&L Chart */}
        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Portfolio Performance</CardTitle>
            <CardDescription>
              P&L over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PnLChart data={[]} />
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Transactions</CardTitle>
            <CardDescription>
              Latest trading activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 bg-[#2d2d2d] rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      transaction.side === 'BUY' ? 'bg-green-400' : 
                      transaction.side === 'SELL' ? 'bg-red-400' : 'bg-blue-400'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {transaction.instrument_kind === 'CASH' && transaction.memo?.includes('Forex')
                          ? `${transaction.qty > 0 ? 'Buy' : 'Sell'} ${transaction.currency}`
                          : `${transaction.instrument_kind} ${transaction.side || 'CASH'}`}
                        {transaction.tickers?.name && ` ${transaction.tickers.name}`}
                      </p>
                      <p className="text-xs text-[#b3b3b3]">
                        {new Date(transaction.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">
                      {transaction.instrument_kind === 'CASH' 
                        ? transaction.price?.multiply(transaction.qty).format() || `$${transaction.qty.toFixed(2)}`
                        : transaction.price ? transaction.price.multiply(transaction.qty).format() : '$0.00'
                      }
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {transaction.instrument_kind}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
