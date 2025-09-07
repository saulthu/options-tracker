'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { TimeRange } from '@/components/TimeRangeSelector';

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
  const getInitialRange = (): TimeRange => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Find the Friday of this week (Saturday to Friday)
    let daysToFriday;
    if (dayOfWeek === 5) { // Friday
      daysToFriday = 0;
    } else if (dayOfWeek === 6) { // Saturday
      daysToFriday = -6; // Go to previous Friday (current week)
    } else { // Sunday (0) through Thursday (4)
      daysToFriday = (5 - dayOfWeek + 7) % 7;
    }
    
    // Calculate Friday date
    const fridayDate = new Date(now);
    fridayDate.setDate(now.getDate() + daysToFriday);
    fridayDate.setHours(23, 59, 59, 999);
    
    // Calculate Saturday date (6 days before Friday)
    const saturdayDate = new Date(fridayDate);
    saturdayDate.setDate(fridayDate.getDate() - 6);
    saturdayDate.setHours(0, 0, 0, 0);
    
    return {
      startDate: saturdayDate,
      endDate: fridayDate,
      scale: 'week',
      label: `End ${fridayDate.toLocaleDateString('en-US', { 
        month: 'numeric', 
        day: 'numeric' 
      })}`
    };
  };

  const [selectedRange, setSelectedRange] = useState<TimeRange | null>(getInitialRange());

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
