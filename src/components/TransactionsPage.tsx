'use client';

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Activity, Building2, Calendar } from "lucide-react";
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

  const formatDateTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

      {/* Account Cards */}
      {accountTransactions.length === 0 ? (
        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardContent className="text-center py-8">
            <div className="text-lg text-[#b3b3b3]">No transactions found</div>
            <div className="text-sm text-[#b3b3b3] mt-2">Try adjusting your time range or add some transactions</div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {accountTransactions.map((accountData) => (
            <Card key={accountData.account.id} className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {accountData.account.name}
                </CardTitle>
                <CardDescription className="flex items-center gap-4">
                  <span>{accountData.account.institution}</span>
                  <Badge variant="outline">{accountData.account.type}</Badge>
                  <span className="text-green-400 font-medium">
                    Balance: {formatCurrency(accountData.runningBalance)}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {accountData.transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 bg-[#0f0f0f] rounded-lg border border-[#2d2d2d]"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          {transaction.side === 'BUY' || (transaction.instrument_kind === 'CASH' && transaction.qty > 0) ? (
                            <div className="w-8 h-8 bg-green-400/20 rounded-full flex items-center justify-center">
                              <TrendingUp className="h-4 w-4 text-green-400" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-red-400/20 rounded-full flex items-center justify-center">
                              <TrendingUp className="h-4 w-4 text-red-400 rotate-180" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-white">
                              {getInstrumentDisplay(transaction)}
                            </span>
                            {transaction.tickers?.name && (
                              <Badge variant="outline" className="text-xs">
                                {transaction.tickers.name}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-[#b3b3b3]">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDateTime(transaction.timestamp)}
                            </div>
                            {transaction.memo && (
                              <span className="italic">&ldquo;{transaction.memo}&rdquo;</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-white">
                          {transaction.instrument_kind === 'CASH' 
                            ? formatCurrency(Math.abs(transaction.qty))
                            : `${transaction.qty} @ ${formatCurrency(transaction.price || 0)}`
                          }
                        </div>
                        {transaction.fees > 0 && (
                          <div className="text-xs text-[#b3b3b3]">
                            Fees: {formatCurrency(transaction.fees)}
                          </div>
                        )}
                        <div className="text-xs text-[#b3b3b3] mt-1">
                          <div className={(transaction.cashDelta || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {(transaction.cashDelta || 0) >= 0 ? '+' : ''}{formatCurrency(transaction.cashDelta || 0)}
                          </div>
                          <div className="text-[#b3b3b3]">
                            Balance: {formatCurrency(transaction.balanceAfter || 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}