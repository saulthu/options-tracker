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
import { CurrencyAmount, CurrencyCode } from '@/lib/currency-amount';
import { MultiCurrencyBalanceInline } from '@/components/MultiCurrencyBalance';

interface PositionsPageProps {
  selectedRange: TimeRange;
}

type SortField = 'openTimestamp' | 'episodeKey' | 'kindGroup' | 'qty' | 'avgPrice' | 'realizedPnLTotal' | 'cashTotal';
type SortDirection = 'asc' | 'desc';

// Centralized badge styling
const BADGE_STYLES = {
  default: 'text-xs bg-gray-800 text-gray-200 border-gray-700 !font-mono',
  open: 'text-xs bg-gray-300 text-gray-800 border-gray-400 !font-mono font-bold',
  cash: 'text-xs bg-slate-600 text-slate-100 border-slate-500 !font-mono',
  shares: 'text-xs bg-emerald-600 text-emerald-100 border-emerald-500 !font-mono',
  options: 'text-xs bg-indigo-700 text-indigo-100 border-indigo-600 !font-mono',
  forex: 'text-xs bg-orange-600 text-orange-100 border-orange-500 !font-mono',
} as const;

// Forex detection function - purely for display purposes
const detectForexTransaction = (position: PositionEpisode): { isForex: boolean; fromCurrency?: string; toCurrency?: string; exchangeRate?: number; isOutflow?: boolean } => {
  // Only check CASH positions
  if (position.kindGroup !== 'CASH') {
    return { isForex: false };
  }

  // Check for #Forex hashtag in parsed memo
  const hasForexTag = position.txns.some(txn => 
    txn.parsedMemo?.tags?.includes('Forex')
  );
  
  if (!hasForexTag) {
    return { isForex: false };
  }

  // Look for forex patterns in the memo field for additional details
  const memo = position.txns[0]?.note || '';

  // Parse forex information from memo field
  // The memo contains the forex conversion details
  const forexPatterns = [
    // "Sell 100 AUD to buy 64.2 USD" or "Buy 64.2 USD with 100 AUD"
    /(?:Sell|Buy)\s+([\d,]+\.?\d*)\s+([A-Z]{3})\s+(?:to buy|with)\s+([\d,]+\.?\d*)\s+([A-Z]{3})/i,
    // "Forex: Sell AUD, Buy USD" or similar
    /Forex:\s*(?:Sell|Buy)\s+([A-Z]{3}),\s*(?:Buy|Sell)\s+([A-Z]{3})/i,
    // "Currency conversion" patterns
    /Currency\s+conversion.*?([A-Z]{3}).*?([A-Z]{3})/i
  ];

  for (const pattern of forexPatterns) {
    const match = memo.match(pattern);
    if (match) {
      // Extract currencies and amounts from the memo
      let currency1: string;
      let currency2: string;
      let amount1: number;
      let amount2: number;

      if (pattern.source.includes('Sell') && pattern.source.includes('to buy')) {
        // "Sell X AUD to buy Y USD" format
        amount1 = parseFloat(match[1].replace(/,/g, ''));
        currency1 = match[2]; // AUD
        amount2 = parseFloat(match[3].replace(/,/g, ''));
        currency2 = match[4]; // USD
      } else if (pattern.source.includes('Buy') && pattern.source.includes('with')) {
        // "Buy X USD with Y AUD" format
        amount1 = parseFloat(match[1].replace(/,/g, '')); // USD amount
        currency1 = match[2]; // USD
        amount2 = parseFloat(match[3].replace(/,/g, '')); // AUD amount
        currency2 = match[4]; // AUD
      } else {
        // Generic forex pattern
        currency1 = match[1];
        currency2 = match[2];
        amount1 = 1; // Default values if amounts not available
        amount2 = 1;
      }

      // Always determine canonical direction based on common forex pairs
      // For AUD/USD, always show AUD → USD regardless of memo format
      let fromCurrency: string;
      let toCurrency: string;
      let exchangeRate: number | undefined;

      if (currency1 === 'AUD' && currency2 === 'USD') {
        fromCurrency = 'AUD';
        toCurrency = 'USD';
        exchangeRate = amount2 / amount1; // USD/AUD rate
      } else if (currency1 === 'USD' && currency2 === 'AUD') {
        fromCurrency = 'AUD';
        toCurrency = 'USD';
        exchangeRate = amount1 / amount2; // USD/AUD rate
      } else {
        // For other currency pairs, use the first currency as from
        fromCurrency = currency1;
        toCurrency = currency2;
        exchangeRate = amount2 / amount1;
      }

      // Determine if this is the sell leg based on the transaction's side field
      const isOutflow = position.txns[0]?.side === 'SELL';

      return {
        isForex: true,
        fromCurrency,
        toCurrency,
        exchangeRate,
        isOutflow
      };
    }
  }

  // If we have the hashtag but no detailed pattern, return basic forex info
  return {
    isForex: true,
    isOutflow: position.cashTotal.isNegative()
  };
};

