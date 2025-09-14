'use client';

import React from 'react';
import Select from '@/components/ui/select';
import { Filter } from 'lucide-react';

interface TickerFilterProps {
  value: string;
  onChange: (ticker: string) => void;
  availableTickers: string[];
  className?: string;
}

export default function TickerFilter({ 
  value, 
  onChange, 
  availableTickers,
  className = "" 
}: TickerFilterProps) {
  // Convert availableTickers to Select options format
  const tickerOptions = [
    { value: '', label: 'All Tickers' },
    ...availableTickers.map(ticker => ({ value: ticker, label: ticker }))
  ];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-2 text-[#b3b3b3]">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Ticker</span>
      </div>
      
      <div className="min-w-0">
        <Select
          value={value}
          onChange={onChange}
          options={tickerOptions}
          placeholder="All Tickers"
          className="w-32"
        />
      </div>
    </div>
  );
}
