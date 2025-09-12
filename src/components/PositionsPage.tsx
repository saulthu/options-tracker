'use client';

import React, { useMemo, useState } from 'react';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { TimeRange } from '@/components/TimeRangeSelector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Modal from '@/components/ui/modal';
import PositionFilterSelector from '@/components/PositionFilterSelector';
import { TrendingUp, DollarSign, Activity, Building2, ChevronUp, ChevronDown, Target, FileText, Copy } from 'lucide-react';
import { PositionEpisode, EpisodeTxn } from '@/types/episodes';
import { PositionFilterType } from '@/types/navigation';

interface PositionsPageProps {
  selectedRange: TimeRange;
}

type SortField = 'openTimestamp' | 'episodeKey' | 'kindGroup' | 'qty' | 'avgPrice' | 'realizedPnLTotal' | 'cashTotal';
type SortDirection = 'asc' | 'desc';

// Centralized badge styling
const BADGE_STYLES = {
  default: 'text-xs bg-gray-800 text-gray-200 border-gray-700 !font-mono',
  open: 'text-xs bg-gray-300 text-gray-800 border-gray-400 !font-mono font-bold',
} as const;

export default function PositionsPage({ selectedRange }: PositionsPageProps) {
  const { 
    portfolio, 
    loading, 
    error, 
    getFilteredPositions
  } = usePortfolio();

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('openTimestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Filter state
  const [positionFilter, setPositionFilter] = useState<PositionFilterType>('overlap');
  
  // Modal state
  const [selectedPosition, setSelectedPosition] = useState<PositionEpisode | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  // Handle position click
  const handlePositionClick = (position: PositionEpisode) => {
    setSelectedPosition(position);
    setIsModalOpen(true);
  };

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPosition(null);
  };

  // Get filtered positions for the selected time range
  const filteredPositions = useMemo(() => {
    if (!portfolio) return [];
    return getFilteredPositions(selectedRange, undefined, positionFilter);
  }, [portfolio, selectedRange, positionFilter, getFilteredPositions]);

  // Sort filtered positions by selected field
  const sortedPositions = useMemo(() => {
    if (!filteredPositions.length) return [];

    const sorted = [...filteredPositions].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'openTimestamp':
          aValue = new Date(a.openTimestamp).getTime();
          bValue = new Date(b.openTimestamp).getTime();
          break;
        case 'episodeKey':
          // Extract just the ticker for comparison to enable proper secondary sorting
          aValue = a.episodeKey.split('|')[0] || a.episodeKey;
          bValue = b.episodeKey.split('|')[0] || b.episodeKey;
          break;
        case 'kindGroup':
          // For options, sort by specific type (CC, CSP, COL, PUT), otherwise by kindGroup
          if (a.kindGroup === 'OPTION' && b.kindGroup === 'OPTION') {
            aValue = a.optionDirection || 'UNKNOWN';
            bValue = b.optionDirection || 'UNKNOWN';
          } else {
            aValue = a.kindGroup;
            bValue = b.kindGroup;
          }
          break;
        case 'qty':
          aValue = a.qty;
          bValue = b.qty;
          break;
        case 'avgPrice':
          aValue = a.avgPrice;
          bValue = b.avgPrice;
          break;
        case 'realizedPnLTotal':
          aValue = a.realizedPnLTotal;
          bValue = b.realizedPnLTotal;
          break;
        case 'cashTotal':
          aValue = a.cashTotal;
          bValue = b.cashTotal;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      // Primary comparison based on selected field
      let primaryComparison: number;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        primaryComparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        primaryComparison = aValue - bValue;
      } else {
        primaryComparison = String(aValue).localeCompare(String(bValue));
      }

      // Apply sort direction
      const primaryResult = sortDirection === 'asc' ? primaryComparison : -primaryComparison;

      // If primary values are equal, use timestamp as secondary sort (newest first)
      if (primaryComparison === 0 && sortField !== 'openTimestamp') {
        const aTimestamp = new Date(a.openTimestamp).getTime();
        const bTimestamp = new Date(b.openTimestamp).getTime();
        return bTimestamp - aTimestamp; // Newest first (descending)
      }

      return primaryResult;
    });

    return sorted;
  }, [filteredPositions, sortField, sortDirection]);

  // Memoize summary statistics
  const summaryStats = useMemo(() => {
    const totalPositions = filteredPositions.length;
    const openPositions = filteredPositions.filter(pos => pos.qty !== 0).length;
    const closedPositions = filteredPositions.filter(pos => pos.qty === 0).length;
    const totalRealizedPnL = filteredPositions.reduce((sum, pos) => sum + pos.realizedPnLTotal, 0);
    const totalCashFlow = filteredPositions.reduce((sum, pos) => sum + pos.cashTotal, 0);

    return { totalPositions, openPositions, closedPositions, totalRealizedPnL, totalCashFlow };
  }, [filteredPositions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };


  // const formatNumber = (num: number) => {
  //   return new Intl.NumberFormat('en-US', {
  //     minimumFractionDigits: 0,
  //     maximumFractionDigits: 0,
  //   }).format(num);
  // };

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

  const getPositionDisplay = (position: { kindGroup: string; episodeKey: string; qty: number; currentRight?: string; currentStrike?: number; currentExpiry?: string }) => {
    if (position.kindGroup === 'CASH') {
      return { ticker: 'Cash', details: '' };
    }

    if (position.kindGroup === 'SHARES') {
      return { ticker: position.episodeKey, details: '' };
    }

    if (position.kindGroup === 'OPTION') {
      const right = position.currentRight || 'UNKNOWN';
      const strike = position.currentStrike ? `$${position.currentStrike}` : '';
      const expiry = position.currentExpiry ? new Date(position.currentExpiry).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : '';
      const optionType = right === 'CALL' ? 'c' : right === 'PUT' ? 'p' : right.toLowerCase();
      const ticker = position.episodeKey.split('|')[0] || position.episodeKey;
      const details = `${strike}${optionType} ${expiry}`.trim();
      return { ticker: ticker, details: details };
    }

    return { ticker: position.episodeKey, details: '' };
  };

  // Position-specific summary components
  const renderCashPositionSummary = (position: PositionEpisode) => (
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-[#b3b3b3]">Type</span>
        <Badge variant="outline" className={BADGE_STYLES.default}>
          Cash
        </Badge>
      </div>
      <div className="flex justify-between">
        <span className="text-[#b3b3b3]">Amount</span>
        <span className={`text-white font-semibold ${position.cashTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {position.cashTotal >= 0 ? '+' : ''}{formatCurrency(position.cashTotal)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#b3b3b3]">Status</span>
        <Badge 
          variant="outline" 
          className={BADGE_STYLES.default}
        >
          {position.cashTotal >= 0 ? 'Deposit' : 'Withdraw'}
        </Badge>
      </div>
    </div>
  );

  const renderSharesPositionSummary = (position: PositionEpisode) => (
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-[#b3b3b3]">Type</span>
        <Badge variant="outline" className={BADGE_STYLES.default}>
          Shares
        </Badge>
      </div>
      <div className="flex justify-between">
        <span className="text-[#b3b3b3]">Quantity</span>
        <span className="text-white font-semibold">{position.qty} shares</span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#b3b3b3]">Avg Price</span>
        <span className="text-white">
          {formatCurrency(position.avgPrice || 0)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#b3b3b3]">Cost Basis</span>
        <span className="text-white font-semibold">
          {formatCurrency((position.avgPrice || 0) * position.qty)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#b3b3b3]">Mkt. Value</span>
        <span className="text-white font-semibold">
          {formatCurrency(0)} {/* Placeholder for future live data */}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#b3b3b3]">Status</span>
        <Badge 
          variant="outline" 
          className={position.qty === 0 ? BADGE_STYLES.default : BADGE_STYLES.open}
        >
          {position.qty === 0 ? 'Closed' : 'Open'}
        </Badge>
      </div>
    </div>
  );

  const renderOptionsPositionSummary = (position: PositionEpisode) => {
    // Determine BUY/SELL direction based on transaction history
    const getPositionDirection = () => {
      if (position.txns.length === 0) return 'UNKNOWN';
      
      // Look at the first transaction to determine initial direction
      const firstTxn = position.txns[0];
      return firstTxn.side || 'UNKNOWN';
    };

    const strike = position.currentStrike || 'N/A';
    const contracts = Math.abs(position.qty); // Make unsigned
    const direction = getPositionDirection();
    const ticker = position.txns.length > 0 ? position.txns[0].ticker : 'UNKNOWN';

    return (
      <div className="space-y-2">
        <div className="text-center">
          <div className="text-lg font-semibold text-white mb-1 flex justify-center items-center gap-2">
            <Badge 
              variant="outline" 
              className={BADGE_STYLES.default}
            >
              {position.optionDirection === 'CALL' ? 'Call' :
               position.optionDirection === 'PUT' ? 'Put' :
               position.optionDirection || direction}
            </Badge>
            <span>{ticker} ${strike} {position.currentExpiry ? new Date(position.currentExpiry).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : ''}</span>
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-[#b3b3b3]">Contracts</span>
          <span className="text-white">{contracts}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#b3b3b3]">Avg Price</span>
          <span className="text-white">
            {formatCurrency(position.avgPrice || 0)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#b3b3b3]">Cost Basis</span>
          <span className="text-white font-semibold">
            {formatCurrency((position.avgPrice || 0) * position.qty * 100)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#b3b3b3]">Mkt. Value</span>
          <span className="text-white font-semibold">
            {formatCurrency(0)} {/* Placeholder for future live data */}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#b3b3b3]">Status</span>
          <Badge 
            variant="outline" 
            className={position.qty === 0 ? BADGE_STYLES.default : BADGE_STYLES.open}
          >
            {position.qty === 0 ? 'Closed' : 'Open'}
          </Badge>
        </div>
      </div>
    );
  };

  // Render transaction details in modal
  const renderTransactionDetails = (txn: EpisodeTxn) => {
    // Simple display for cash transactions
    if (txn.instrumentKind === 'CASH') {
      return (
        <div key={txn.txnId} className="border border-[#2d2d2d] rounded p-2 bg-[#0f0f0f]">
          <div className="flex justify-between items-center">
            <span className={`text-lg font-medium ${txn.cashDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {txn.cashDelta >= 0 ? '+' : ''}{formatCurrency(txn.cashDelta || 0)}
            </span>
            <span className="text-xs text-[#b3b3b3]">
              {new Date(txn.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          {txn.note && (
            <div className="mt-2 text-center">
              <span className="text-[#b3b3b3] text-xs">{txn.note}</span>
            </div>
          )}
        </div>
      );
    }

    // Detailed display for shares and options
    const getTransactionDescription = () => {
      const price = formatCurrency(txn.price || 0);
      
      // Use the actionTerm from the episode data (calculated during processing)
      const actionTerm = txn.actionTerm || txn.side || 'UNKNOWN';
      
      if (txn.instrumentKind === 'SHARES') {
        return `${actionTerm} ${txn.ticker} @ ${price}`;
      }
      if (txn.instrumentKind === 'CALL' || txn.instrumentKind === 'PUT') {
        const rightSuffix = txn.instrumentKind === 'PUT' ? 'p' : 'c';
        const expiry = txn.expiry ? new Date(txn.expiry).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : '';
        return `${actionTerm} ${txn.ticker} $${txn.strike}${rightSuffix} ${expiry} @ ${price}`.trim();
      }
      return `${actionTerm} ${txn.ticker} @ ${price}`;
    };

    const copyToClipboard = async () => {
      const description = getTransactionDescription();
      try {
        await navigator.clipboard.writeText(description);
      } catch (err) {
        console.error('Failed to copy: ', err);
      }
    };

    return (
      <div key={txn.txnId} className="border border-[#2d2d2d] rounded p-2 bg-[#0f0f0f]">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white font-medium">{getTransactionDescription()}</span>
            <button
              onClick={copyToClipboard}
              className="p-1 hover:bg-[#2d2d2d] rounded transition-colors"
              title="Copy to clipboard"
            >
              <Copy className="h-3 w-3 text-[#b3b3b3] hover:text-white" />
            </button>
          </div>
          <span className="text-xs text-[#b3b3b3]">
            {new Date(txn.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        
        <div className="space-y-1">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#b3b3b3]">Qty</span>
              <span className="text-white">{txn.qty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#b3b3b3]">Price</span>
              <span className="text-white">
                {formatCurrency(txn.price || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#b3b3b3]">Fees</span>
              <span className="text-white">{formatCurrency(txn.fees)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#b3b3b3]">Cash</span>
              <span className={`${txn.cashDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {txn.cashDelta >= 0 ? '+' : ''}{formatCurrency(txn.cashDelta)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#b3b3b3]">P&L</span>
              <span className={`${txn.realizedPnLDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {txn.realizedPnLDelta >= 0 ? '+' : ''}{formatCurrency(txn.realizedPnLDelta)}
              </span>
            </div>
            {txn.note && (
              <div className="col-span-3 text-center">
                <span className="text-[#b3b3b3] text-xs">{txn.note}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center text-[#b3b3b3] py-8">
        <div className="text-xl">Loading positions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-[#b3b3b3] py-8">
        <div className="text-xl text-red-400">Error loading positions</div>
        <div className="text-sm mt-2">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Total Positions</CardTitle>
            <Activity className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{summaryStats.totalPositions}</div>
            <p className="text-xs text-[#b3b3b3]">In selected period</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Open Positions</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{summaryStats.openPositions}</div>
            <p className="text-xs text-[#b3b3b3]">Active positions</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Realized P&L</CardTitle>
            <DollarSign className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summaryStats.totalRealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(summaryStats.totalRealizedPnL)}
            </div>
            <p className="text-xs text-[#b3b3b3]">Total realized</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Cash Flow</CardTitle>
            <DollarSign className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summaryStats.totalCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(summaryStats.totalCashFlow)}
            </div>
            <p className="text-xs text-[#b3b3b3]">Total cash flow</p>
          </CardContent>
        </Card>
      </div>

      {/* Positions Table */}
      <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Positions Table
              </CardTitle>
              <CardDescription>
                Click on any position to view detailed information
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <PositionFilterSelector
                value={positionFilter}
                onChange={setPositionFilter}
              />
              {/* Future filters can be added here */}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedPositions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-lg text-[#b3b3b3]">No positions found</div>
              <div className="text-sm text-[#b3b3b3] mt-2">Try adjusting your time range or add some transactions</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}>
                <thead>
                  <tr className="border-b border-[#2d2d2d]">
                    {renderSortableHeader('openTimestamp', 'Open Date')}
                    {renderSortableHeader('episodeKey', 'Ticker')}
                    {renderSortableHeader('kindGroup', 'Type')}
                    {renderSortableHeader('qty', 'Quantity', 'right')}
                    {renderSortableHeader('avgPrice', 'Avg Price', 'right')}
                    {renderSortableHeader('realizedPnLTotal', 'Realized P&L', 'right')}
                    {renderSortableHeader('cashTotal', 'Cash Flow', 'right')}
                    <th className="text-left py-2 px-2 text-[#b3b3b3] font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPositions.map((position, index) => (
                    <tr
                      key={position.episodeId}
                      className={`border-b border-[#2d2d2d] hover:bg-[#0f0f0f] cursor-pointer font-mono ${
                        index % 2 === 0 ? 'bg-[#1a1a1a]' : 'bg-[#252525]'
                      }`}
                      onClick={() => handlePositionClick(position)}
                    >
                      <td className="py-2 px-2 text-white text-xs">
                        {new Date(position.openTimestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-white text-sm">
                          {getPositionDisplay(position).ticker}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`${BADGE_STYLES.default} w-16 text-center`}
                          >
                            {position.kindGroup === 'OPTION' ? 
                              (position.optionDirection === 'CALL' ? 'Call' :
                               position.optionDirection === 'PUT' ? 'Put' :
                               position.optionDirection || 'Option') : 
                             position.kindGroup === 'CASH' ? 'Cash' :
                             position.kindGroup === 'SHARES' ? 'Shares' : position.kindGroup}
                          </Badge>
                          {position.kindGroup === 'OPTION' && getPositionDisplay(position).details && (
                            <span className="text-white text-sm">
                              {getPositionDisplay(position).details}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right text-white">
                        {position.qty}
                      </td>
                      <td className="py-2 px-2 text-right text-white">
                        {formatCurrency(position.avgPrice || 0)}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className={position.realizedPnLTotal >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {position.realizedPnLTotal >= 0 ? '+' : ''}{formatCurrency(position.realizedPnLTotal)}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className={position.cashTotal >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {position.cashTotal >= 0 ? '+' : ''}{formatCurrency(position.cashTotal)}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <Badge 
                          variant="outline" 
                          className={
                            position.kindGroup === 'CASH' 
                              ? BADGE_STYLES.default
                              : position.qty === 0 
                                ? BADGE_STYLES.default
                                : BADGE_STYLES.open
                          }
                        >
                          {position.kindGroup === 'CASH' 
                            ? (position.cashTotal >= 0 ? 'Deposit' : 'Withdraw')
                            : position.qty === 0 
                              ? 'Closed' 
                              : 'Open'
                          }
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Position Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={selectedPosition ? `Position Details` : ''}
        maxWidth="2xl"
        showCloseButton={true}
      >
        {selectedPosition && (
          <div className="space-y-4">
            {/* Position Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Position Summary</h3>
                </div>
                {selectedPosition.kindGroup === 'CASH' && renderCashPositionSummary(selectedPosition)}
                {selectedPosition.kindGroup === 'SHARES' && renderSharesPositionSummary(selectedPosition)}
                {selectedPosition.kindGroup === 'OPTION' && renderOptionsPositionSummary(selectedPosition)}
              </div>

              <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Financial Summary</h3>
                </div>
                <div className="space-y-2">
                  {selectedPosition.kindGroup !== 'CASH' && (
                    <div className="flex justify-between">
                      <span className="text-[#b3b3b3]">Realized P&L</span>
                      <span className={selectedPosition.realizedPnLTotal >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {selectedPosition.realizedPnLTotal >= 0 ? '+' : ''}{formatCurrency(selectedPosition.realizedPnLTotal)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#b3b3b3]">Cash Flow</span>
                    <span className={selectedPosition.cashTotal >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {selectedPosition.cashTotal >= 0 ? '+' : ''}{formatCurrency(selectedPosition.cashTotal)}
                    </span>
                  </div>
                  {selectedPosition.kindGroup === 'OPTION' && selectedPosition.rolled && (
                    <div className="flex justify-between">
                      <span className="text-[#b3b3b3]">Rolled</span>
                      <span className="text-white">Yes</span>
                    </div>
                  )}
                </div>
              </div>
            </div>



            {/* Transaction History - Not shown for cash positions */}
            {selectedPosition.kindGroup !== 'CASH' && (
              <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Transaction History ({selectedPosition.txns.length} transactions)</h3>
                </div>
                <div>
                  <div className="space-y-2">
                    {selectedPosition.txns.length === 0 ? (
                      <div className="text-center py-4 text-[#b3b3b3]">
                        No transactions found
                      </div>
                    ) : (
                      selectedPosition.txns
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                        .map(renderTransactionDetails)
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
