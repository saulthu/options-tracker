/**
 * Tag Filter Component - Provides UI for filtering by tags
 */

import React, { useState, useMemo } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
// import { TagFilter as TagFilterType } from '@/lib/tag-manager';

interface TagFilterProps {
  availableTags: string[];
  selectedTags: string[];
  filterMode: 'AND' | 'OR';
  onTagsChange: (tags: string[]) => void;
  onModeChange: (mode: 'AND' | 'OR') => void;
  className?: string;
}

export function TagFilter({
  availableTags,
  selectedTags,
  filterMode,
  onTagsChange,
  onModeChange,
  className = ''
}: TagFilterProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter available tags based on search term
  const filteredTags = useMemo(() => {
    if (!searchTerm) return availableTags;
    return availableTags.filter(tag => 
      tag.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableTags, searchTerm]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const clearAllTags = () => {
    onTagsChange([]);
  };

  const toggleMode = () => {
    onModeChange(filterMode === 'AND' ? 'OR' : 'AND');
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search and Mode Controls */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={toggleMode}
          className="text-xs"
        >
          {filterMode === 'AND' ? 'All' : 'Any'}
        </Button>
        {selectedTags.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllTags}
            className="text-xs"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-[#b3b3b3]">
            Selected tags ({filterMode}):
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedTags.map(tag => (
              <Badge
                key={tag}
                variant="default"
                className="cursor-pointer hover:bg-red-500"
                onClick={() => toggleTag(tag)}
              >
                #{tag} ×
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Available Tags */}
      <div className="space-y-2">
        <div className="text-xs text-[#b3b3b3]">
          Available tags ({filteredTags.length}):
        </div>
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
          {filteredTags.map(tag => (
            <Badge
              key={tag}
              variant="outline"
              className={`cursor-pointer hover:bg-blue-500 hover:text-white ${
                selectedTags.includes(tag) ? 'bg-blue-500 text-white' : ''
              }`}
              onClick={() => toggleTag(tag)}
            >
              #{tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* No tags message */}
      {availableTags.length === 0 && (
        <div className="text-xs text-[#b3b3b3] text-center py-2">
          No tags found. Add hashtags to transaction memos to create tags.
        </div>
      )}
    </div>
  );
}

interface TagDisplayProps {
  tags: string[];
  maxDisplay?: number;
  className?: string;
}

export function TagDisplay({ 
  tags, 
  maxDisplay = 3, 
  className = '' 
}: TagDisplayProps) {
  if (tags.length === 0) return null;

  const displayTags = tags.slice(0, maxDisplay);
  const remainingCount = tags.length - maxDisplay;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {displayTags.map(tag => (
        <Badge
          key={tag}
          variant="outline"
          className="text-xs"
        >
          #{tag}
        </Badge>
      ))}
      {remainingCount > 0 && (
        <Badge
          variant="outline"
          className="text-xs text-[#b3b3b3]"
        >
          +{remainingCount}
        </Badge>
      )}
    </div>
  );
}
