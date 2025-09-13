/**
 * Tests for memo parser functionality
 */

import { 
  parseMemo, 
  formatMemo, 
  addTagToMemo, 
  removeTagFromMemo,
  extractAllTags,
  filterTransactionsByTags,
  filterTransactionsByAnyTag,
  getTagStats
} from '../memo-parser';

describe('Memo Parser', () => {
  describe('parseMemo', () => {
    it('should parse empty memo', () => {
      const result = parseMemo(null);
      expect(result).toEqual({ description: '', tags: [] });
    });

    it('should parse memo with only description', () => {
      const result = parseMemo('Bought AAPL shares');
      expect(result).toEqual({ 
        description: 'Bought AAPL shares', 
        tags: [] 
      });
    });

    it('should parse memo with description and tags', () => {
      const memo = 'Bought AAPL shares\n#tech\n#long-term\n#dividend';
      const result = parseMemo(memo);
      expect(result).toEqual({ 
        description: 'Bought AAPL shares', 
        tags: ['tech', 'long-term', 'dividend'] 
      });
    });

    it('should handle empty lines and whitespace', () => {
      const memo = 'Bought AAPL shares\n\n#tech\n  #long-term  \n\n#dividend\n';
      const result = parseMemo(memo);
      expect(result).toEqual({ 
        description: 'Bought AAPL shares', 
        tags: ['tech', 'long-term', 'dividend'] 
      });
    });

    it('should remove duplicate tags', () => {
      const memo = 'Bought AAPL shares\n#tech\n#long-term\n#tech\n#dividend';
      const result = parseMemo(memo);
      expect(result).toEqual({ 
        description: 'Bought AAPL shares', 
        tags: ['tech', 'long-term', 'dividend'] 
      });
    });

    it('should ignore lines that do not start with #', () => {
      const memo = 'Bought AAPL shares\nNot a tag\n#tech\nAlso not a tag\n#long-term';
      const result = parseMemo(memo);
      expect(result).toEqual({ 
        description: 'Bought AAPL shares', 
        tags: ['tech', 'long-term'] 
      });
    });
  });

  describe('formatMemo', () => {
    it('should format description only', () => {
      const result = formatMemo('Bought AAPL shares', []);
      expect(result).toBe('Bought AAPL shares');
    });

    it('should format description with tags', () => {
      const result = formatMemo('Bought AAPL shares', ['tech', 'long-term', 'dividend']);
      expect(result).toBe('Bought AAPL shares\n#tech\n#long-term\n#dividend');
    });

    it('should handle empty description', () => {
      const result = formatMemo('', ['tech', 'long-term']);
      expect(result).toBe('\n#tech\n#long-term');
    });
  });

  describe('addTagToMemo', () => {
    it('should add tag to empty memo', () => {
      const result = addTagToMemo(null, 'tech');
      expect(result).toBe('\n#tech');
    });

    it('should add tag to existing memo', () => {
      const memo = 'Bought AAPL shares\n#tech';
      const result = addTagToMemo(memo, 'long-term');
      expect(result).toBe('Bought AAPL shares\n#tech\n#long-term');
    });

    it('should not add duplicate tag', () => {
      const memo = 'Bought AAPL shares\n#tech';
      const result = addTagToMemo(memo, 'tech');
      expect(result).toBe(memo);
    });
  });

  describe('removeTagFromMemo', () => {
    it('should remove tag from memo', () => {
      const memo = 'Bought AAPL shares\n#tech\n#long-term';
      const result = removeTagFromMemo(memo, 'tech');
      expect(result).toBe('Bought AAPL shares\n#long-term');
    });

    it('should handle removing non-existent tag', () => {
      const memo = 'Bought AAPL shares\n#tech';
      const result = removeTagFromMemo(memo, 'long-term');
      expect(result).toBe(memo);
    });

    it('should handle removing last tag', () => {
      const memo = 'Bought AAPL shares\n#tech';
      const result = removeTagFromMemo(memo, 'tech');
      expect(result).toBe('Bought AAPL shares');
    });
  });

  describe('extractAllTags', () => {
    it('should extract all unique tags from transactions', () => {
      const transactions = [
        { memo: 'Bought AAPL\n#tech\n#long-term' },
        { memo: 'Sold MSFT\n#tech\n#short-term' },
        { memo: 'Bought GOOGL\n#tech\n#long-term' }
      ];
      
      const result = extractAllTags(transactions);
      expect(result).toEqual(['long-term', 'short-term', 'tech']);
    });
  });

  describe('filterTransactionsByTags', () => {
    it('should filter transactions by required tags (AND logic)', () => {
      const transactions = [
        { memo: 'Bought AAPL\n#tech\n#long-term' },
        { memo: 'Sold MSFT\n#tech\n#short-term' },
        { memo: 'Bought GOOGL\n#tech\n#long-term' }
      ];
      
      const result = filterTransactionsByTags(transactions, ['tech', 'long-term']);
      expect(result).toHaveLength(2);
      expect(result[0].memo).toContain('AAPL');
      expect(result[1].memo).toContain('GOOGL');
    });

    it('should return all transactions when no tags specified', () => {
      const transactions = [
        { memo: 'Bought AAPL\n#tech' },
        { memo: 'Sold MSFT\n#tech' }
      ];
      
      const result = filterTransactionsByTags(transactions, []);
      expect(result).toHaveLength(2);
    });
  });

  describe('filterTransactionsByAnyTag', () => {
    it('should filter transactions by any tag (OR logic)', () => {
      const transactions = [
        { memo: 'Bought AAPL\n#tech\n#long-term' },
        { memo: 'Sold MSFT\n#finance\n#short-term' },
        { memo: 'Bought GOOGL\n#tech\n#long-term' }
      ];
      
      const result = filterTransactionsByAnyTag(transactions, ['tech', 'finance']);
      expect(result).toHaveLength(3);
    });
  });

  describe('getTagStats', () => {
    it('should return tag usage statistics', () => {
      const transactions = [
        { memo: 'Bought AAPL\n#tech\n#long-term' },
        { memo: 'Sold MSFT\n#tech\n#short-term' },
        { memo: 'Bought GOOGL\n#tech\n#long-term' }
      ];
      
      const result = getTagStats(transactions);
      expect(result).toEqual([
        { tag: 'tech', count: 3 },
        { tag: 'long-term', count: 2 },
        { tag: 'short-term', count: 1 }
      ]);
    });
  });
});
