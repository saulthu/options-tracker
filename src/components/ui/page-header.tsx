"use client";

import { LucideIcon } from "lucide-react";
import DateRangeSelector, { DateRange } from "../DateRangeSelector";

interface PageHeaderProps {
  title: string;
  icon: LucideIcon;
  description: string;
  selectedDateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  customStartDate: string;
  customEndDate: string;
  onCustomDateChange: (startDate: string, endDate: string) => void;
}

export default function PageHeader({
  title,
  icon: Icon,
  description,
  selectedDateRange,
  onDateRangeChange,
  customStartDate,
  customEndDate,
  onCustomDateChange,
}: PageHeaderProps) {
  return (
    <div className="flex justify-between items-start mb-6">
      <div className="flex space-x-3">
        <Icon className="w-8 h-8 text-blue-400 flex-shrink-0 self-start" />
        <div>
          <h1 className="text-3xl font-bold text-white leading-none">{title}</h1>
          <p className="text-[#b3b3b3] text-sm mt-1">{description}</p>
        </div>
      </div>
      <DateRangeSelector
        selectedRange={selectedDateRange}
        onRangeChange={onDateRangeChange}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        onCustomDateChange={onCustomDateChange}
      />
    </div>
  );
}
