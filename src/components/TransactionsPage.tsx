'use client';

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Activity, Filter } from "lucide-react";
import { TimeRange } from "./TimeRangeSelector";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useAuth } from "@/contexts/AuthContext";

interface TransactionsPageProps {
  selectedRange: TimeRange;
}

export default function TransactionsPage({ selectedRange }: TransactionsPageProps) {
  const { user } = useAuth();
  const { getFilteredTransactions, loading } = usePortfolio();

  // Get filtered transactions for the selected date range
  const filteredTransactions = getFilteredTransactions(selectedRange);

  // Memoize summary statistics
  const summaryStats = useMemo(() => {
    const totalTrades = filteredTransactions.length;
    const totalValue = filteredTransactions.reduce((sum, transaction) => {
      if (transaction.instrument_kind === 'CASH') {
        return sum + Math.abs(transaction.qty);
      } else {
        return sum + Math.abs((transaction.price || 0) * transaction.qty);
      }
    }, 0);
    const buyTrades = filteredTransactions.filter(transaction => transaction.side === 'BUY' || transaction.instrument_kind === 'CASH' && transaction.qty > 0).length;
    const sellTrades = filteredTransactions.filter(transaction => transaction.side === 'SELL' || transaction.instrument_kind === 'CASH' && transaction.qty < 0).length;
    
    return { totalTrades, totalValue, buyTrades, sellTrades };
  }, [filteredTransactions]);
  
  if (loading) {
    return (
      <div className="text-center text-[#b3b3b3] py-8">
        <div className="text-xl">Loading transactions...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center text-[#b3b3b3] py-8">
        <div className="text-xl">Please log in to view transactions</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Transaction Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Total Transactions</CardTitle>
            <Activity className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{summaryStats.totalTrades}</div>
            <p className="text-xs text-[#b3b3b3]">
              For {selectedRange.label}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Total Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${summaryStats.totalValue.toFixed(2)}</div>
            <p className="text-xs text-[#b3b3b3]">
              Transaction volume
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Buy Orders</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{summaryStats.buyTrades}</div>
            <p className="text-xs text-[#b3b3b3]">
              Purchases & deposits
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Sell Orders</CardTitle>
            <Filter className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{summaryStats.sellTrades}</div>
            <p className="text-xs text-[#b3b3b3]">
              Sales & withdrawals
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Table */}
      <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">All Transactions</CardTitle>
          <CardDescription>
            Complete transaction history for {selectedRange.label}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2d2d2d]">
                  <th className="text-left py-3 px-4 text-[#b3b3b3]">Date</th>
                  <th className="text-left py-3 px-4 text-[#b3b3b3]">Type</th>
                  <th className="text-left py-3 px-4 text-[#b3b3b3]">Action</th>
                  <th className="text-left py-3 px-4 text-[#b3b3b3]">Ticker</th>
                  <th className="text-left py-3 px-4 text-[#b3b3b3]">Price</th>
                  <th className="text-left py-3 px-4 text-[#b3b3b3]">Quantity</th>
                  <th className="text-left py-3 px-4 text-[#b3b3b3]">Value</th>
                  <th className="text-left py-3 px-4 text-[#b3b3b3]">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length > 0 ? (
                  filteredTransactions
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((transaction) => (
                      <tr key={transaction.id} className="border-b border-[#2d2d2d] hover:bg-[#2d2d2d]">
                        <td className="py-3 px-4 text-white">
                          {new Date(transaction.timestamp).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-white">{transaction.instrument_kind}</td>
                        <td className="py-3 px-4 text-white">{transaction.side || 'CASH'}</td>
                        <td className="py-3 px-4 text-white">
                          {transaction.ticker_id || "N/A"}
                        </td>
                        <td className="py-3 px-4 text-white">
                          {transaction.price ? `$${transaction.price.toFixed(2)}` : "N/A"}
                        </td>
                        <td className="py-3 px-4 text-white">{transaction.qty}</td>
                        <td className="py-3 px-4 text-white">
                          <span className={transaction.qty >= 0 ? "text-green-400" : "text-red-400"}>
                            {transaction.instrument_kind === 'CASH' 
                              ? `${transaction.qty >= 0 ? "+" : ""}$${transaction.qty.toFixed(2)}`
                              : `$${((transaction.price || 0) * transaction.qty).toFixed(2)}`
                            }
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">
                            {transaction.instrument_kind}
                          </Badge>
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 px-4 text-center text-[#b3b3b3]">
                      No transactions found for {selectedRange.label}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Transaction Types</CardTitle>
            <CardDescription>
              Breakdown by transaction type for {selectedRange.label}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {['CASH', 'SHARES', 'CALL', 'PUT'].map((type) => {
                const count = filteredTransactions.filter(transaction => transaction.instrument_kind === type).length;
                const percentage = summaryStats.totalTrades > 0 ? (count / summaryStats.totalTrades * 100).toFixed(1) : 0;
                return (
                  <div key={type} className="flex justify-between items-center p-3 bg-[#2d2d2d] rounded-lg">
                    <div>
                      <p className="font-medium text-white">{type}</p>
                      <p className="text-sm text-[#b3b3b3]">{count} transactions</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">{percentage}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
            <CardDescription>
              Latest transactions for {selectedRange.label}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredTransactions
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, 5)
                .map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 bg-[#2d2d2d] rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        transaction.side === 'BUY' || (transaction.instrument_kind === 'CASH' && transaction.qty > 0) ? 'bg-green-400' : 
                        transaction.side === 'SELL' || (transaction.instrument_kind === 'CASH' && transaction.qty < 0) ? 'bg-red-400' : 'bg-blue-400'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-white">
                          {transaction.instrument_kind} {transaction.side || 'CASH'}
                          {transaction.ticker_id && ` ${transaction.ticker_id}`}
                        </p>
                        <p className="text-xs text-[#b3b3b3]">
                          {new Date(transaction.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">
                        {transaction.instrument_kind === 'CASH' 
                          ? `$${Math.abs(transaction.qty).toFixed(2)}`
                          : `$${Math.abs((transaction.price || 0) * transaction.qty).toFixed(2)}`
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



