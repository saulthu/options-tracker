import React from 'react';
import { CurrencyAmount, CurrencyCode } from '@/lib/currency-amount';

interface MultiCurrencyBalanceProps {
  balances: Map<CurrencyCode, CurrencyAmount>;
  className?: string;
  showZero?: boolean;
}

export default function MultiCurrencyBalance({ 
  balances, 
  className = '', 
  showZero = false 
}: MultiCurrencyBalanceProps) {
  if (balances.size === 0) {
    return <span className={`text-[#b3b3b3] ${className}`}>No data</span>;
  }

  const nonZeroBalances = Array.from(balances.entries())
    .filter(([, amount]) => showZero || !amount.isZero())
    .sort(([a], [b]) => a.localeCompare(b));

  if (nonZeroBalances.length === 0) {
    return <span className={`text-[#b3b3b3] ${className}`}>$0.00</span>;
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {nonZeroBalances.map(([currency, amount]) => (
        <div 
          key={currency} 
          className={`text-sm font-medium ${
            amount.isPositive() ? 'text-green-400' : 
            amount.isNegative() ? 'text-red-400' : 
            'text-[#b3b3b3]'
          }`}
        >
          {amount.formatShort()}
        </div>
      ))}
    </div>
  );
}

// Helper component for single-line display
export function MultiCurrencyBalanceInline({ 
  balances, 
  className = '', 
  showZero = false 
}: MultiCurrencyBalanceProps) {
  if (balances.size === 0) {
    return <span className={`text-[#b3b3b3] ${className}`}>No data</span>;
  }

  const nonZeroBalances = Array.from(balances.entries())
    .filter(([, amount]) => showZero || !amount.isZero())
    .sort(([a], [b]) => a.localeCompare(b));

  if (nonZeroBalances.length === 0) {
    return <span className={`text-[#b3b3b3] ${className}`}>$0.00</span>;
  }

  if (nonZeroBalances.length === 1) {
    const [, amount] = nonZeroBalances[0];
    return (
      <span 
        className={`text-sm font-medium ${
          amount.isPositive() ? 'text-green-400' : 
          amount.isNegative() ? 'text-red-400' : 
          'text-[#b3b3b3]'
        } ${className}`}
      >
        {amount.formatShort()}
      </span>
    );
  }

  // Multiple currencies - show as comma-separated list
  return (
    <span className={`text-sm font-medium ${className}`}>
      {nonZeroBalances.map(([currency, amount]) => (
        <span 
          key={currency}
          className={
            amount.isPositive() ? 'text-green-400' : 
            amount.isNegative() ? 'text-red-400' : 
            'text-[#b3b3b3]'
          }
        >
          {amount.formatShort()}
        </span>
      )).reduce((acc, curr, index) => 
        index === 0 ? [curr] : [...acc, <span key={`sep-${index}`} className="text-[#b3b3b3]">, </span>, curr], 
        [] as React.ReactNode[]
      )}
    </span>
  );
}
