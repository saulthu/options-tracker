'use client';

import React, { useMemo, useState } from 'react';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { TimeRange } from '@/components/TimeRangeSelector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Modal from '@/components/ui/modal';
import PositionFilterSelector from '@/components/PositionFilterSelector';
import { TrendingUp, DollarSign, Activity, Building2, ChevronUp, ChevronDown, Eye, Clock, ArrowUpDown, Target, FileText } from 'lucide-react';
import { PositionEpisode, EpisodeTxn } from '@/types/episodes';
import { PositionFilterType } from '@/types/navigation';

interface PositionsPageProps {
  selectedRange: TimeRange;
}

type SortField = 'openTimestamp' | 'episodeKey' | 'kindGroup' | 'qty' | 'avgPrice' | 'realizedPnLTotal' | 'cashTotal';
type SortDirection = 'asc' | 'desc';

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
          aValue = a.episodeKey;
          bValue = b.episodeKey;
          break;
        case 'kindGroup':
          aValue = a.kindGroup;
          bValue = b.kindGroup;
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

      // If primary values are equal, use timestamp as secondary sort
      if (primaryComparison === 0 && sortField !== 'openTimestamp') {
        const aTimestamp = new Date(a.openTimestamp).getTime();
        const bTimestamp = new Date(b.openTimestamp).getTime();
        return aTimestamp - bTimestamp;
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
      return { ticker: position.episodeKey, details: `${position.qty} shares` };
    }

    if (position.kindGroup === 'OPTION') {
      const right = position.currentRight || 'UNKNOWN';
      const strike = position.currentStrike ? `$${position.currentStrike}` : '';
      const expiry = position.currentExpiry ? new Date(position.currentExpiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      const details = `${position.qty} contracts ${right} ${strike} ${expiry}`.trim();
      return { ticker: position.episodeKey.split('|')[0] || position.episodeKey, details };
    }

    return { ticker: position.episodeKey, details: '' };
  };

  // Render transaction details in modal
  const renderTransactionDetails = (txn: EpisodeTxn) => {
    const getInstrumentDisplay = () => {
      if (txn.instrumentKind === 'CASH') {
        return 'Cash';
      }
      if (txn.instrumentKind === 'SHARES') {
        return `${txn.side} ${txn.ticker}`;
      }
      if (txn.instrumentKind === 'CALL' || txn.instrumentKind === 'PUT') {
        const expiry = txn.expiry ? new Date(txn.expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        return `${txn.side} ${txn.ticker} ${txn.instrumentKind} $${txn.strike} ${expiry}`.trim();
      }
      return `${txn.side} ${txn.ticker}`;
    };

    return (
      <div key={txn.txnId} className="border border-[#2d2d2d] rounded p-2 bg-[#0f0f0f]">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={`text-xs ${
                txn.side === 'BUY' ? 'bg-green-600 text-white border-green-600' :
                txn.side === 'SELL' ? 'bg-red-600 text-white border-red-600' :
                'bg-blue-600 text-white border-blue-600'
              }`}
            >
              {txn.side || 'CASH'}
            </Badge>
          </div>
          <span className="text-xs text-[#b3b3b3]">
            {new Date(txn.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        
        <div className="space-y-1">
          <div className="text-sm text-white font-medium">{getInstrumentDisplay()}</div>
          
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#b3b3b3]">Qty:</span>
              <span className="text-white">{txn.qty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#b3b3b3]">Price:</span>
              <span className="text-white">
                {txn.price ? formatCurrency(txn.price) : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#b3b3b3]">Fees:</span>
              <span className="text-white">{formatCurrency(txn.fees)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#b3b3b3]">Cash:</span>
              <span className={`${txn.cashDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {txn.cashDelta >= 0 ? '+' : ''}{formatCurrency(txn.cashDelta)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#b3b3b3]">P&L:</span>
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2d2d2d]">
                    {renderSortableHeader('openTimestamp', 'Open Date')}
                    {renderSortableHeader('episodeKey', 'Position')}
                    {renderSortableHeader('kindGroup', 'Type')}
                    {renderSortableHeader('qty', 'Quantity', 'right')}
                    {renderSortableHeader('avgPrice', 'Avg Price', 'right')}
                    {renderSortableHeader('realizedPnLTotal', 'Realized P&L', 'right')}
                    {renderSortableHeader('cashTotal', 'Cash Flow', 'right')}
                    <th className="text-left py-2 px-2 text-[#b3b3b3] font-medium">Status</th>
                    <th className="text-center py-2 px-2 text-[#b3b3b3] font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPositions.map((position, index) => (
                    <tr
                      key={position.episodeId}
                      className={`border-b border-[#2d2d2d] hover:bg-[#0f0f0f] cursor-pointer ${
                        index % 2 === 0 ? 'bg-[#1a1a1a]' : 'bg-[#252525]'
                      }`}
                      onClick={() => handlePositionClick(position)}
                    >
                      <td className="py-2 px-2 text-white font-mono text-xs">
                        {new Date(position.openTimestamp).toLocaleDateString('en-US', {
                          month: '2-digit',
                          day: '2-digit',
                          year: '2-digit'
                        })}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex flex-col h-8 justify-center">
                          <div className="text-white font-semibold text-sm">
                            {getPositionDisplay(position).ticker}
                          </div>
                          {getPositionDisplay(position).details && (
                            <div className="text-[#b3b3b3] text-xs">
                              {getPositionDisplay(position).details}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            position.kindGroup === 'CASH' ? 'bg-blue-600 text-white border-blue-600' :
                            position.kindGroup === 'SHARES' ? 'bg-green-600 text-white border-green-600' :
                            'bg-purple-600 text-white border-purple-600'
                          }`}
                        >
                          {position.kindGroup}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-right text-white">
                        {position.qty}
                      </td>
                      <td className="py-2 px-2 text-right text-white">
                        {position.avgPrice > 0 ? formatCurrency(position.avgPrice) : '-'}
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
                          className={`text-xs ${
                            position.kindGroup === 'CASH' 
                              ? (position.cashTotal >= 0 ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600')
                              : position.qty === 0 
                                ? 'bg-gray-600 text-white border-gray-600' 
                                : 'bg-green-600 text-white border-green-600'
                          }`}
                        >
                          {position.kindGroup === 'CASH' 
                            ? (position.cashTotal >= 0 ? 'DEPOSIT' : 'WITHDRAWAL')
                            : position.qty === 0 
                              ? 'CLOSED' 
                              : 'OPEN'
                          }
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Eye className="h-4 w-4 text-[#b3b3b3] hover:text-white" />
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
        title={selectedPosition ? `Position Details: ${getPositionDisplay(selectedPosition).ticker}` : ''}
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
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#b3b3b3]">Type:</span>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        selectedPosition.kindGroup === 'CASH' ? 'bg-blue-600 text-white border-blue-600' :
                        selectedPosition.kindGroup === 'SHARES' ? 'bg-green-600 text-white border-green-600' :
                        'bg-purple-600 text-white border-purple-600'
                      }`}
                    >
                      {selectedPosition.kindGroup}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#b3b3b3]">Quantity:</span>
                    <span className="text-white">{selectedPosition.qty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#b3b3b3]">Avg Price:</span>
                    <span className="text-white">
                      {selectedPosition.avgPrice > 0 ? formatCurrency(selectedPosition.avgPrice) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#b3b3b3]">Total Fees:</span>
                    <span className="text-white">{formatCurrency(selectedPosition.totalFees)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#b3b3b3]">Status:</span>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        selectedPosition.kindGroup === 'CASH' 
                          ? (selectedPosition.cashTotal >= 0 ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600')
                          : selectedPosition.qty === 0 
                            ? 'bg-gray-600 text-white border-gray-600' 
                            : 'bg-green-600 text-white border-green-600'
                      }`}
                    >
                      {selectedPosition.kindGroup === 'CASH' 
                        ? (selectedPosition.cashTotal >= 0 ? 'DEPOSIT' : 'WITHDRAWAL')
                        : selectedPosition.qty === 0 
                          ? 'CLOSED' 
                          : 'OPEN'
                      }
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Financial Summary</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#b3b3b3]">Realized P&L:</span>
                    <span className={selectedPosition.realizedPnLTotal >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {selectedPosition.realizedPnLTotal >= 0 ? '+' : ''}{formatCurrency(selectedPosition.realizedPnLTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#b3b3b3]">Cash Flow:</span>
                    <span className={selectedPosition.cashTotal >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {selectedPosition.cashTotal >= 0 ? '+' : ''}{formatCurrency(selectedPosition.cashTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#b3b3b3]">Rolled:</span>
                    <span className="text-white">{selectedPosition.rolled ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Timeline</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#b3b3b3]">Opened:</span>
                  <span className="text-white">{formatDate(selectedPosition.openTimestamp)}</span>
                </div>
                {selectedPosition.closeTimestamp && (
                  <div className="flex justify-between">
                    <span className="text-[#b3b3b3]">Closed:</span>
                    <span className="text-white">{formatDate(selectedPosition.closeTimestamp)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#b3b3b3]">Duration:</span>
                  <span className="text-white">
                    {selectedPosition.closeTimestamp 
                      ? `${Math.ceil((new Date(selectedPosition.closeTimestamp).getTime() - new Date(selectedPosition.openTimestamp).getTime()) / (1000 * 60 * 60 * 24))} days`
                      : `${Math.ceil((Date.now() - new Date(selectedPosition.openTimestamp).getTime()) / (1000 * 60 * 60 * 24))} days (ongoing)`
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Current Leg Details (for options) */}
            {selectedPosition.kindGroup === 'OPTION' && (selectedPosition.currentRight || selectedPosition.currentStrike || selectedPosition.currentExpiry) && (
              <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowUpDown className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Current Option Details</h3>
                </div>
                <div className="space-y-2">
                  {selectedPosition.currentRight && (
                    <div className="flex justify-between">
                      <span className="text-[#b3b3b3]">Right:</span>
                      <Badge variant="outline" className="text-xs bg-purple-600 text-white border-purple-600">
                        {selectedPosition.currentRight}
                      </Badge>
                    </div>
                  )}
                  {selectedPosition.currentStrike && (
                    <div className="flex justify-between">
                      <span className="text-[#b3b3b3]">Strike:</span>
                      <span className="text-white">${selectedPosition.currentStrike}</span>
                    </div>
                  )}
                  {selectedPosition.currentExpiry && (
                    <div className="flex justify-between">
                      <span className="text-[#b3b3b3]">Expiry:</span>
                      <span className="text-white">{formatDate(selectedPosition.currentExpiry)}</span>
                    </div>
                  )}
                  {selectedPosition.currentInstrumentKey && (
                    <div className="flex justify-between">
                      <span className="text-[#b3b3b3]">Instrument Key:</span>
                      <span className="text-white font-mono text-xs">{selectedPosition.currentInstrumentKey}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Transaction History */}
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
          </div>
        )}
      </Modal>
    </div>
  );
}
