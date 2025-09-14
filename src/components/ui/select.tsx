import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const selectedOption = options.find(option => option.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOptionClick = useCallback((optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  }, [onChange]);

  // Handle keyboard navigation and search
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex(prev => 
            prev < options.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : options.length - 1
          );
          break;
        case 'Enter':
          event.preventDefault();
          if (highlightedIndex >= 0) {
            handleOptionClick(options[highlightedIndex].value);
          }
          break;
        case 'Escape':
          event.preventDefault();
          setIsOpen(false);
          setSearchTerm('');
          setHighlightedIndex(-1);
          buttonRef.current?.focus();
          break;
        default:
          // Handle typing to search
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            const newSearchTerm = searchTerm + event.key.toLowerCase();
            setSearchTerm(newSearchTerm);
            
            // Find first option that starts with the search term
            const matchIndex = options.findIndex(option => 
              option.label.toLowerCase().startsWith(newSearchTerm)
            );
            
            if (matchIndex >= 0) {
              setHighlightedIndex(matchIndex);
            }
            
            // Clear search term after 1 second
            if (searchTimeoutRef.current) {
              clearTimeout(searchTimeoutRef.current);
            }
            searchTimeoutRef.current = setTimeout(() => {
              setSearchTerm('');
            }, 1000);
          }
          break;
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, highlightedIndex, options, searchTerm, handleOptionClick]);

  // Reset highlighted index when opening
  useEffect(() => {
    if (isOpen) {
      const selectedIndex = options.findIndex(option => option.value === value);
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [isOpen, value, options]);

  // Auto-scroll to highlighted item
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0) {
      const dropdown = dropdownRef.current;
      if (dropdown) {
        const highlightedElement = dropdown.querySelector(`button:nth-child(${highlightedIndex + 1})`);
        if (highlightedElement) {
          highlightedElement.scrollIntoView({
            block: 'nearest',
            behavior: 'smooth'
          });
        }
      }
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        ref={buttonRef}
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
        <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-[#2d2d2d] rounded-md shadow-lg max-h-60 overflow-y-auto">
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleOptionClick(option.value)}
              className={`w-full px-3 py-2 text-left text-sm first:rounded-t-md last:rounded-b-md transition-colors ${
                index === highlightedIndex 
                  ? 'bg-blue-600 text-white' 
                  : option.value === value 
                    ? 'bg-[#2d2d2d] text-blue-400' 
                    : 'text-white hover:bg-[#2d2d2d]'
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
