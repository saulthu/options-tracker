'use client';

import React, { useMemo } from 'react';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { TimeRange } from '@/components/TimeRangeSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface EpisodesPageProps {
  selectedRange: TimeRange;
}

export default function EpisodesPage({ selectedRange }: EpisodesPageProps) {
  const { 
    portfolio, 
    loading, 
    error, 
    getFilteredEpisodes,
    getOpenEpisodes,
    getEpisodesByKind
  } = usePortfolio();

  // Get filtered episodes for the selected time range
  const filteredEpisodes = useMemo(() => {
    if (!portfolio) return [];
    return getFilteredEpisodes(selectedRange);
  }, [portfolio, selectedRange, getFilteredEpisodes]);

  // Get episodes by status
  const openEpisodes = useMemo(() => {
    return getOpenEpisodes().filter(episode => 
      filteredEpisodes.some(f => f.episodeId === episode.episodeId)
    );
  }, [getOpenEpisodes, filteredEpisodes]);

  // const closedEpisodes = useMemo(() => {
  //   return getClosedEpisodes().filter(episode => 
  //     filteredEpisodes.some(f => f.episodeId === episode.episodeId)
  //   );
  // }, [getClosedEpisodes, filteredEpisodes]);

  // Get episodes by kind
  const cashEpisodes = useMemo(() => {
    return getEpisodesByKind('CASH').filter(episode => 
      filteredEpisodes.some(f => f.episodeId === episode.episodeId)
    );
  }, [getEpisodesByKind, filteredEpisodes]);

  const shareEpisodes = useMemo(() => {
    return getEpisodesByKind('SHARES').filter(episode => 
      filteredEpisodes.some(f => f.episodeId === episode.episodeId)
    );
  }, [getEpisodesByKind, filteredEpisodes]);

  const optionEpisodes = useMemo(() => {
    return getEpisodesByKind('OPTION').filter(episode => 
      filteredEpisodes.some(f => f.episodeId === episode.episodeId)
    );
  }, [getEpisodesByKind, filteredEpisodes]);

  // Calculate summary statistics
  const totalRealizedPnL = useMemo(() => {
    return filteredEpisodes.reduce((total, episode) => total + episode.realizedPnLTotal, 0);
  }, [filteredEpisodes]);

  const totalCashFlow = useMemo(() => {
    return filteredEpisodes.reduce((total, episode) => total + episode.cashTotal, 0);
  }, [filteredEpisodes]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading episodes...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <Card className="border-red-500">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-400 mb-4">Error loading episodes</p>
                <p className="text-gray-400 text-sm">{error}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-400">No portfolio data available</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Position Episodes</h1>
          <p className="text-gray-400 mt-2">
            View your trading positions grouped by episodes and strategies
          </p>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{filteredEpisodes.length}</p>
                <p className="text-gray-400 text-sm">Total Episodes</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{openEpisodes.length}</p>
                <p className="text-gray-400 text-sm">Open Episodes</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className={`text-2xl font-bold ${totalRealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${totalRealizedPnL.toFixed(2)}
                </p>
                <p className="text-gray-400 text-sm">Realized P&L</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className={`text-2xl font-bold ${totalCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${totalCashFlow.toFixed(2)}
                </p>
                <p className="text-gray-400 text-sm">Cash Flow</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Episodes by Kind */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cash Episodes */}
          <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-600 text-white border-blue-600">
                  CASH
                </Badge>
                <span className="text-sm text-gray-400">({cashEpisodes.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {cashEpisodes.length === 0 ? (
                  <p className="text-gray-400 text-sm">No cash episodes in this period</p>
                ) : (
                  cashEpisodes.map((episode) => (
                    <div key={episode.episodeId} className="p-3 bg-[#0f0f0f] rounded-lg border border-[#2d2d2d]">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white text-sm font-medium">
                            {episode.episodeKey}
                          </p>
                          <p className="text-gray-400 text-xs">
                            {new Date(episode.openTimestamp).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${episode.cashTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${episode.cashTotal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Share Episodes */}
          <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Badge variant="outline" className="bg-green-600 text-white border-green-600">
                  SHARES
                </Badge>
                <span className="text-sm text-gray-400">({shareEpisodes.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {shareEpisodes.length === 0 ? (
                  <p className="text-gray-400 text-sm">No share episodes in this period</p>
                ) : (
                  shareEpisodes.map((episode) => (
                    <div key={episode.episodeId} className="p-3 bg-[#0f0f0f] rounded-lg border border-[#2d2d2d]">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white text-sm font-medium">
                            {episode.episodeKey}
                          </p>
                          <p className="text-gray-400 text-xs">
                            {episode.qty === 0 ? 'CLOSED' : 'OPEN'} • {episode.qty} shares @ ${episode.avgPrice.toFixed(2)}
                          </p>
                          <p className="text-gray-400 text-xs">
                            {new Date(episode.openTimestamp).toLocaleDateString()}
                            {episode.closeTimestamp && ` - ${new Date(episode.closeTimestamp).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${episode.realizedPnLTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${episode.realizedPnLTotal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Option Episodes */}
          <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Badge variant="outline" className="bg-purple-600 text-white border-purple-600">
                  OPTIONS
                </Badge>
                <span className="text-sm text-gray-400">({optionEpisodes.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {optionEpisodes.length === 0 ? (
                  <p className="text-gray-400 text-sm">No option episodes in this period</p>
                ) : (
                  optionEpisodes.map((episode) => (
                    <div key={episode.episodeId} className="p-3 bg-[#0f0f0f] rounded-lg border border-[#2d2d2d]">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white text-sm font-medium">
                            {episode.episodeKey}
                          </p>
                          <p className="text-gray-400 text-xs">
                            {episode.qty === 0 ? 'CLOSED' : 'OPEN'} • {episode.qty} contracts
                          </p>
                          {episode.currentRight && episode.currentStrike && episode.currentExpiry && (
                            <p className="text-gray-400 text-xs">
                              {episode.currentRight} ${episode.currentStrike} {episode.currentExpiry}
                            </p>
                          )}
                          <p className="text-gray-400 text-xs">
                            {new Date(episode.openTimestamp).toLocaleDateString()}
                            {episode.closeTimestamp && ` - ${new Date(episode.closeTimestamp).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${episode.realizedPnLTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${episode.realizedPnLTotal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
