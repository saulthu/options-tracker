'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { ThemeButton } from './ui/theme-button';
import { calculateTimeRange } from '@/lib/time-range-utils';

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
  selectedRange?: TimeRange | null;
}

export default function TimeRangeSelector({ 
  onRangeChange, 
  initialScale = 'week',
  selectedRange
}: TimeRangeSelectorProps) {
  // Use selectedRange as the source of truth, fallback to initial values
  const currentScale = selectedRange?.scale ?? initialScale;
  const currentDate = useMemo(() => selectedRange?.startDate ?? new Date(), [selectedRange?.startDate]);
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Calculate the current time range based on scale and date

  // Use selectedRange if available, otherwise calculate from current date/scale
  const currentRange = selectedRange || calculateTimeRange(currentDate, currentScale);

  // Navigation functions
  const goToPrevious = useCallback(() => {
    let newDate: Date;
    
    if (currentScale === 'week' && selectedRange) {
      // For week navigation, use the Saturday date (endDate) as reference
      newDate = new Date(selectedRange.endDate);
      newDate.setDate(selectedRange.endDate.getDate() - 7);
    } else {
      // For other scales, use the current date
      newDate = new Date(currentDate);
      switch (currentScale) {
        case 'day':
          newDate.setDate(currentDate.getDate() - 1);
          break;
        case 'month':
          newDate.setMonth(currentDate.getMonth() - 1);
          break;
        case 'year':
          newDate.setFullYear(currentDate.getFullYear() - 1);
          break;
      }
    }
    
    const newRange = calculateTimeRange(newDate, currentScale);
    onRangeChange(newRange);
  }, [currentDate, currentScale, onRangeChange, selectedRange]);

  const goToNext = useCallback(() => {
    let newDate: Date;
    
    if (currentScale === 'week' && selectedRange) {
      // For week navigation, use the Saturday date (endDate) as reference
      newDate = new Date(selectedRange.endDate);
      newDate.setDate(selectedRange.endDate.getDate() + 7);
    } else {
      // For other scales, use the current date
      newDate = new Date(currentDate);
      switch (currentScale) {
        case 'day':
          newDate.setDate(currentDate.getDate() + 1);
          break;
        case 'month':
          newDate.setMonth(currentDate.getMonth() + 1);
          break;
        case 'year':
          newDate.setFullYear(currentDate.getFullYear() + 1);
          break;
      }
    }
    
    const newRange = calculateTimeRange(newDate, currentScale);
    onRangeChange(newRange);
  }, [currentDate, currentScale, onRangeChange, selectedRange]);



  const handleScaleChange = useCallback((scale: TimeScale) => {
    // When changing scale, jump to the current period of that scale
    const now = new Date();
    const newRange = calculateTimeRange(now, scale);
    onRangeChange(newRange);
  }, [onRangeChange]);

  // Handle calendar date selection
  const handleDateSelect = useCallback((selectedDate: Date) => {
    const newRange = calculateTimeRange(selectedDate, currentScale);
    onRangeChange(newRange);
    setShowCalendar(false);
  }, [currentScale, onRangeChange]);

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
          className="px-1.5 py-1 text-xs font-medium flex-1 min-w-0 h-7 flex items-center justify-start gap-1"
          data-calendar-trigger
        >
          <Calendar className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{currentRange.label}</span>
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
          {currentScale === 'month' && (
            <MonthSelector 
              selectedDate={currentDate}
              onDateSelect={handleDateSelect}
            />
          )}
          {currentScale === 'year' && (
            <YearSelector 
              selectedDate={currentDate}
              onDateSelect={handleDateSelect}
            />
          )}
          {currentScale === 'week' && (
            <WeekCalendar 
              selectedDate={currentDate}
              onDateSelect={handleDateSelect}
            />
          )}
          {currentScale === 'day' && (
            <DayCalendar 
              selectedDate={currentDate}
              onDateSelect={handleDateSelect}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Month Selector - List of months with year navigation
function MonthSelector({ selectedDate, onDateSelect }: { selectedDate: Date; onDateSelect: (date: Date) => void }) {
  const [currentYear, setCurrentYear] = useState(selectedDate.getFullYear());
  const currentMonth = selectedDate.getMonth();
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(currentYear, monthIndex, 1);
    onDateSelect(newDate);
  };
  
  const goToPreviousYear = () => {
    setCurrentYear(prev => prev - 1);
  };
  
  const goToNextYear = () => {
    setCurrentYear(prev => prev + 1);
  };
  
  return (
    <div className="w-64">
      {/* Year Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goToPreviousYear}
          className="p-1 hover:bg-gray-700 rounded"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-lg font-medium text-white">{currentYear}</span>
        <button
          onClick={goToNextYear}
          className="p-1 hover:bg-gray-700 rounded"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      
      {/* Month List */}
      <div className="grid grid-cols-3">
        {months.map((month, index) => (
          <button
            key={index}
            onClick={() => handleMonthSelect(index)}
            className={`h-10 w-full flex items-center justify-center text-sm hover:bg-gray-700 transition-colors ${
              index === currentMonth && currentYear === selectedDate.getFullYear()
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            {month.substring(0, 3)}
          </button>
        ))}
      </div>
    </div>
  );
}

// Year Selector - List of years
function YearSelector({ selectedDate, onDateSelect }: { selectedDate: Date; onDateSelect: (date: Date) => void }) {
  const currentYear = selectedDate.getFullYear();
  const [displayYear, setDisplayYear] = useState(currentYear);
  
  const years = [];
  for (let year = displayYear - 5; year <= displayYear + 6; year++) {
    years.push(year);
  }
  
  const handleYearSelect = (year: number) => {
    const newDate = new Date(year, 0, 1);
    onDateSelect(newDate);
  };
  
  const goToPreviousDecade = () => {
    setDisplayYear(prev => prev - 12);
  };
  
  const goToNextDecade = () => {
    setDisplayYear(prev => prev + 12);
  };
  
  return (
    <div className="w-64">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goToPreviousDecade}
          className="p-1 hover:bg-gray-700 rounded"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-white">
          {displayYear - 5} - {displayYear + 6}
        </span>
        <button
          onClick={goToNextDecade}
          className="p-1 hover:bg-gray-700 rounded"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-4">
        {years.map((year) => (
          <button
            key={year}
            onClick={() => handleYearSelect(year)}
            className={`h-10 w-full flex items-center justify-center text-sm hover:bg-gray-700 transition-colors ${
              year === currentYear
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            {year}
          </button>
        ))}
      </div>
    </div>
  );
}

// Week Calendar - Calendar with week row highlighting
function WeekCalendar({ 
  selectedDate, 
  onDateSelect
}: { 
  selectedDate: Date; 
  onDateSelect: (date: Date) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);
  
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
  
  // Group days into weeks for highlighting (Sunday to Saturday)
  const weeks: Date[][] = [];
  
  // Find the Sunday of the first week in our grid
  const firstSunday = new Date(startDate);
  const firstDayOfWeek = startDate.getDay();
  const daysToFirstSunday = firstDayOfWeek === 0 ? 0 : (7 - firstDayOfWeek) % 7;
  firstSunday.setDate(startDate.getDate() - daysToFirstSunday);
  
  // Create weeks starting from the first Sunday
  for (let weekIndex = 0; weekIndex < 6; weekIndex++) {
    const weekStart = new Date(firstSunday);
    weekStart.setDate(firstSunday.getDate() + (weekIndex * 7));
    
    const weekDays: Date[] = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + dayIndex);
      weekDays.push(dayDate);
    }
    weeks.push(weekDays);
  }
  
  
  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString();
  };
  
  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
  };
  
  // Check if a date is in the current selected week (Sunday to Saturday)
  const isInCurrentWeek = (date: Date) => {
    // Find the Saturday of the week containing the selected date
    const selectedDayOfWeek = selectedDate.getDay();
    let selectedDaysToSaturday;
    if (selectedDayOfWeek === 6) { // Saturday
      selectedDaysToSaturday = 0;
    } else { // Sunday (0) through Friday (5)
      selectedDaysToSaturday = (6 - selectedDayOfWeek + 7) % 7;
    }
    
    const selectedSaturday = new Date(selectedDate);
    selectedSaturday.setDate(selectedDate.getDate() + selectedDaysToSaturday);
    
    // Find the Saturday of the week containing the current date
    const dayOfWeek = date.getDay();
    let daysToSaturday;
    if (dayOfWeek === 6) { // Saturday
      daysToSaturday = 0;
    } else { // Sunday (0) through Friday (5)
      daysToSaturday = (6 - dayOfWeek + 7) % 7;
    }
    
    const saturdayDate = new Date(date);
    saturdayDate.setDate(date.getDate() + daysToSaturday);
    
    return saturdayDate.toDateString() === selectedSaturday.toDateString();
  };
  
  // Check if a date is the Friday of the current selected week
  const isCurrentWeekFriday = (date: Date) => {
    if (!isInCurrentWeek(date)) return false;
    
    // Check if this date is a Friday (day 5)
    return date.getDay() === 5;
  };
  
  // Get week number for a date (Sunday to Saturday weeks)
  const getWeekNumber = (date: Date) => {
    // Find which Sunday-to-Saturday week this date belongs to
    for (let i = 0; i < weeks.length; i++) {
      if (weeks[i].some(weekDate => weekDate.toDateString() === date.toDateString())) {
        return i;
      }
    }
    return -1;
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
      <div className="grid grid-cols-7 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <div key={index} className="text-xs text-gray-400 text-center h-6 flex items-center justify-center">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid with Week Highlighting */}
      <div className="grid grid-cols-7">
        {days.map((date, index) => {
          const weekNumber = getWeekNumber(date);
          const isHoveredWeek = hoveredWeek === weekNumber;
          const isInWeek = isInCurrentWeek(date);
          const isFriday = isCurrentWeekFriday(date);
          
          return (
            <button
              key={index}
              onClick={() => onDateSelect(date)}
              onMouseEnter={() => setHoveredWeek(weekNumber)}
              onMouseLeave={() => setHoveredWeek(null)}
              className={`text-xs h-8 w-full flex items-center justify-center transition-colors ${
                isFriday
                  ? 'bg-blue-500 text-white' // Friday of selected week - brightest blue
                  : isToday(date)
                  ? 'bg-gray-600 text-white'
                  : isInWeek
                  ? 'bg-blue-500/40 text-white' // Other days of selected week - darker blue
                  : isHoveredWeek
                  ? 'bg-blue-500/20 text-white' // Hovered week - lighter blue
                  : isCurrentMonth(date)
                  ? 'text-white hover:bg-gray-700'
                  : 'text-gray-500 hover:bg-gray-700'
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Day Calendar - Traditional calendar for day selection
function DayCalendar({ selectedDate, onDateSelect }: { selectedDate: Date; onDateSelect: (date: Date) => void }) {
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
  
  
  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString();
  };
  
  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
  };

  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
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
      <div className="grid grid-cols-7 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <div key={index} className="text-xs text-gray-400 text-center h-6 flex items-center justify-center">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {days.map((date, index) => (
          <button
            key={index}
            onClick={() => onDateSelect(date)}
            className={`text-xs h-8 w-full flex items-center justify-center hover:bg-gray-700 ${
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
