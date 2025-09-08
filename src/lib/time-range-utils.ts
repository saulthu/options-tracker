import { TimeRange, TimeScale } from '@/components/TimeRangeSelector';

/**
 * Calculate time range boundaries for different scales
 * Centralized utility to avoid duplication across components
 */
export function calculateTimeRange(date: Date, scale: TimeScale): TimeRange {
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
        label: `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${date.toLocaleDateString('en-US', { 
          month: 'numeric', 
          day: 'numeric'
        })}`
      };

    case 'week':
      return calculateWeekRange(date);

    case 'month':
      // Month: first day to last day of the month
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      
      endDate.setMonth(date.getMonth() + 1, 0); // Last day of current month
      endDate.setHours(23, 59, 59, 999);
      
      return {
        startDate,
        endDate,
        scale,
        label: `${date.toLocaleDateString('en-US', { month: 'short' })} '${date.getFullYear().toString().slice(-2)}`
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
}

/**
 * Calculate week range (Sunday to Saturday, label shows Friday)
 */
function calculateWeekRange(date: Date): TimeRange {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Find the Saturday of this week
  let daysToSaturday;
  if (dayOfWeek === 6) { // Saturday
    daysToSaturday = 0;
  } else { // Sunday (0) through Friday (5)
    daysToSaturday = (6 - dayOfWeek + 7) % 7;
  }
  
  // Calculate Saturday date first
  const saturdayDate = new Date(date);
  saturdayDate.setDate(date.getDate() + daysToSaturday);
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
}

/**
 * Get initial time range (current week by default)
 */
export function getInitialTimeRange(): TimeRange {
  return calculateWeekRange(new Date());
}
