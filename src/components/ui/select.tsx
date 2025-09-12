import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export default function Select({ 
  value, 
  onChange, 
  options, 
  placeholder = "Select an option...",
  className = ""
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(option => option.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOptionClick = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2d2d2d] rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer flex items-center justify-between"
      >
        <span className="text-left">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-[#b3b3b3] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-[#2d2d2d] rounded-md shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleOptionClick(option.value)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-[#2d2d2d] first:rounded-t-md last:rounded-b-md ${
                option.value === value ? 'bg-[#2d2d2d] text-blue-400' : 'text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
