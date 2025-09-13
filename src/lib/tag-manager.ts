/**
 * Tag Manager - Provides tag filtering and management utilities for the portfolio system
 * Works with the memo-based hashtag system
 */

import { 
  extractAllTags, 
  filterTransactionsByTags, 
  filterTransactionsByAnyTag, 
  getTagStats,
  parseMemo 
} from './memo-parser';
import { Transaction } from '@/types/database';
import { PositionEpisode } from '@/types/episodes';

export interface TagFilter {
  mode: 'AND' | 'OR';
  tags: string[];
}

export interface TagStats {
  tag: string;
  count: number;
}

/**
 * Tag manager for portfolio data
 */
export class PortfolioTagManager {
  private transactions: Transaction[];
  private episodes: PositionEpisode[];

  constructor(transactions: Transaction[], episodes: PositionEpisode[]) {
    this.transactions = transactions;
    this.episodes = episodes;
  }

  /**
   * Get all unique tags from transactions
   */
  getAllTags(): string[] {
    return extractAllTags(this.transactions);
  }

  /**
   * Get all unique tags from episodes (from their transactions)
   */
  getAllEpisodeTags(): string[] {
    const allEpisodeTransactions = this.episodes.flatMap(episode => episode.txns);
    return extractAllTags(allEpisodeTransactions);
  }

  /**
   * Get tag usage statistics for transactions
   */
  getTransactionTagStats(): TagStats[] {
    return getTagStats(this.transactions);
  }

  /**
   * Get tag usage statistics for episodes
   */
  getEpisodeTagStats(): TagStats[] {
    const allEpisodeTransactions = this.episodes.flatMap(episode => episode.txns);
    return getTagStats(allEpisodeTransactions);
  }

  /**
   * Filter transactions by tags
   */
  filterTransactions(tagFilter: TagFilter): Transaction[] {
    if (tagFilter.tags.length === 0) {
      return this.transactions;
    }

    if (tagFilter.mode === 'AND') {
      return filterTransactionsByTags(this.transactions, tagFilter.tags);
    } else {
      return filterTransactionsByAnyTag(this.transactions, tagFilter.tags);
    }
  }

  /**
   * Filter episodes by tags (episodes that have transactions with matching tags)
   */
  filterEpisodes(tagFilter: TagFilter): PositionEpisode[] {
    if (tagFilter.tags.length === 0) {
      return this.episodes;
    }

    return this.episodes.filter(episode => {
      const episodeTransactions = episode.txns;
      
      if (tagFilter.mode === 'AND') {
        // Episode must have transactions with ALL specified tags
        return tagFilter.tags.every(requiredTag => 
          episodeTransactions.some(txn => 
            txn.parsedMemo?.tags.includes(requiredTag) || false
          )
        );
      } else {
        // Episode must have transactions with ANY of the specified tags
        return tagFilter.tags.some(anyTag => 
          episodeTransactions.some(txn => 
            txn.parsedMemo?.tags.includes(anyTag) || false
          )
        );
      }
    });
  }

  /**
   * Get suggested tags based on similar transactions
   */
  getSuggestedTags(transaction: Transaction, limit: number = 5): string[] {
    const similarTransactions = this.transactions.filter(t => 
      t.instrument_kind === transaction.instrument_kind &&
      t.ticker_id === transaction.ticker_id &&
      t.id !== transaction.id
    );

    const tagCounts = new Map<string, number>();
    similarTransactions.forEach(t => {
      const { tags } = parseMemo(t.memo);
      tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag]) => tag);
  }

  /**
   * Search tags by prefix
   */
  searchTags(prefix: string): string[] {
    const allTags = this.getAllTags();
    return allTags
      .filter(tag => tag.toLowerCase().includes(prefix.toLowerCase()))
      .sort();
  }

  /**
   * Get transactions by tag
   */
  getTransactionsByTag(tag: string): Transaction[] {
    return this.transactions.filter(transaction => {
      const { tags } = parseMemo(transaction.memo);
      return tags.includes(tag);
    });
  }

  /**
   * Get episodes by tag
   */
  getEpisodesByTag(tag: string): PositionEpisode[] {
    return this.episodes.filter(episode => 
      episode.txns.some(txn => 
        txn.parsedMemo?.tags.includes(tag) || false
      )
    );
  }
}

/**
 * Create a tag manager instance
 */
export function createTagManager(transactions: Transaction[], episodes: PositionEpisode[]): PortfolioTagManager {
  return new PortfolioTagManager(transactions, episodes);
}

/**
 * Hook for using tag manager in React components
 */
export function useTagManager(transactions: Transaction[], episodes: PositionEpisode[]) {
  return new PortfolioTagManager(transactions, episodes);
}
