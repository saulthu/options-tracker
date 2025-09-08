'use client';

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, Activity, Building2, ChevronUp, ChevronDown } from "lucide-react";
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

type SortField = 'timestamp' | 'account' | 'instrument_kind' | 'qty' | 'price' | 'fees' | 'cashDelta' | 'balanceAfter' | 'memo';
type SortDirection = 'asc' | 'desc';


export default function TransactionsPage({ selectedRange }: TransactionsPageProps) {
  const { user } = useAuth();
  const { getFilteredTransactions, loading } = usePortfolio();
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Handle column sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get all transactions and full portfolio (not filtered)
  const allTransactions = usePortfolio().transactions as TransactionWithDetails[];
  const fullPortfolio = usePortfolio().portfolio;
  
  // Get filtered transactions for display only
  const filteredTransactions = getFilteredTransactions(selectedRange) as TransactionWithDetails[];

  // Log portfolio calculator results to console
  console.log('Portfolio Calculator Results:', {
    fullPortfolio: fullPortfolio ? {
      positions: Array.from(fullPortfolio.positions.entries()),
      balances: Array.from(fullPortfolio.balances.entries()),
      ledger: fullPortfolio.ledger,
      realized: fullPortfolio.realized,
      ledgerCount: fullPortfolio.ledger.length,
      realizedCount: fullPortfolio.realized.length
    } : null,
    allTransactionsCount: allTransactions.length,
    filteredTransactionsCount: filteredTransactions.length,
    sampleFilteredTransactions: filteredTransactions.slice(0, 5).map(tx => ({
      id: tx.id,
      timestamp: tx.timestamp,
      instrument_kind: tx.instrument_kind,
      ticker: tx.tickers?.name,
      account: tx.accounts?.name,
      side: tx.side,
      qty: tx.qty,
      price: tx.price
    }))
  });

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

  // Sort filtered transactions by selected field and calculate running balances per account
  const sortedTransactions = useMemo((): TransactionWithDetails[] => {
    if (!filteredTransactions.length) return [];

    // Note: We no longer need to track accountBalances here since we use the portfolio calculator's ledger

    // Now sort the FILTERED transactions by selected field
    const sorted = [...filteredTransactions].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'timestamp':
          aValue = new Date(a.timestamp).getTime();
          bValue = new Date(b.timestamp).getTime();
          break;
        case 'account':
          aValue = a.accounts?.name || '';
          bValue = b.accounts?.name || '';
          break;
        case 'instrument_kind':
          // Sort by ticker name first, then by instrument type
          const aTicker = a.tickers?.name || '';
          const bTicker = b.tickers?.name || '';
          
          // If both have tickers, sort by ticker name
          if (aTicker && bTicker) {
            const tickerComparison = aTicker.localeCompare(bTicker);
            if (tickerComparison !== 0) {
              aValue = aTicker;
              bValue = bTicker;
            } else {
              // Same ticker, sort by instrument type
              aValue = a.instrument_kind;
              bValue = b.instrument_kind;
            }
          } else {
            // One or both are CASH, sort by instrument type
            aValue = a.instrument_kind;
            bValue = b.instrument_kind;
          }
          break;
        case 'qty':
          aValue = a.qty;
          bValue = b.qty;
          break;
        case 'price':
          aValue = a.price || 0;
          bValue = b.price || 0;
          break;
        case 'fees':
          aValue = a.fees;
          bValue = b.fees;
          break;
        case 'memo':
          aValue = a.memo || '';
          bValue = b.memo || '';
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      // Primary comparison based on selected field
      let primaryComparison: number;
      
      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        primaryComparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        // Handle numeric comparison
        primaryComparison = aValue - bValue;
      } else {
        // Fallback to string comparison
        primaryComparison = String(aValue).localeCompare(String(bValue));
      }

      // Apply sort direction to primary comparison
      const primaryResult = sortDirection === 'asc' ? primaryComparison : -primaryComparison;

      // If primary values are equal and we're not sorting by timestamp, use timestamp as secondary sort
      if (primaryComparison === 0 && sortField !== 'timestamp') {
        const aTimestamp = new Date(a.timestamp).getTime();
        const bTimestamp = new Date(b.timestamp).getTime();
        const timestampComparison = aTimestamp - bTimestamp;
        return timestampComparison; // Always sort timestamps ascending for secondary sort
      }

      return primaryResult;
    });

    // Use the pre-calculated account balances and calculate cash deltas for filtered transactions
    return sorted.map(transaction => {
      // Get cash delta and balance from the portfolio calculator's ledger
      const ledgerEntry = fullPortfolio?.ledger.find(entry => entry.txnId === transaction.id);
      const cashDelta = ledgerEntry?.cashDelta || 0;
      const balanceAfter = ledgerEntry?.balanceAfter || 0;

      return {
        ...transaction,
        cashDelta,
        balanceAfter
      };
    });
  }, [filteredTransactions, sortField, sortDirection, fullPortfolio?.ledger]);

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

  // Render sortable column header
  const renderSortableHeader = (field: SortField, label: string, align: 'left' | 'right' = 'left') => {
    const isActive = sortField === field;
    const alignmentClass = align === 'right' ? 'text-right' : 'text-left';
    return (
      <th 
        className={`${alignmentClass} py-2 px-2 text-[#b3b3b3] font-medium cursor-pointer hover:text-white select-none`}
        onClick={() => handleSort(field)}
      >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
          <span>{label}</span>
          {isActive && (
            sortDirection === 'asc' ? 
              <ChevronUp className="h-3 w-3" /> : 
              <ChevronDown className="h-3 w-3" />
          )}
        </div>
      </th>
    );
  };


  const getInstrumentDisplay = (transaction: TransactionWithDetails) => {
    if (transaction.instrument_kind === 'CASH') {
      return { ticker: 'Cash', details: '' };
    }
    
    const ticker = transaction.tickers?.name || 'Unknown';
    const side = transaction.side || '';
    const kind = transaction.instrument_kind;
    
    if (kind === 'SHARES') {
      return { ticker, details: side };
    } else if (kind === 'CALL' || kind === 'PUT') {
      const strike = transaction.strike ? `$${transaction.strike}` : '';
      const expiry = transaction.expiry ? new Date(transaction.expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      const details = `${side} ${kind} ${strike} ${expiry}`.trim();
      return { ticker, details };
    }
    
    return { ticker: kind, details: side };
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
          <CardTitle className="text-sm text-[#b3b3b3]">Portfolio Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <span className="text-[#b3b3b3]">Filtered Transactions: </span>
                <span className="text-white">{filteredTransactions.length}</span>
              </div>
            </div>
            
            <div>
              <span className="text-[#b3b3b3]">ISO Range: </span>
              <span className="text-white font-mono text-xs">
                {selectedRange.startDate.toISOString()} to {selectedRange.endDate.toISOString()}
              </span>
            </div>

            {/* Portfolio Positions */}
            <div className="border-t border-[#2d2d2d] pt-4">
              <div className="text-[#b3b3b3] font-medium mb-2">Current Positions (Full Portfolio):</div>
              <div className="bg-[#0f0f0f] p-3 rounded text-xs font-mono overflow-x-auto">
                <pre className="whitespace-pre-wrap">
                  {fullPortfolio ? JSON.stringify({
                    positions: Object.fromEntries(
                      Array.from(fullPortfolio.positions.entries()).map(([key, position]) => {
                        // Show account name (unique per user)
                        const accountName = allTransactions.find(t => t.account_id === position.accountId)?.accounts?.name || 'Unknown';
                        const readableKey = key.replace(position.accountId, accountName);
                        return [readableKey, position];
                      })
                    ),
                    balances: Object.fromEntries(
                      Array.from(fullPortfolio.balances.entries()).map(([accountId, balance]) => {
                        const accountName = allTransactions.find(t => t.account_id === accountId)?.accounts?.name || 'Unknown';
                        return [accountName, balance];
                      })
                    ),
                    ledgerCount: fullPortfolio.ledger.length,
                    realizedCount: fullPortfolio.realized.length,
                    sampleLedgerEntry: fullPortfolio.ledger[0] || null,
                    sampleRealizedEvent: fullPortfolio.realized[0] || null
                  }, null, 2) : 'No portfolio data available'}
                </pre>
              </div>
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
          {sortedTransactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-lg text-[#b3b3b3]">No transactions found</div>
              <div className="text-sm text-[#b3b3b3] mt-2">Try adjusting your time range or add some transactions</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2d2d2d]">
                    {renderSortableHeader('timestamp', 'Date')}
                    {renderSortableHeader('account', 'Account')}
                    {renderSortableHeader('instrument_kind', 'Instrument')}
                    {renderSortableHeader('qty', 'Qty', 'right')}
                    {renderSortableHeader('price', 'Price', 'right')}
                    {renderSortableHeader('fees', 'Fees', 'right')}
                    <th className="text-right py-2 px-2 text-[#b3b3b3] font-medium">Cash Delta</th>
                    <th className="text-right py-2 px-2 text-[#b3b3b3] font-medium">Balance</th>
                    {renderSortableHeader('memo', 'Memo')}
                  </tr>
                </thead>
                <tbody>
                  {sortedTransactions.map((transaction, index) => (
                    <tr 
                      key={transaction.id} 
                      className={`border-b border-[#2d2d2d] hover:bg-[#0f0f0f] ${
                        index % 2 === 0 ? 'bg-[#1a1a1a]' : 'bg-[#252525]'
                      }`}
                    >
                      <td className="py-2 px-2 text-white font-mono text-xs">
                        {new Date(transaction.timestamp).toLocaleDateString('en-US', {
                          month: '2-digit',
                          day: '2-digit'
                        })}
                      </td>
                      <td className="py-2 px-2">
                        <div 
                          className="text-white text-xs truncate max-w-[150px]" 
                          title={transaction.accounts?.name || 'Unknown Account'}
                        >
                          {transaction.accounts?.name || 'Unknown Account'}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex flex-col h-8 justify-center">
                          <div className="text-white font-semibold text-sm">
                            {getInstrumentDisplay(transaction).ticker}
                          </div>
                          {getInstrumentDisplay(transaction).details && (
                            <div className="text-[#b3b3b3] text-xs">
                              {getInstrumentDisplay(transaction).details}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right text-white">
                        {transaction.qty}
                      </td>
                      <td className="py-2 px-2 text-right text-white">
                        {transaction.price ? formatCurrency(transaction.price) : '-'}
                      </td>
                      <td className="py-2 px-2 text-right text-white">
                        {transaction.fees > 0 ? formatCurrency(transaction.fees) : '-'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className={(transaction.cashDelta || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {(transaction.cashDelta || 0) >= 0 ? '+' : ''}{formatCurrency(transaction.cashDelta || 0)}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-white font-mono text-xs">
                        {formatCurrency(transaction.balanceAfter || 0)}
                      </td>
                      <td className="py-2 px-2 text-[#b3b3b3] text-xs">
                        <div 
                          className="truncate max-w-[150px]" 
                          title={transaction.memo || '-'}
                        >
                          {transaction.memo || '-'}
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