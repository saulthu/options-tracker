"use client";

import { LucideIcon } from "lucide-react";
import TimeRangeSelector, { TimeRange, TimeScale } from "../TimeRangeSelector";

interface PageHeaderProps {
  title: string;
  icon: LucideIcon;
  description: string;
  onRangeChange: (range: TimeRange) => void;
  initialTimeScale?: TimeScale;
}

export default function PageHeader({
  title,
  icon: Icon,
  description,
  onRangeChange,
  initialTimeScale = 'week',
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
      <TimeRangeSelector
        key="global-time-selector"
        onRangeChange={onRangeChange}
        initialScale={initialTimeScale}
      />
    </div>
  );
}
