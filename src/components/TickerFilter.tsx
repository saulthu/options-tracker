'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Filter } from 'lucide-react';

interface TickerFilterProps {
  value: string;
  onChange: (ticker: string) => void;
  availableTickers: string[];
}

export default function TickerFilter({ value, onChange, availableTickers }: TickerFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleTickerSelect = (ticker: string) => {
    onChange(ticker);
    setIsOpen(false);
  };

  const displayValue = value || 'All Tickers';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1 text-xs font-medium flex items-center justify-between gap-2 h-7 min-w-[120px] rounded border border-gray-600 bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Filter className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{displayValue}</span>
        </div>
        <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[120px] max-w-[200px] bg-gray-800 border border-gray-600 rounded shadow-lg z-50 max-h-60 overflow-y-auto">
          <button
            onClick={() => handleTickerSelect('')}
            className={`w-full px-3 py-2 text-xs text-left hover:bg-gray-700 transition-colors ${
              !value ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
            }`}
          >
            All Tickers
          </button>
          {availableTickers.map(ticker => (
            <button
              key={ticker}
              onClick={() => handleTickerSelect(ticker)}
              className={`w-full px-3 py-2 text-xs text-left hover:bg-gray-700 transition-colors ${
                value === ticker ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              {ticker}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
