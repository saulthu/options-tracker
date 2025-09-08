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
    
    // Find the Saturday of this week (Sunday to Saturday)
    let daysToSaturday;
    if (dayOfWeek === 6) { // Saturday
      daysToSaturday = 0;
    } else { // Sunday (0) through Friday (5)
      daysToSaturday = (6 - dayOfWeek + 7) % 7;
    }
    
    // Calculate Saturday date
    const saturdayDate = new Date(now);
    saturdayDate.setDate(now.getDate() + daysToSaturday);
    saturdayDate.setHours(23, 59, 59, 999);
    
    // Calculate Sunday date (6 days before Saturday)
    const sundayDate = new Date(saturdayDate);
    sundayDate.setDate(saturdayDate.getDate() - 6);
    sundayDate.setHours(0, 0, 0, 0);
    
    // Calculate Friday for the label (5 days before Saturday)
    const fridayDate = new Date(saturdayDate);
    fridayDate.setDate(saturdayDate.getDate() - 1);
    
    return {
      startDate: sundayDate,
      endDate: saturdayDate,
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
