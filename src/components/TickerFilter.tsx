'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

interface TickerFilterProps {
  value: string;
  onChange: (ticker: string) => void;
  availableTickers: string[];
}

export default function TickerFilter({ value, onChange, availableTickers }: TickerFilterProps) {
  return (
    <div className="relative">
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none pl-3 pr-10 py-2 bg-[#1a1a1a] border border-[#2d2d2d] rounded-md text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-w-[150px] cursor-pointer"
        >
          <option value="">All Tickers</option>
          {availableTickers.map(ticker => (
            <option key={ticker} value={ticker} className="bg-[#1a1a1a] text-white">
              {ticker}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#b3b3b3] pointer-events-none" />
      </div>
    </div>
  );
}
