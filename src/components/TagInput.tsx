/**
 * Tag Input Component - For editing transaction memos with hashtags
 */

import React, { useState, useRef, useEffect } from 'react';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
// import { Button } from './ui/button';
import { parseMemo, formatMemo, addTagToMemo, removeTagFromMemo } from '@/lib/memo-parser';

interface TagInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestedTags?: string[];
  className?: string;
}

export function TagInput({
  value,
  onChange,
  placeholder = "Transaction description...",
  suggestedTags = [],
  className = ''
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { description, tags } = parseMemo(value);

  // Update input value when description changes
  useEffect(() => {
    setInputValue(description);
  }, [description]);

  const handleDescriptionChange = (newDescription: string) => {
    setInputValue(newDescription);
    onChange(formatMemo(newDescription, tags));
  };

  const handleAddTag = (tag: string) => {
    if (tag.trim() && !tags.includes(tag.trim())) {
      const newValue = addTagToMemo(value, tag.trim());
      onChange(newValue);
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newValue = removeTagFromMemo(value, tagToRemove);
    onChange(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag(e.currentTarget.value);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleInputFocus = () => {
    setShowSuggestions(true);
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const filteredSuggestions = suggestedTags.filter(tag => 
    !tags.includes(tag) && 
    tag.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Description Input */}
      <Textarea
        ref={textareaRef}
        value={inputValue}
        onChange={(e) => handleDescriptionChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[80px]"
      />

      {/* Tags Display */}
      {tags.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-[#b3b3b3]">Tags:</div>
          <div className="flex flex-wrap gap-1">
            {tags.map(tag => (
              <Badge
                key={tag}
                variant="default"
                className="cursor-pointer hover:bg-red-500"
                onClick={() => handleRemoveTag(tag)}
              >
                #{tag} ×
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tag Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder="Add tag and press Enter..."
          className="w-full px-3 py-2 text-sm bg-[#1a1a1a] border border-[#2d2d2d] rounded-md text-white placeholder-[#666] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {/* Suggestions Dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#2d2d2d] rounded-md shadow-lg z-10 max-h-32 overflow-y-auto">
            {filteredSuggestions.map(tag => (
              <button
                key={tag}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-[#2d2d2d] flex items-center gap-2"
                onClick={() => handleAddTag(tag)}
              >
                <span className="text-blue-400">#</span>
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="text-xs text-[#666]">
        Type a description above, then add tags below. Each tag should be on its own line starting with #.
      </div>
    </div>
  );
}

interface TagSuggestionsProps {
  suggestedTags: string[];
  onTagSelect: (tag: string) => void;
  className?: string;
}

export function TagSuggestions({ 
  suggestedTags, 
  onTagSelect, 
  className = '' 
}: TagSuggestionsProps) {
  if (suggestedTags.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="text-xs text-[#b3b3b3]">Suggested tags:</div>
      <div className="flex flex-wrap gap-1">
        {suggestedTags.map(tag => (
          <Badge
            key={tag}
            variant="outline"
            className="cursor-pointer hover:bg-blue-500 hover:text-white"
            onClick={() => onTagSelect(tag)}
          >
            #{tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}
