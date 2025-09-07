'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { ThemeButton } from './ui/theme-button';

export type TimeScale = 'day' | 'week' | 'month' | 'year';

export interface TimeRange {
  startDate: Date;
  endDate: Date;
  scale: TimeScale;
  label: string;
}

interface TimeRangeSelectorProps {
  onRangeChange: (range: TimeRange) => void;
  initialScale?: TimeScale;
}

export default function TimeRangeSelector({ 
  onRangeChange, 
  initialScale = 'week' 
}: TimeRangeSelectorProps) {
  const [currentScale, setCurrentScale] = useState<TimeScale>(initialScale);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const hasNotifiedParent = useRef(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Calculate the current time range based on scale and date
  const calculateTimeRange = useCallback((date: Date, scale: TimeScale): TimeRange => {
    const startDate = new Date(date);
    const endDate = new Date(date);
    
    switch (scale) {
      case 'day':
        // Single day: start and end are the same day
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        return {
          startDate,
          endDate,
          scale,
          label: date.toLocaleDateString('en-US', { 
            month: 'numeric', 
            day: 'numeric'
          })
        };

      case 'week':
        // Week: Saturday to Friday
        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        
        // Find the Friday of this week
        let daysToFriday;
        if (dayOfWeek === 5) { // Friday
          daysToFriday = 0;
        } else if (dayOfWeek === 6) { // Saturday
          daysToFriday = -6; // Go to previous Friday (current week)
        } else { // Sunday (0) through Thursday (4)
          daysToFriday = (5 - dayOfWeek + 7) % 7;
        }
        
        // Calculate Friday date first
        const fridayDate = new Date(date);
        fridayDate.setDate(date.getDate() + daysToFriday);
        fridayDate.setHours(23, 59, 59, 999);
        
        // Calculate Saturday date (6 days before Friday)
        const saturdayDate = new Date(fridayDate);
        saturdayDate.setDate(fridayDate.getDate() - 6);
        saturdayDate.setHours(0, 0, 0, 0);
        
        // Set the dates by copying values
        startDate.setTime(saturdayDate.getTime());
        endDate.setTime(fridayDate.getTime());
        
        // Debug logging for week calculation
        console.log('Week calculation debug:', {
          inputDate: date.toISOString(),
          dayOfWeek,
          daysToFriday,
          fridayDate: fridayDate.toISOString(),
          saturdayDate: saturdayDate.toISOString(),
          calculatedStart: startDate.toISOString(),
          calculatedEnd: endDate.toISOString(),
          weekSpan: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        });
        
        return {
          startDate,
          endDate,
          scale,
          label: `End ${endDate.toLocaleDateString('en-US', { 
            month: 'numeric', 
            day: 'numeric' 
          })}`
        };

      case 'month':
        // Month: First day to last day of month
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        
        endDate.setMonth(date.getMonth() + 1, 0); // Last day of month
        endDate.setHours(23, 59, 59, 999);
        
        return {
          startDate,
          endDate,
          scale,
          label: date.toLocaleDateString('en-US', { 
            month: 'short'
          })
        };

      case 'year':
        // Year: January 1st to December 31st
        startDate.setMonth(0, 1); // January 1st
        startDate.setHours(0, 0, 0, 0);
        
        endDate.setMonth(11, 31); // December 31st
        endDate.setHours(23, 59, 59, 999);
        
        return {
          startDate,
          endDate,
          scale,
          label: date.getFullYear().toString()
        };

      default:
        throw new Error(`Unknown time scale: ${scale}`);
    }
  }, []);

  // Get current time range
  const currentRange = calculateTimeRange(currentDate, currentScale);

  // Debug logging
  console.log('TimeRangeSelector debug:', {
    currentDate: currentDate.toISOString(),
    currentScale,
    calculatedRange: {
      start: currentRange.startDate.toISOString(),
      end: currentRange.endDate.toISOString(),
      label: currentRange.label
    }
  });

  // Notify parent of range changes (only once on mount and when range actually changes)
  useEffect(() => {
    if (!hasNotifiedParent.current) {
      hasNotifiedParent.current = true;
      onRangeChange(currentRange);
    }
  }, [currentRange, onRangeChange]);

  // Notify parent when range changes due to user interaction
  const notifyParent = useCallback((range: TimeRange) => {
    onRangeChange(range);
  }, [onRangeChange]);

  // Navigation functions
  const goToPrevious = useCallback(() => {
    const newDate = new Date(currentDate);
    
    switch (currentScale) {
      case 'day':
        newDate.setDate(currentDate.getDate() - 1);
        break;
      case 'week':
        newDate.setDate(currentDate.getDate() - 7);
        break;
      case 'month':
        newDate.setMonth(currentDate.getMonth() - 1);
        break;
      case 'year':
        newDate.setFullYear(currentDate.getFullYear() - 1);
        break;
    }
    
    setCurrentDate(newDate);
    const newRange = calculateTimeRange(newDate, currentScale);
    notifyParent(newRange);
  }, [currentDate, currentScale, calculateTimeRange, notifyParent]);

  const goToNext = useCallback(() => {
    const newDate = new Date(currentDate);
    
    switch (currentScale) {
      case 'day':
        newDate.setDate(currentDate.getDate() + 1);
        break;
      case 'week':
        newDate.setDate(currentDate.getDate() + 7);
        break;
      case 'month':
        newDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'year':
        newDate.setFullYear(currentDate.getFullYear() + 1);
        break;
    }
    
    setCurrentDate(newDate);
    const newRange = calculateTimeRange(newDate, currentScale);
    notifyParent(newRange);
  }, [currentDate, currentScale, calculateTimeRange, notifyParent]);



  const handleScaleChange = useCallback((scale: TimeScale) => {
    setCurrentScale(scale);
    // When changing scale, jump to the current period of that scale
    const now = new Date();
    setCurrentDate(now);
    const newRange = calculateTimeRange(now, scale);
    notifyParent(newRange);
  }, [calculateTimeRange, notifyParent]);

  // Handle calendar date selection
  const handleDateSelect = useCallback((selectedDate: Date) => {
    setCurrentDate(selectedDate);
    const newRange = calculateTimeRange(selectedDate, currentScale);
    notifyParent(newRange);
    setShowCalendar(false);
  }, [currentScale, calculateTimeRange, notifyParent]);

  // Toggle calendar (same pattern as user menu)
  const toggleCalendar = () => {
    setShowCalendar(prev => !prev);
  };

  // Handle clicking outside the calendar (same pattern as user menu)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if clicking on the calendar trigger button
      const target = event.target as Node;
      const calendarTrigger = document.querySelector('[data-calendar-trigger]');
      
      if (calendarRef.current && !calendarRef.current.contains(target) && 
          calendarTrigger && !calendarTrigger.contains(target)) {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar]);

  return (
    <div className="relative flex flex-col items-center gap-1.5 w-full max-w-[180px]">
      {/* Navigation */}
      <div className="flex items-center gap-0.5 w-full">
        <ThemeButton
          onClick={goToPrevious}
          size="sm"
          className="p-1 flex-shrink-0 h-7"
        >
          <ChevronLeft className="h-3 w-3" />
        </ThemeButton>

        <ThemeButton
          onClick={toggleCalendar}
          size="sm"
          className="px-1.5 py-1 text-xs font-medium flex-1 min-w-0 h-7 flex items-center gap-1"
          data-calendar-trigger
        >
          <Calendar className="h-3 w-3" />
          {currentRange.label}
        </ThemeButton>

        <ThemeButton
          onClick={goToNext}
          size="sm"
          className="p-1 flex-shrink-0 h-7"
        >
          <ChevronRight className="h-3 w-3" />
        </ThemeButton>
      </div>

      {/* Scale selector */}
      <div className="flex rounded border border-gray-600 bg-gray-800 p-0.5 w-full">
        {(['day', 'week', 'month', 'year'] as TimeScale[]).map((scale) => (
          <button
            key={scale}
            onClick={() => handleScaleChange(scale)}
            className={`px-1.5 py-1 text-xs font-medium rounded transition-colors flex-1 h-7 ${
              currentScale === scale
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
          >
            {scale.charAt(0).toUpperCase()}
          </button>
        ))}
      </div>

      {/* Calendar Popup */}
      {showCalendar && (
        <div 
          ref={calendarRef}
          className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg shadow-lg z-50 p-3"
        >
          <CalendarGrid 
            selectedDate={currentDate}
            onDateSelect={handleDateSelect}
          />
        </div>
      )}
    </div>
  );
}

// Simple Calendar Grid Component
function CalendarGrid({ selectedDate, onDateSelect }: { selectedDate: Date; onDateSelect: (date: Date) => void }) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);
  
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  
  const days = [];
  const today = new Date();
  
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    days.push(date);
  }
  
  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };
  
  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString();
  };
  
  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
  };
  
  return (
    <div className="w-64">
      {/* Month Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          className="p-1 hover:bg-gray-700 rounded"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-white">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          className="p-1 hover:bg-gray-700 rounded"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      
      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <div key={index} className="text-xs text-gray-400 text-center p-1">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => (
          <button
            key={index}
            onClick={() => onDateSelect(date)}
            className={`text-xs p-1 rounded hover:bg-gray-700 ${
              isSelected(date)
                ? 'bg-blue-600 text-white'
                : isToday(date)
                ? 'bg-gray-600 text-white'
                : isCurrentMonth(date)
                ? 'text-white'
                : 'text-gray-500'
            }`}
          >
            {date.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
}
