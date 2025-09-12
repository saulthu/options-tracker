'use client';

import React from 'react';
import Select from '@/components/ui/select';
import { PositionFilterType, PositionFilterOption } from '@/types/navigation';
import { Filter } from 'lucide-react';

interface PositionFilterSelectorProps {
  value: PositionFilterType;
  onChange: (filterType: PositionFilterType) => void;
  className?: string;
}

const filterOptions: PositionFilterOption[] = [
  {
    value: 'overlap',
    label: 'Overlap Period',
    description: 'Show positions active during this period'
  },
  {
    value: 'openedDuring',
    label: 'Opened in Period',
    description: 'Show positions opened in this period'
  },
  {
    value: 'closedDuring',
    label: 'Closed in Period',
    description: 'Show positions closed in this period'
  }
];

export default function PositionFilterSelector({ 
  value, 
  onChange, 
  className = "" 
}: PositionFilterSelectorProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-2 text-[#b3b3b3]">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Date Range</span>
      </div>
      
      <div className="min-w-0">
        <Select
          value={value}
          onChange={(newValue) => onChange(newValue as PositionFilterType)}
          options={filterOptions}
          className="w-48"
        />
      </div>
    </div>
  );
}
