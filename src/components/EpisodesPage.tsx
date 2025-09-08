'use client';

import React, { useMemo, useState } from 'react';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { TimeRange } from '@/components/TimeRangeSelector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, Activity, Building2, ChevronUp, ChevronDown } from 'lucide-react';

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
    getFilteredEpisodes
  } = usePortfolio();

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('openTimestamp');
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

  // Get filtered episodes for the selected time range
  const filteredEpisodes = useMemo(() => {
    if (!portfolio) return [];
    return getFilteredEpisodes(selectedRange);
  }, [portfolio, selectedRange, getFilteredEpisodes]);

  // Sort filtered episodes by selected field
  const sortedEpisodes = useMemo(() => {
    if (!filteredEpisodes.length) return [];

    const sorted = [...filteredEpisodes].sort((a, b) => {
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
  }, [filteredEpisodes, sortField, sortDirection]);

  // Memoize summary statistics
  const summaryStats = useMemo(() => {
    const totalEpisodes = filteredEpisodes.length;
    const openEpisodes = filteredEpisodes.filter(ep => ep.qty !== 0).length;
    const closedEpisodes = filteredEpisodes.filter(ep => ep.qty === 0).length;
    const totalRealizedPnL = filteredEpisodes.reduce((sum, ep) => sum + ep.realizedPnLTotal, 0);
    const totalCashFlow = filteredEpisodes.reduce((sum, ep) => sum + ep.cashTotal, 0);

    return { totalEpisodes, openEpisodes, closedEpisodes, totalRealizedPnL, totalCashFlow };
  }, [filteredEpisodes]);

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

  const getEpisodeDisplay = (episode: { kindGroup: string; episodeKey: string; qty: number; currentRight?: string; currentStrike?: number; currentExpiry?: string }) => {
    if (episode.kindGroup === 'CASH') {
      return { ticker: 'Cash', details: '' };
    }

    if (episode.kindGroup === 'SHARES') {
      return { ticker: episode.episodeKey, details: `${episode.qty} shares` };
    }

    if (episode.kindGroup === 'OPTION') {
      const right = episode.currentRight || 'UNKNOWN';
      const strike = episode.currentStrike ? `$${episode.currentStrike}` : '';
      const expiry = episode.currentExpiry ? new Date(episode.currentExpiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      const details = `${episode.qty} contracts ${right} ${strike} ${expiry}`.trim();
      return { ticker: episode.episodeKey.split('|')[0] || episode.episodeKey, details };
    }

    return { ticker: episode.episodeKey, details: '' };
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
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Total Episodes</CardTitle>
            <Activity className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{summaryStats.totalEpisodes}</div>
            <p className="text-xs text-[#b3b3b3]">In selected period</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Open Positions</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{summaryStats.openEpisodes}</div>
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
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Positions Table
          </CardTitle>
          <CardDescription>
            All position episodes in the selected time period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedEpisodes.length === 0 ? (
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
                  </tr>
                </thead>
                <tbody>
                  {sortedEpisodes.map((episode, index) => (
                    <tr
                      key={episode.episodeId}
                      className={`border-b border-[#2d2d2d] hover:bg-[#0f0f0f] ${
                        index % 2 === 0 ? 'bg-[#1a1a1a]' : 'bg-[#252525]'
                      }`}
                    >
                      <td className="py-2 px-2 text-white font-mono text-xs">
                        {new Date(episode.openTimestamp).toLocaleDateString('en-US', {
                          month: '2-digit',
                          day: '2-digit',
                          year: '2-digit'
                        })}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex flex-col h-8 justify-center">
                          <div className="text-white font-semibold text-sm">
                            {getEpisodeDisplay(episode).ticker}
                          </div>
                          {getEpisodeDisplay(episode).details && (
                            <div className="text-[#b3b3b3] text-xs">
                              {getEpisodeDisplay(episode).details}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            episode.kindGroup === 'CASH' ? 'bg-blue-600 text-white border-blue-600' :
                            episode.kindGroup === 'SHARES' ? 'bg-green-600 text-white border-green-600' :
                            'bg-purple-600 text-white border-purple-600'
                          }`}
                        >
                          {episode.kindGroup}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-right text-white">
                        {episode.qty}
                      </td>
                      <td className="py-2 px-2 text-right text-white">
                        {episode.avgPrice > 0 ? formatCurrency(episode.avgPrice) : '-'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className={episode.realizedPnLTotal >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {episode.realizedPnLTotal >= 0 ? '+' : ''}{formatCurrency(episode.realizedPnLTotal)}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className={episode.cashTotal >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {episode.cashTotal >= 0 ? '+' : ''}{formatCurrency(episode.cashTotal)}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            episode.qty === 0 ? 'bg-gray-600 text-white border-gray-600' : 'bg-green-600 text-white border-green-600'
                          }`}
                        >
                          {episode.qty === 0 ? 'CLOSED' : 'OPEN'}
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
    </div>
  );
}