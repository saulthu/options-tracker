import React from 'react';
import { Badge } from '@/components/ui/badge';

interface PositionBadgeDisplayProps {
  side: string;
  right?: string;
  ticker?: string;
  strike?: string | number;
  expiry?: string;
  className?: string;
}

export default function PositionBadgeDisplay({
  side,
  right,
  ticker,
  strike,
  expiry,
  className = ""
}: PositionBadgeDisplayProps) {
  const getTradingTerm = () => {
    if (side === 'SELL' && right === 'PUT') {
      return 'CSP';
    } else if (side === 'SELL' && right === 'CALL') {
      return 'CC';
    } else if (side === 'BUY' && right === 'CALL') {
      return 'CALL';
    } else if (side === 'BUY' && right === 'PUT') {
      return 'PUT';
    } else {
      return side; // For CASH, SHARES, or other cases
    }
  };

  const getTradingTermColor = () => {
    if (side === 'SELL' && (right === 'PUT' || right === 'CALL')) {
      return 'bg-red-600 text-white border-red-600'; // Selling options
    } else if (side === 'BUY' && (right === 'CALL' || right === 'PUT')) {
      return 'bg-green-600 text-white border-green-600'; // Buying options
    } else {
      // For CASH, SHARES, or other cases
      switch (side) {
        case 'BUY':
          return 'bg-green-600 text-white border-green-600';
        case 'SELL':
          return 'bg-red-600 text-white border-red-600';
        default:
          return 'bg-blue-600 text-white border-blue-600';
      }
    }
  };

  const formatExpiryDate = (expiry: string) => {
    const date = new Date(expiry);
    const currentYear = new Date().getFullYear();
    const expiryYear = date.getFullYear();

    if (expiryYear === currentYear) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    }
  };

  const getDisplayText = () => {
    const tickerText = ticker || 'UNKNOWN';
    if (right && strike && expiry) {
      // Options: GOOGL $170 Sep 26
      return `${tickerText} $${strike} ${formatExpiryDate(expiry)}`;
    } else if (right && strike) {
      // Options without expiry: GOOGL $170
      return `${tickerText} $${strike}`;
    } else {
      // Shares or Cash: GOOGL
      return tickerText;
    }
  };

  return (
    <div className={`flex items-center ${className}`}>
      <Badge 
        variant="outline" 
        className={`text-xs ${getTradingTermColor()}`}
      >
        {getTradingTerm()}
      </Badge>
      <span className="ml-2">{getDisplayText()}</span>
    </div>
  );
}
