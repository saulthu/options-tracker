"use client";

import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { ThemeButton } from "@/components/ui/theme-button";

export type DateRange = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom';

interface DateRangeSelectorProps {
  selectedRange: DateRange;
  onRangeChange: (range: DateRange) => void;
  customStartDate?: string;
  customEndDate?: string;
  onCustomDateChange?: (startDate: string, endDate: string) => void;
}

export default function DateRangeSelector({
  selectedRange,
  onRangeChange,
  customStartDate,
  customEndDate,
  onCustomDateChange
}: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomInputs, setShowCustomInputs] = useState(false);

  const getRangeLabel = (range: DateRange) => {
    switch (range) {
      case '7d': return 'This Trading Week';
      case '30d': return 'This Month';
      case '90d': return 'Last 3 Months';
      case '1y': return 'This Year';
      case 'all': return 'All Time';
      case 'custom': return 'Custom Range';
      default: return 'This Trading Week';
    }
  };

  const getRangeDescription = (range: DateRange) => {
    const now = new Date();
    switch (range) {
      case '7d': {
        // Find the most recent Friday (end of trading week)
        const daysSinceFriday = (now.getDay() + 2) % 7; // Friday is day 5, so (5 + 2) % 7 = 0
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() - daysSinceFriday);
        
        // Start of week is 6 days before Friday (Saturday)
        const startOfWeek = new Date(endOfWeek);
        startOfWeek.setDate(endOfWeek.getDate() - 6);
        
        return `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;
      }
      case '30d': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return `${startOfMonth.toLocaleDateString()} - ${now.toLocaleDateString()}`;
      }
      case '90d': {
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        return `${threeMonthsAgo.toLocaleDateString()} - ${now.toLocaleDateString()}`;
      }
      case '1y': {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return `${startOfYear.toLocaleDateString()} - ${now.toLocaleDateString()}`;
      }
      case 'all': return 'All available data';
      case 'custom': return customStartDate && customEndDate 
        ? `${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`
        : 'Select custom dates';
      default: return '';
    }
  };

  const handleRangeSelect = (range: DateRange) => {
    if (range === 'custom') {
      setShowCustomInputs(true);
    } else {
      setShowCustomInputs(false);
      onRangeChange(range);
      setIsOpen(false);
    }
  };

  const handleCustomDateSubmit = () => {
    if (customStartDate && customEndDate && onCustomDateChange) {
      onCustomDateChange(customStartDate, customEndDate);
      onRangeChange('custom');
      setIsOpen(false);
      setShowCustomInputs(false);
    }
  };

  return (
    <div className="relative">
      <ThemeButton
        onClick={() => setIsOpen(!isOpen)}
        className="bg-[#2d2d2d] hover:bg-[#404040] border border-[#404040] text-white"
      >
        <Calendar className="w-4 h-4 mr-2" />
        {getRangeLabel(selectedRange)}
        <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </ThemeButton>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg shadow-lg z-50">
          <div className="p-3">
            <div className="text-sm font-medium text-white mb-3">Select Date Range</div>
            
            {/* Preset ranges */}
            <div className="space-y-2 mb-4">
              {(['7d', '30d', '90d', '1y', 'all'] as DateRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => handleRangeSelect(range)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedRange === range
                      ? 'bg-blue-600 text-white'
                      : 'text-[#b3b3b3] hover:bg-[#2d2d2d] hover:text-white'
                  }`}
                >
                  <div className="font-medium">{getRangeLabel(range)}</div>
                  <div className="text-xs opacity-75">{getRangeDescription(range)}</div>
                </button>
              ))}
            </div>

            {/* Custom range option */}
            <div className="border-t border-[#2d2d2d] pt-3">
              <button
                onClick={() => handleRangeSelect('custom')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedRange === 'custom'
                    ? 'bg-blue-600 text-white'
                    : 'text-[#b3b3b3] hover:bg-[#2d2d2d] hover:text-white'
                }`}
              >
                <div className="font-medium">Custom Range</div>
                <div className="text-xs opacity-75">Select specific start and end dates</div>
              </button>

              {showCustomInputs && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs text-[#b3b3b3] mb-1">Start Date</label>
                    <input
                      type="date"
                      value={customStartDate || ''}
                      onChange={(e) => onCustomDateChange?.(e.target.value, customEndDate || '')}
                      className="w-full px-2 py-1 bg-[#2d2d2d] border border-[#404040] rounded text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#b3b3b3] mb-1">End Date</label>
                    <input
                      type="date"
                      value={customEndDate || ''}
                      onChange={(e) => onCustomDateChange?.(customStartDate || '', e.target.value)}
                      className="w-full px-2 py-1 bg-[#2d2d2d] border border-[#404040] rounded text-white text-sm"
                    />
                  </div>
                  <ThemeButton
                    onClick={handleCustomDateSubmit}
                    disabled={!customStartDate || !customEndDate}
                    className="w-full text-sm"
                  >
                    Apply Custom Range
                  </ThemeButton>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Current range description */}
      <div className="text-xs text-[#b3b3b3] mt-1 text-right">
        {getRangeDescription(selectedRange)}
      </div>
    </div>
  );
}
