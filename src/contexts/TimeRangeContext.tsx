'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { TimeRange } from '@/components/TimeRangeSelector';
import { getInitialTimeRange } from '@/lib/time-range-utils';

interface TimeRangeContextType {
  selectedRange: TimeRange | null;
  setSelectedRange: (range: TimeRange) => void;
  handleRangeChange: (range: TimeRange) => void;
}

const TimeRangeContext = createContext<TimeRangeContextType | undefined>(undefined);

interface TimeRangeProviderProps {
  children: ReactNode;
}

export function TimeRangeProvider({ children }: TimeRangeProviderProps) {
  // Initialize with current week as default

  const [selectedRange, setSelectedRange] = useState<TimeRange | null>(getInitialTimeRange());

  const handleRangeChange = useCallback((range: TimeRange) => {
    console.log('Time range changed to:', range);
    setSelectedRange(range);
  }, []);

  const value: TimeRangeContextType = {
    selectedRange,
    setSelectedRange,
    handleRangeChange,
  };

  return (
    <TimeRangeContext.Provider value={value}>
      {children}
    </TimeRangeContext.Provider>
  );
}

export function useTimeRange() {
  const context = useContext(TimeRangeContext);
  if (context === undefined) {
    throw new Error('useTimeRange must be used within a TimeRangeProvider');
  }
  return context;
}
