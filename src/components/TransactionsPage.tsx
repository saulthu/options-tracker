'use client';

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, Activity, Building2 } from "lucide-react";
import { TimeRange } from "./TimeRangeSelector";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useAuth } from "@/contexts/AuthContext";
import { Transaction } from "@/types/database";

interface TransactionsPageProps {
  selectedRange: TimeRange;
}

interface TransactionWithDetails extends Transaction {
  tickers?: {
    id: string;
    name: string;
    icon?: string;
  };
  accounts?: {
    id: string;
    name: string;
    type: string;
    institution: string;
  };
  cashDelta?: number;
  balanceAfter?: number;
}

interface AccountTransactions {
  account: {
    id: string;
    name: string;
    type: string;
    institution: string;
  };
  transactions: TransactionWithDetails[];
  runningBalance: number;
}

export default function TransactionsPage({ selectedRange }: TransactionsPageProps) {
  const { user } = useAuth();
  const { getFilteredTransactions, loading } = usePortfolio();

  // Get filtered transactions for the selected date range
  const filteredTransactions = getFilteredTransactions(selectedRange) as TransactionWithDetails[];

  // Debug logging for date filtering
  console.log('Date filtering debug:', {
    selectedRange: {
      start: selectedRange.startDate.toISOString(),
      end: selectedRange.endDate.toISOString()
    },
    filteredCount: filteredTransactions.length,
    sampleTransactions: filteredTransactions.slice(0, 3).map(tx => ({
      id: tx.id,
      timestamp: tx.timestamp,
      parsedDate: new Date(tx.timestamp).toISOString(),
      instrument: tx.instrument_kind
    }))
  });

  // Group transactions by account and calculate running balances
  const accountTransactions = useMemo((): AccountTransactions[] => {
    if (!filteredTransactions.length) return [];

    // Group by account
    const grouped = filteredTransactions.reduce((acc, transaction) => {
      const accountId = transaction.account_id;
      if (!acc[accountId]) {
        acc[accountId] = {
          account: transaction.accounts || {
            id: accountId,
            name: 'Unknown Account',
            type: 'Unknown',
            institution: 'Unknown'
          },
          transactions: [],
          runningBalance: 0
        };
      }
      acc[accountId].transactions.push(transaction);
      return acc;
    }, {} as Record<string, AccountTransactions>);

    // Sort transactions by timestamp and calculate running balances
    return Object.values(grouped).map(accountData => {
      // Sort transactions by timestamp
      const sortedTransactions = accountData.transactions.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Calculate running balance for each transaction
      let runningBalance = 0;
      const transactionsWithBalance = sortedTransactions.map(transaction => {
        // Calculate cash delta for this transaction
        let cashDelta = 0;
        
        if (transaction.instrument_kind === 'CASH') {
          // Cash transactions: qty is the cash amount
          cashDelta = transaction.qty;
        } else if (transaction.side === 'BUY') {
          // Buying shares/options: negative cash flow
          const totalCost = (transaction.price || 0) * transaction.qty;
          cashDelta = -(totalCost + transaction.fees);
        } else if (transaction.side === 'SELL') {
          // Selling shares/options: positive cash flow
          const totalProceeds = (transaction.price || 0) * transaction.qty;
          cashDelta = totalProceeds - transaction.fees;
        }

        runningBalance += cashDelta;

        return {
          ...transaction,
          cashDelta,
          balanceAfter: runningBalance
        };
      });

      return {
        ...accountData,
        transactions: transactionsWithBalance,
        runningBalance
      };
    });
  }, [filteredTransactions]);

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
    const buyTrades = filteredTransactions.filter(transaction => 
      transaction.side === 'BUY' || (transaction.instrument_kind === 'CASH' && transaction.qty > 0)
    ).length;
    const sellTrades = filteredTransactions.filter(transaction => 
      transaction.side === 'SELL' || (transaction.instrument_kind === 'CASH' && transaction.qty < 0)
    ).length;
    
    return { totalTrades, totalValue, buyTrades, sellTrades };
  }, [filteredTransactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };


  const getInstrumentDisplay = (transaction: TransactionWithDetails) => {
    if (transaction.instrument_kind === 'CASH') {
      return 'Cash';
    }
    
    const ticker = transaction.tickers?.name || 'Unknown';
    const side = transaction.side || '';
    const kind = transaction.instrument_kind;
    
    if (kind === 'SHARES') {
      return `${side} ${ticker}`;
    } else if (kind === 'CALL' || kind === 'PUT') {
      const strike = transaction.strike ? `$${transaction.strike}` : '';
      const expiry = transaction.expiry ? new Date(transaction.expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      return `${side} ${ticker} ${kind} ${strike} ${expiry}`.trim();
    }
    
    return `${side} ${kind}`;
  };

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
      {/* Debug Information */}
      <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
        <CardHeader>
          <CardTitle className="text-sm text-[#b3b3b3]">Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            <div>
              <span className="text-[#b3b3b3]">Date Range: </span>
              <span className="text-white">
                {selectedRange.startDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })} - {selectedRange.endDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            <div>
              <span className="text-[#b3b3b3]">ISO Range: </span>
              <span className="text-white font-mono text-xs">
                {selectedRange.startDate.toISOString()} to {selectedRange.endDate.toISOString()}
              </span>
            </div>
            <div>
              <span className="text-[#b3b3b3]">Filtered Transactions: </span>
              <span className="text-white">{filteredTransactions.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Total Trades</CardTitle>
            <Activity className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{summaryStats.totalTrades}</div>
            <p className="text-xs text-[#b3b3b3]">In selected period</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(summaryStats.totalValue)}
            </div>
            <p className="text-xs text-[#b3b3b3]">Transaction volume</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Buy Trades</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{summaryStats.buyTrades}</div>
            <p className="text-xs text-[#b3b3b3]">Purchases & deposits</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Sell Trades</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{summaryStats.sellTrades}</div>
            <p className="text-xs text-[#b3b3b3]">Sales & withdrawals</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Transactions Table
          </CardTitle>
          <CardDescription>
            All transactions in the selected time period with running balances
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accountTransactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-lg text-[#b3b3b3]">No transactions found</div>
              <div className="text-sm text-[#b3b3b3] mt-2">Try adjusting your time range or add some transactions</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2d2d2d]">
                    <th className="text-left py-3 px-2 text-[#b3b3b3] font-medium">Account</th>
                    <th className="text-left py-3 px-2 text-[#b3b3b3] font-medium">DateTime</th>
                    <th className="text-left py-3 px-2 text-[#b3b3b3] font-medium">Type</th>
                    <th className="text-left py-3 px-2 text-[#b3b3b3] font-medium">Instrument</th>
                    <th className="text-right py-3 px-2 text-[#b3b3b3] font-medium">Qty</th>
                    <th className="text-right py-3 px-2 text-[#b3b3b3] font-medium">Price</th>
                    <th className="text-right py-3 px-2 text-[#b3b3b3] font-medium">Fees</th>
                    <th className="text-right py-3 px-2 text-[#b3b3b3] font-medium">Cash Delta</th>
                    <th className="text-right py-3 px-2 text-[#b3b3b3] font-medium">Balance</th>
                    <th className="text-left py-3 px-2 text-[#b3b3b3] font-medium">Memo</th>
                  </tr>
                </thead>
                <tbody>
                  {accountTransactions.map((accountData) => 
                    accountData.transactions.map((transaction, index) => (
                      <tr 
                        key={`${accountData.account.id}-${transaction.id}`} 
                        className={`border-b border-[#2d2d2d] hover:bg-[#0f0f0f] ${
                          index === 0 ? 'bg-[#0f0f0f]/50' : ''
                        }`}
                      >
                        <td className="py-3 px-2">
                          <div className="text-white font-medium">{accountData.account.name}</div>
                          <div className="text-xs text-[#b3b3b3]">{accountData.account.institution}</div>
                        </td>
                        <td className="py-3 px-2 text-white font-mono text-xs">
                          {new Date(transaction.timestamp).toLocaleString('en-US', {
                            month: '2-digit',
                            day: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              transaction.side === 'BUY' || (transaction.instrument_kind === 'CASH' && transaction.qty > 0) 
                                ? 'bg-green-400' 
                                : 'bg-red-400'
                            }`} />
                            <span className="text-white">{transaction.instrument_kind}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-white">
                            {getInstrumentDisplay(transaction)}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right text-white">
                          {transaction.qty}
                        </td>
                        <td className="py-3 px-2 text-right text-white">
                          {transaction.price ? formatCurrency(transaction.price) : '-'}
                        </td>
                        <td className="py-3 px-2 text-right text-white">
                          {transaction.fees > 0 ? formatCurrency(transaction.fees) : '-'}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={(transaction.cashDelta || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {(transaction.cashDelta || 0) >= 0 ? '+' : ''}{formatCurrency(transaction.cashDelta || 0)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right text-white font-mono text-xs">
                          {formatCurrency(transaction.balanceAfter || 0)}
                        </td>
                        <td className="py-3 px-2 text-[#b3b3b3] text-xs">
                          {transaction.memo || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}