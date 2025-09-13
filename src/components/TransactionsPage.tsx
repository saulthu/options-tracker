"use client";

import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { TimeRange } from "@/components/TimeRangeSelector";
import { RawTransaction } from "@/types/episodes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyAmount, CurrencyCode, isValidCurrencyCode } from "@/lib/currency-amount";

interface TransactionsPageProps {
  selectedRange: TimeRange;
}

export default function TransactionsPage({ selectedRange }: TransactionsPageProps) {
  const { user } = useAuth();
  const { 
    transactions, 
    loading, 
    error, 
    getFilteredTransactions 
  } = usePortfolio();

  // Get filtered transactions for the selected time range
  const filteredTransactions = useMemo(() => {
    if (!selectedRange) return [];
    return getFilteredTransactions(selectedRange);
  }, [selectedRange, getFilteredTransactions]);

  // Group transactions by account for better organization
  const transactionsByAccount = useMemo(() => {
    const grouped: { [accountId: string]: typeof filteredTransactions } = {};
    
    filteredTransactions.forEach(transaction => {
      const accountId = transaction.account_id;
      if (!grouped[accountId]) {
        grouped[accountId] = [];
      }
      grouped[accountId].push(transaction);
    });

    // Sort transactions within each account by timestamp
    Object.keys(grouped).forEach(accountId => {
      grouped[accountId].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    });

    return grouped;
  }, [filteredTransactions]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalTransactions = filteredTransactions.length;
    const totalValue = filteredTransactions.reduce((sum, t) => {
      if (t.price && t.qty) {
        const multiplier = t.instrument_kind === 'CASH' ? 1 : (t.instrument_kind === 'SHARES' ? 1 : 100);
        const value = t.price.multiply(t.qty * multiplier).amount;
        return sum + value;
      }
      return sum;
    }, 0);
    const accountsCount = Object.keys(transactionsByAccount).length;
    
    return {
      totalTransactions,
      totalValue,
      accountsCount
    };
  }, [filteredTransactions, transactionsByAccount]);

  // Helper function to create CurrencyAmount
  const createCurrencyAmount = (amount: number, currency: string = 'USD') => {
    if (!isValidCurrencyCode(currency)) {
      console.warn(`Invalid currency code: ${currency}, falling back to USD`);
      currency = 'USD';
    }
    return new CurrencyAmount(amount, currency as CurrencyCode);
  };

  // Format date/time
  const formatDateTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  // Get instrument display name
  const getInstrumentDisplay = (transaction: RawTransaction) => {
    const action = transaction.side || 'TRADE';
    const ticker = transaction.tickers?.name || 'Unknown';
    
    if (transaction.instrument_kind === 'CASH') {
      return 'Cash';
    }
    
    if (transaction.instrument_kind === 'SHARES') {
      return `${action} ${ticker}`;
    }
    
    if (transaction.instrument_kind === 'CALL' || transaction.instrument_kind === 'PUT') {
      const optionType = transaction.instrument_kind;
      const strike = transaction.strike ? `$${transaction.strike.amount}` : '';
      const expiry = transaction.expiry ? new Date(transaction.expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      return `${action} ${ticker} ${optionType} ${strike} ${expiry}`.trim();
    }
    
    return `${action} ${ticker}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <div className="text-[#b3b3b3]">Loading transactions...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-[#1a1a1a] border-red-500/20">
        <CardContent className="py-12">
          <div className="text-center">
            <div className="text-red-400 text-lg mb-2">Error Loading Transactions</div>
            <div className="text-[#b3b3b3] text-sm">{error}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
        <CardContent className="py-12">
          <div className="text-center">
            <div className="text-[#b3b3b3] text-lg mb-2">Authentication Required</div>
            <div className="text-[#666] text-sm">Please log in to view transactions.</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Simple Summary */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Transactions</h2>
          <p className="text-[#b3b3b3] text-sm">
            {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} in selected period
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-[#b3b3b3]">Total Value</div>
          <div className={`text-lg font-semibold ${summaryStats.totalValue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {createCurrencyAmount(summaryStats.totalValue, 'USD').format()}
          </div>
        </div>
      </div>

      {/* Simple Table View */}
      {filteredTransactions.length === 0 ? (
        <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
          <CardContent className="py-12">
            <div className="text-center text-[#b3b3b3]">
              No transactions found for the selected time period.
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2d2d2d]">
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#b3b3b3]">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#b3b3b3]">Action</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#b3b3b3]">Instrument</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-[#b3b3b3]">Quantity</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-[#b3b3b3]">Price</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-[#b3b3b3]">Value</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#b3b3b3]">Memo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction, index) => (
                    <tr 
                      key={`${transaction.id}-${index}`}
                      className="border-b border-[#2d2d2d] hover:bg-[#0f0f0f] transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-[#b3b3b3]">
                        {formatDateTime(transaction.timestamp)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge 
                          variant={transaction.side === 'BUY' ? 'default' : 'secondary'}
                          className={`text-xs ${
                            transaction.side === 'BUY'
                              ? 'bg-green-400 text-black'
                              : transaction.side === 'SELL'
                              ? 'bg-red-400 text-black'
                              : 'bg-gray-400 text-black'
                          }`}
                        >
                          {transaction.side || 'TRADE'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-white">
                        {getInstrumentDisplay(transaction)}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#b3b3b3] text-right">
                        {transaction.qty || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#b3b3b3] text-right">
                        {transaction.price ? transaction.price.format() : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        <span className={`font-medium ${
                          (transaction.price && transaction.qty ? transaction.price.multiply(transaction.qty).amount : 0) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {transaction.price && transaction.qty ? transaction.price.multiply(transaction.qty).format() : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-[#b3b3b3]">
                        {transaction.memo || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Simple Debug Info */}
      <div className="text-xs text-[#666] text-center">
        Showing {filteredTransactions.length} of {transactions.length} total transactions
        {selectedRange && (
          <span> • {selectedRange.startDate.toLocaleDateString()} - {selectedRange.endDate.toLocaleDateString()}</span>
        )}
      </div>

      {/* Debug Raw Data - Remove this in production */}
      {filteredTransactions.length > 0 && (
        <Card className="bg-[#0f0f0f] border-[#2d2d2d]">
          <CardHeader>
            <CardTitle className="text-sm text-[#b3b3b3]">Debug: Raw Transaction Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-[#666] overflow-auto max-h-40">
              {JSON.stringify(filteredTransactions[0], null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
