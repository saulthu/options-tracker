/**
 * Memo Parser - Handles parsing of memo field for hashtags
 * 
 * Format:
 * - First line: Free text description of the transaction
 * - Subsequent lines: One hashtag per line in format "#tagname"
 * - Example: "Bought AAPL shares\n#tech\n#long-term\n#dividend"
 */

export interface ParsedMemo {
  description: string;
  tags: string[];
}

/**
 * Parse a memo string into description and tags
 */
export function parseMemo(memo: string | null | undefined): ParsedMemo {
  if (!memo) return { description: '', tags: [] };
  
  const lines = memo.split('\n');
  const description = lines[0]?.trim() || '';
  
  const tags = lines
    .slice(1) // Skip first line (description)
    .map(line => line.trim())
    .filter(line => line.startsWith('#'))
    .map(line => line.substring(1)) // Remove the # prefix
    .filter(tag => tag.length > 0) // Remove empty tags
    .filter((tag, index, arr) => arr.indexOf(tag) === index); // Remove duplicates
  
  return { description, tags };
}

/**
 * Format description and tags back into memo string
 */
export function formatMemo(description: string, tags: string[]): string {
  if (tags.length === 0) return description;
  
  const cleanDescription = description.trim();
  const formattedTags = tags
    .filter(tag => tag.length > 0)
    .map(tag => `#${tag}`)
    .join('\n');
  
  return cleanDescription + '\n' + formattedTags;
}

/**
 * Add a tag to an existing memo
 */
export function addTagToMemo(memo: string | null | undefined, newTag: string): string {
  const { description, tags } = parseMemo(memo);
  
  if (tags.includes(newTag)) {
    return memo || ''; // Tag already exists
  }
  
  return formatMemo(description, [...tags, newTag]);
}

/**
 * Remove a tag from an existing memo
 */
export function removeTagFromMemo(memo: string | null | undefined, tagToRemove: string): string {
  const { description, tags } = parseMemo(memo);
  
  const filteredTags = tags.filter(tag => tag !== tagToRemove);
  return formatMemo(description, filteredTags);
}

/**
 * Get all unique tags from a list of transactions
 */
export function extractAllTags(transactions: { memo?: string | null }[]): string[] {
  const allTags = transactions
    .flatMap(t => parseMemo(t.memo).tags);
  
  return [...new Set(allTags)].sort();
}

/**
 * Filter transactions by tags (AND logic - must have all specified tags)
 */
export function filterTransactionsByTags<T extends { memo?: string | null }>(
  transactions: T[],
  requiredTags: string[]
): T[] {
  if (requiredTags.length === 0) return transactions;
  
  return transactions.filter(transaction => {
    const { tags } = parseMemo(transaction.memo);
    return requiredTags.every(tag => tags.includes(tag));
  });
}

/**
 * Filter transactions by any of the specified tags (OR logic)
 */
export function filterTransactionsByAnyTag<T extends { memo?: string | null }>(
  transactions: T[],
  anyTags: string[]
): T[] {
  if (anyTags.length === 0) return transactions;
  
  return transactions.filter(transaction => {
    const { tags } = parseMemo(transaction.memo);
    return anyTags.some(tag => tags.includes(tag));
  });
}

/**
 * Get tag usage statistics
 */
export function getTagStats<T extends { memo?: string | null }>(
  transactions: T[]
): { tag: string; count: number }[] {
  const tagCounts = new Map<string, number>();
  
  transactions.forEach(transaction => {
    const { tags } = parseMemo(transaction.memo);
    tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  
  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