export default function PositionsPage({ selectedRange }: PositionsPageProps) {
  const { 
    portfolio, 
    loading, 
    error, 
    getFilteredPositions,
    getEpisodeTags
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
          // Sort by amount, but maintain currency safety by comparing within same currency
          if (a.avgPrice.currency !== b.avgPrice.currency) {
            return a.avgPrice.currency.localeCompare(b.avgPrice.currency);
          }
          aValue = a.avgPrice.amount;
          bValue = b.avgPrice.amount;
          break;
        case 'realizedPnLTotal':
          // Sort by amount, but maintain currency safety by comparing within same currency
          if (a.realizedPnLTotal.currency !== b.realizedPnLTotal.currency) {
            return a.realizedPnLTotal.currency.localeCompare(b.realizedPnLTotal.currency);
          }
          aValue = a.realizedPnLTotal.amount;
          bValue = b.realizedPnLTotal.amount;
          break;
        case 'cashTotal':
          // Sort by amount, but maintain currency safety by comparing within same currency
          if (a.cashTotal.currency !== b.cashTotal.currency) {
            return a.cashTotal.currency.localeCompare(b.cashTotal.currency);
          }
          aValue = a.cashTotal.amount;
          bValue = b.cashTotal.amount;
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
    // Group by currency to avoid mixing currencies
    const realizedPnLByCurrency = new Map<CurrencyCode, CurrencyAmount>();
    const cashFlowByCurrency = new Map<CurrencyCode, CurrencyAmount>();
    
    filteredPositions.forEach(pos => {
      // Extract currency from the cashTotal
      const currency = pos.cashTotal.currency as CurrencyCode;
      
      if (realizedPnLByCurrency.has(currency)) {
        realizedPnLByCurrency.set(currency, realizedPnLByCurrency.get(currency)!.add(pos.realizedPnLTotal));
        cashFlowByCurrency.set(currency, cashFlowByCurrency.get(currency)!.add(pos.cashTotal));
      } else {
        realizedPnLByCurrency.set(currency, pos.realizedPnLTotal);
        cashFlowByCurrency.set(currency, pos.cashTotal);
      }
    });
    
    const totalRealizedPnL = realizedPnLByCurrency;
    const totalCashFlow = cashFlowByCurrency;

    return { totalPositions, openPositions, closedPositions, totalRealizedPnL, totalCashFlow };
  }, [filteredPositions]);



  // formatCurrencyWithSign is available if needed for future use
  // const formatCurrencyWithSign = (amount: number, currency: string = 'USD') => {
  //   const formatted = formatCurrency(amount, currency);
  //   return amount >= 0 ? `+${formatted}` : formatted;
  // };


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

  // Helper function to get badge style based on position type
  const getBadgeStyle = (position: PositionEpisode) => {
    // Check if this is a forex transaction (display only)
    const forexInfo = detectForexTransaction(position);
    if (forexInfo.isForex) {
      return BADGE_STYLES.forex;
    }
    
    if (position.kindGroup === 'CASH') {
      return BADGE_STYLES.cash;
    }
    if (position.kindGroup === 'SHARES') {
      return BADGE_STYLES.shares;
    }
    if (position.kindGroup === 'OPTION') {
      return BADGE_STYLES.options;
    }
    return BADGE_STYLES.default;
  };

  const getPositionDisplay = (position: PositionEpisode) => {
    // Check if this is a forex transaction (display only)
    const forexInfo = detectForexTransaction(position);
    if (forexInfo.isForex && forexInfo.fromCurrency && forexInfo.toCurrency) {
      // For forex, show "Cash" as ticker but include conversion details
      const ticker = 'Cash';
      // Highlight source currency for sell, destination currency for buy
      const details = forexInfo.isOutflow 
        ? `${forexInfo.fromCurrency}→${forexInfo.toCurrency}` // Highlight source (what you're selling)
        : `${forexInfo.fromCurrency}→${forexInfo.toCurrency}`; // Highlight destination (what you're buying)
      return { ticker, details, isForex: true, forexInfo };
    }

    if (position.kindGroup === 'CASH') {
      return { ticker: 'Cash', details: '' };
    }

    if (position.kindGroup === 'SHARES') {
      return { ticker: position.episodeKey, details: '' };
    }

    if (position.kindGroup === 'OPTION') {
      const right = position.currentRight || 'UNKNOWN';
      // Format strike price to show short version (71.5 instead of 71.50, 40 instead of 40.00)
      const strike = position.currentStrike ? 
        (position.currentStrike.amount % 1 === 0 ? 
          position.currentStrike.amount.toString() : 
          position.currentStrike.amount.toString().replace(/\.?0+$/, '')) : '';
      const expiry = position.currentExpiry ? new Date(position.currentExpiry).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : '';
      const optionType = right === 'CALL' ? 'c' : right === 'PUT' ? 'p' : right.toLowerCase();
      const ticker = position.episodeKey.split('|')[0] || position.episodeKey;
      const details = `${strike}${optionType} ${expiry}`.trim();
      return { ticker: ticker, details: details };
    }

    return { ticker: position.episodeKey, details: '' };
  };

  // Reusable function to format position type display (same as table)
  const getPositionTypeDisplay = (position: PositionEpisode) => {
    const forexInfo = detectForexTransaction(position);
    
    if (forexInfo.isForex) {
      return {
        badge: 'Forex',
        badgeStyle: BADGE_STYLES.forex,
        details: forexInfo.fromCurrency && forexInfo.toCurrency ? (
          <span className="text-white text-sm">
            {forexInfo.isOutflow ? (
              // Highlight source currency for sell transactions
              <>
                <span className="text-orange-400 font-semibold">{forexInfo.fromCurrency}</span>
                <span>→{forexInfo.toCurrency}</span>
              </>
            ) : (
              // Highlight destination currency for buy transactions
              <>
                <span>{forexInfo.fromCurrency}→</span>
                <span className="text-orange-400 font-semibold">{forexInfo.toCurrency}</span>
              </>
            )}
          </span>
        ) : null
      };
    }
    
    if (position.kindGroup === 'CASH') {
      // Determine cash type based on tags
      const tags = getEpisodeTags(position);
      let cashType = 'Cash';
      let badgeStyle: string = BADGE_STYLES.cash;
      
      if (tags.includes('Forex')) {
        cashType = 'Forex';
        badgeStyle = BADGE_STYLES.forex;
      } else if (tags.includes('Fees')) {
        cashType = 'Fees';
        badgeStyle = BADGE_STYLES.cash;
      } else if (tags.includes('Interest')) {
        cashType = 'Interest';
        badgeStyle = BADGE_STYLES.cash;
      } else if (tags.includes('Dividend')) {
        cashType = 'Dividend';
        badgeStyle = BADGE_STYLES.cash;
      } else if (tags.includes('Tax')) {
        cashType = 'Tax';
        badgeStyle = BADGE_STYLES.cash;
      } else if (tags.includes('Deposit')) {
        cashType = 'Deposit';
        badgeStyle = BADGE_STYLES.cash;
      } else if (tags.includes('Withdrawal')) {
        cashType = 'Withdrawal';
        badgeStyle = BADGE_STYLES.cash;
      }
      
      return {
        badge: cashType,
        badgeStyle,
        details: null
      };
    }
    
    return {
      badge: position.kindGroup,
      badgeStyle: BADGE_STYLES.default,
      details: null
    };
  };

  // Position-specific summary components
  const renderCashPositionSummary = (position: PositionEpisode) => {
    const typeDisplay = getPositionTypeDisplay(position);
    
    return (
      <div className="space-y-2">
        <div className="flex justify-center items-center">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={typeDisplay.badgeStyle}>
              {typeDisplay.badge}
            </Badge>
            {typeDisplay.details}
          </div>
        </div>
      <div className="flex justify-between">
        <span className="text-[#b3b3b3]">Amount</span>
        <span className={`text-white font-semibold ${position.cashTotal.isPositive() ? 'text-green-400' : 'text-red-400'}`}>
          {position.cashTotal.format()}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#b3b3b3]">Status</span>
        <Badge 
          variant="outline" 
          className={BADGE_STYLES.default}
        >
          {position.cashTotal.isPositive() ? 'Deposit' : 'Withdraw'}
        </Badge>
      </div>
      {position.txns.length > 0 && position.txns[0].parsedMemo?.description && (
        <div className="flex justify-between">
          <span className="text-[#b3b3b3]">Note</span>
          <span className="text-white text-sm text-right max-w-[200px]">{position.txns[0].parsedMemo.description}</span>
        </div>
      )}
      {getEpisodeTags(position).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {getEpisodeTags(position).map(tag => (
            <span key={tag} className="text-xs text-blue-400">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
    );
  };

  const renderSharesPositionSummary = (position: PositionEpisode) => (
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-[#b3b3b3]">Type</span>
        <Badge variant="outline" className={BADGE_STYLES.shares}>
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
          {position.avgPrice.format()}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#b3b3b3]">Cost Basis</span>
        <span className="text-white font-semibold">
          {position.avgPrice.multiply(position.qty).format()}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#b3b3b3]">Mkt. Value</span>
        <span className="text-white font-semibold">
          {position.avgPrice.multiply(0).format()} {/* Placeholder for future live data */}
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

    const strike = position.currentStrike?.amount || 'N/A';
    const contracts = Math.abs(position.qty); // Make unsigned
    const direction = getPositionDirection();
    const ticker = position.txns.length > 0 ? position.txns[0].ticker : 'UNKNOWN';

    return (
      <div className="space-y-2">
        <div className="text-center">
          <div className="text-lg font-semibold text-white mb-1 flex justify-center items-center gap-2">
            <Badge 
              variant="outline" 
              className={BADGE_STYLES.options}
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
            {position.avgPrice.format()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#b3b3b3]">Cost Basis</span>
          <span className="text-white font-semibold">
            {position.avgPrice.multiply(position.qty * 100).format()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#b3b3b3]">Mkt. Value</span>
          <span className="text-white font-semibold">
            {position.avgPrice.multiply(0).format()} {/* Placeholder for future live data */}
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
            <span className={`text-lg font-medium ${txn.cashDelta.isPositive() ? 'text-green-400' : 'text-red-400'}`}>
              {txn.cashDelta.format()}
            </span>
            <span className="text-xs text-[#b3b3b3]">
              {new Date(txn.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          {txn.note && (
            <div className="mt-2 text-center">
              <span className="text-[#b3b3b3] text-xs">Note: {txn.note}</span>
            </div>
          )}
        </div>
      );
    }

    // Detailed display for shares and options
    const getTransactionDescription = () => {
      const price = txn.price?.format() || '$0.00';
      
      // Use the actionTerm from the episode data (calculated during processing)
      const actionTerm = txn.actionTerm || txn.side || 'UNKNOWN';
      
      if (txn.instrumentKind === 'SHARES') {
        return `${actionTerm} ${txn.ticker} @ ${price}`;
      }
      if (txn.instrumentKind === 'CALL' || txn.instrumentKind === 'PUT') {
        const rightSuffix = txn.instrumentKind === 'PUT' ? 'p' : 'c';
        const expiry = txn.expiry ? new Date(txn.expiry).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : '';
        // Format strike price to show short version (71.5 instead of 71.50, 40 instead of 40.00)
        const strike = txn.strike ? 
          (txn.strike.amount % 1 === 0 ? 
            txn.strike.amount.toString() : 
            txn.strike.amount.toString().replace(/\.?0+$/, '')) : '';
        return `${actionTerm} ${txn.ticker} ${strike}${rightSuffix} ${expiry} @ ${price}`.trim();
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
                {txn.price?.format() || '$0.00'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#b3b3b3]">Fees</span>
              <span className="text-white">{txn.fees.format()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#b3b3b3]">Cash</span>
              <span className={`${txn.cashDelta.isPositive() ? 'text-green-400' : 'text-red-400'}`}>
                {txn.cashDelta.format()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#b3b3b3]">P&L</span>
              <span className={`${txn.realizedPnLDelta.isPositive() ? 'text-green-400' : 'text-red-400'}`}>
                {txn.realizedPnLDelta.format()}
              </span>
            </div>
            {txn.parsedMemo?.description && (
              <div className="col-span-3 text-center">
                <span className="text-[#b3b3b3] text-xs">Note: {txn.parsedMemo.description}</span>
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
            <MultiCurrencyBalanceInline 
              balances={summaryStats.totalRealizedPnL} 
              className="text-2xl font-bold"
            />
            <p className="text-xs text-[#b3b3b3]">Total realized</p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Cash Flow</CardTitle>
            <DollarSign className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <MultiCurrencyBalanceInline 
              balances={summaryStats.totalCashFlow} 
              className="text-2xl font-bold"
            />
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
        <CardContent className="p-0">
          {sortedPositions.length === 0 ? (
            <div className="text-center py-8 px-6">
              <div className="text-lg text-[#b3b3b3]">No positions found</div>
              <div className="text-sm text-[#b3b3b3] mt-2">Try adjusting your time range or add some transactions</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm relative" style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}>
                <thead>
                  <tr className="border-b border-[#2d2d2d]">
                    {renderSortableHeader('episodeKey', 'Ticker')}
                    {renderSortableHeader('kindGroup', 'Type')}
                    {renderSortableHeader('qty', 'Quantity', 'right')}
                    {renderSortableHeader('avgPrice', 'Avg Price', 'right')}
                    {renderSortableHeader('openTimestamp', 'Open Date')}
                    {renderSortableHeader('realizedPnLTotal', 'Realized P&L', 'right')}
                    {renderSortableHeader('cashTotal', 'Cash Flow', 'right')}
                    <th className="text-left py-2 px-2 text-[#b3b3b3] font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPositions.map((position) => (
                    <tr
                      key={position.episodeId}
                      className={`border-b border-[#2a2a2a] hover:bg-[#2a2a2a] cursor-pointer font-mono transition-colors duration-150 ${
                        position.qty !== 0 ? 'bg-[#1a1a1a]' : 'bg-[#121212]'
                      }`}
                      onClick={() => handlePositionClick(position)}
                      style={{ position: 'relative', zIndex: 1 }}
                    >
                      <td className="py-2 px-2">
                        <div className="text-white text-sm">
                          {getPositionDisplay(position).ticker}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`${getBadgeStyle(position)} w-16 text-center`}
                          >
                            {(() => {
                              const typeDisplay = getPositionTypeDisplay(position);
                              if (position.kindGroup === 'OPTION') {
                                return position.optionDirection === 'CALL' ? 'Call' :
                                       position.optionDirection === 'PUT' ? 'Put' :
                                       position.optionDirection || 'Option';
                              }
                              return typeDisplay.badge;
                            })()}
                          </Badge>
                          {(() => {
                            const display = getPositionDisplay(position);
                            if (display.isForex && display.details) {
                              // Highlight currencies for forex transactions
                              const { fromCurrency, toCurrency, isOutflow } = display.forexInfo;
                              return (
                                <span className="text-white text-sm">
                                  {isOutflow ? (
                                    // Highlight source currency for sell transactions
                                    <>
                                      <span className="text-orange-400 font-semibold">{fromCurrency}</span>
                                      <span>→{toCurrency}</span>
                                    </>
                                  ) : (
                                    // Highlight destination currency for buy transactions
                                    <>
                                      <span>{fromCurrency}→</span>
                                      <span className="text-orange-400 font-semibold">{toCurrency}</span>
                                    </>
                                  )}
                                </span>
                              );
                            }
                            if (position.kindGroup === 'OPTION' && display.details) {
                              return (
                                <span className="text-white text-sm">
                                  {display.details}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right text-white">
                        {position.kindGroup === 'CASH' ? '' : (position.qty === 0 ? '' : position.qty)}
                      </td>
                      <td className="py-2 px-2 text-right text-white">
                        {position.kindGroup === 'CASH' ? '' : position.avgPrice.format()}
                      </td>
                      <td className="py-2 px-2 text-white text-xs">
                        {new Date(position.openTimestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {position.kindGroup === 'CASH' ? (
                          ''
                        ) : (
                          <span className={position.realizedPnLTotal.isPositive() ? 'text-green-400' : 'text-red-400'}>
                            {position.realizedPnLTotal.format()}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className={position.cashTotal.isPositive() ? 'text-green-400' : 'text-red-400'}>
                          {position.cashTotal.format()}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <Badge 
                          variant="outline" 
                          className={
                            position.kindGroup === 'CASH' || position.qty === 0 
                              ? BADGE_STYLES.default
                              : BADGE_STYLES.open
                          }
                        >
                          {position.kindGroup === 'CASH' 
                            ? (position.cashTotal.isPositive() ? 'Deposit' : 'Withdraw')
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
                title="Position Details"
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
                      <span className={selectedPosition.realizedPnLTotal.isPositive() ? 'text-green-400' : 'text-red-400'}>
                        {selectedPosition.realizedPnLTotal.format()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#b3b3b3]">Cash Flow</span>
                    <span className={selectedPosition.cashTotal.isPositive() ? 'text-green-400' : 'text-red-400'}>
                      {selectedPosition.cashTotal.format()}
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
