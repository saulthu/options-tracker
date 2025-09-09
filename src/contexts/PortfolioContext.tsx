'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from './AuthContext';
import { 
  buildPortfolioView,
  createTickerLookup,
  filterEpisodesByDateRange,
  getAccountEpisodes,
  getTotalRealizedPnL,
  getAccountRealizedPnL,
  getAccountBalance
} from '@/lib/episode-portfolio-calculator';
import { 
  PortfolioResult,
  PositionEpisode,
  RawTransaction
} from '@/types/episodes';
import { Account } from '@/types/database';
import { TimeRange } from '@/components/TimeRangeSelector';

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PortfolioContextType {
  // Raw data
  transactions: RawTransaction[];
  accounts: Account[]; // Add accounts for the debug page
  loading: boolean;
  error: string | null;
  
  // Derived state
  portfolio: PortfolioResult | null;
  
  // Helper functions
  getEpisodes: (accountId?: string) => PositionEpisode[];
  getOpenEpisodes: (accountId?: string) => PositionEpisode[];
  getClosedEpisodes: (accountId?: string) => PositionEpisode[];
  getEpisodesByKind: (kindGroup: 'CASH' | 'SHARES' | 'OPTION', accountId?: string) => PositionEpisode[];
  getBalance: (accountId: string) => number;
  getTotalPnL: (accountId?: string) => number;
  getFilteredEpisodes: (timeRange: TimeRange, accountId?: string) => PositionEpisode[];
  getFilteredPositions: (timeRange: TimeRange, accountId?: string) => PositionEpisode[];
  getFilteredTransactions: (timeRange: TimeRange) => RawTransaction[];
  
  // Actions
  refreshPortfolio: () => Promise<void>;
  refreshOnAccountChange: () => Promise<void>;
  addTransaction: (transaction: Omit<RawTransaction, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<RawTransaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

interface PortfolioProviderProps {
  children: ReactNode;
}

export function PortfolioProvider({ children }: PortfolioProviderProps) {
  const { user, loading: authLoading, error: authError } = useAuth();
  const [transactions, setTransactions] = useState<RawTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch transactions from Supabase
  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Use user from AuthContext instead of making separate auth call
      if (!user) {
        setError('User not authenticated');
        setTransactions([]);
        return;
      }

      // User creation is handled by useUserProfile hook
      // Skip checking users table to avoid permission issues
      console.log('Skipping users table check - user creation handled by useUserProfile');

      // First, let's test if the transactions table exists at all
      const { data: tableTest, error: tableError } = await supabase
        .from('transactions')
        .select('count')
        .limit(1);
      
      console.log('Table existence test:', { tableTest, tableError });

      // Try to fetch transactions directly
      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select(`
          *,
          tickers: ticker_id (
            id,
            name,
            icon
          ),
          accounts: account_id (
            id,
            name,
            type,
            institution
          )
        `)
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true });

      console.log('Database query result:', { 
        data: data?.length || 0, 
        error: fetchError ? 'Error present' : 'No error',
        user_id: user.id,
        hasData: !!data
      });

      if (fetchError) {
        console.error('Supabase error details:', {
          code: fetchError.code,
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint,
          rawError: JSON.stringify(fetchError)
        });
        
        // Handle specific error cases
        if (fetchError.code === 'PGRST116' || 
            fetchError.message?.includes('relation "public.transactions" does not exist') ||
            fetchError.message?.includes('relation does not exist') ||
            fetchError.message?.includes('does not exist')) {
          console.warn('Transactions table does not exist yet. Please run the database schema first.');
          setError('Database not initialized. Please run the database setup first.');
          setTransactions([]); // Set empty array instead of throwing
          return;
        }
        
        // Handle permission errors
        if (fetchError.code === '42501' || 
            fetchError.message?.includes('permission denied') ||
            fetchError.message?.includes('insufficient_privilege') ||
            fetchError.message?.includes('new row violates row-level security policy')) {
          console.warn('Permission denied - user may not be properly authenticated or RLS policies may be blocking access');
          setError('Permission denied. Please ensure you are logged in and have proper access.');
          setTransactions([]);
          return;
        }
        
        
        // If we can't determine the specific error, show a generic message
        const errorMessage = fetchError.message || 'Unknown database error';
        setError(`Database error: ${errorMessage}`);
        setTransactions([]);
        return;
      }

      setTransactions(data || []);

      // Also fetch accounts for the debug page
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id);

      if (accountsError) {
        console.warn('Error fetching accounts:', accountsError);
        setAccounts([]);
      } else {
        setAccounts(accountsData || []);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      console.error('Error details:', {
        name: (err as Error & { code?: string; details?: string; hint?: string })?.name,
        message: (err as Error & { code?: string; details?: string; hint?: string })?.message,
        code: (err as Error & { code?: string; details?: string; hint?: string })?.code,
        details: (err as Error & { code?: string; details?: string; hint?: string })?.details,
        hint: (err as Error & { code?: string; details?: string; hint?: string })?.hint
      });
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Recalculate portfolio when transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      const tickerLookup = createTickerLookup(transactions);
      const openingBalances = new Map<string, number>(); // No opening balances for now
      const newPortfolio = buildPortfolioView(transactions, tickerLookup, openingBalances);
      setPortfolio(newPortfolio);
    } else {
      setPortfolio(null);
    }
  }, [transactions]);

  // Track if we've already fetched data to prevent unnecessary re-fetching
  const hasFetchedRef = useRef(false);

  // Initial fetch - only when auth is ready and user is available
  useEffect(() => {
    if (!authLoading && user && !authError && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchTransactions();
    } else if (!authLoading && !user) {
      // User is not authenticated, clear data
      hasFetchedRef.current = false;
      setTransactions([]);
      setPortfolio(null);
      setLoading(false);
    }
  }, [authLoading, user, authError, fetchTransactions]);

  // Helper functions
  const getEpisodes = useCallback((accountId?: string): PositionEpisode[] => {
    if (!portfolio) return [];
    if (accountId) {
      return getAccountEpisodes(portfolio.episodes, accountId);
    }
    return portfolio.episodes;
  }, [portfolio]);

  const getOpenEpisodes = useCallback((accountId?: string): PositionEpisode[] => {
    if (!portfolio) return [];
    const episodes = accountId ? getAccountEpisodes(portfolio.episodes, accountId) : portfolio.episodes;
    return episodes.filter(episode => episode.qty !== 0);
  }, [portfolio]);

  const getClosedEpisodes = useCallback((accountId?: string): PositionEpisode[] => {
    if (!portfolio) return [];
    const episodes = accountId ? getAccountEpisodes(portfolio.episodes, accountId) : portfolio.episodes;
    return episodes.filter(episode => episode.qty === 0);
  }, [portfolio]);

  const getEpisodesByKind = useCallback((kindGroup: 'CASH' | 'SHARES' | 'OPTION', accountId?: string): PositionEpisode[] => {
    if (!portfolio) return [];
    const episodes = accountId ? getAccountEpisodes(portfolio.episodes, accountId) : portfolio.episodes;
    return episodes.filter(episode => episode.kindGroup === kindGroup);
  }, [portfolio]);

  const getBalance = useCallback((accountId: string): number => {
    if (!portfolio) return 0;
    return getAccountBalance(portfolio.balances, accountId);
  }, [portfolio]);

  const getTotalPnL = useCallback((accountId?: string): number => {
    if (!portfolio) return 0;
    if (accountId) {
      return getAccountRealizedPnL(portfolio.episodes, accountId);
    }
    return getTotalRealizedPnL(portfolio.episodes);
  }, [portfolio]);

  const getFilteredEpisodes = useCallback((timeRange: TimeRange, accountId?: string): PositionEpisode[] => {
    if (!portfolio) return [];
    const episodes = accountId ? getAccountEpisodes(portfolio.episodes, accountId) : portfolio.episodes;
    const startDate = timeRange.startDate.toISOString();
    const endDate = timeRange.endDate.toISOString();
    return filterEpisodesByDateRange(episodes, startDate, endDate);
  }, [portfolio]);

  const getFilteredPositions = useCallback((timeRange: TimeRange, accountId?: string): PositionEpisode[] => {
    if (!portfolio) return [];
    const positions = accountId ? getAccountEpisodes(portfolio.episodes, accountId) : portfolio.episodes;
    const startDate = timeRange.startDate.toISOString();
    const endDate = timeRange.endDate.toISOString();
    return filterEpisodesByDateRange(positions, startDate, endDate);
  }, [portfolio]);

  const getFilteredTransactions = useCallback((timeRange: TimeRange): RawTransaction[] => {
    if (!transactions.length) return [];
    
    const startDate = timeRange.startDate.toISOString();
    const endDate = timeRange.endDate.toISOString();
    
    return transactions.filter(transaction => {
      const transactionDate = transaction.timestamp;
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }, [transactions]);

  // Actions
  const refreshPortfolio = useCallback(async () => {
    await fetchTransactions();
  }, [fetchTransactions]);

  const refreshOnAccountChange = useCallback(async () => {
    // Refresh portfolio data when accounts change to get updated account names
    hasFetchedRef.current = false; // Reset fetch flag to allow re-fetch
    await fetchTransactions();
  }, [fetchTransactions]);

  const addTransaction = useCallback(async (transaction: Omit<RawTransaction, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error: insertError } = await supabase
        .from('transactions')
        .insert([transaction])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Refresh the portfolio
      await refreshPortfolio();
    } catch (err) {
      console.error('Error adding transaction:', err);
      setError(err instanceof Error ? err.message : 'Failed to add transaction');
    }
  }, [refreshPortfolio]);

  const updateTransaction = useCallback(async (id: string, updates: Partial<RawTransaction>) => {
    try {
      const { error: updateError } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id);

      if (updateError) {
        throw updateError;
      }

      // Refresh the portfolio
      await refreshPortfolio();
    } catch (err) {
      console.error('Error updating transaction:', err);
      setError(err instanceof Error ? err.message : 'Failed to update transaction');
    }
  }, [refreshPortfolio]);

  const deleteTransaction = useCallback(async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      // Refresh the portfolio
      await refreshPortfolio();
    } catch (err) {
      console.error('Error deleting transaction:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete transaction');
    }
  }, [refreshPortfolio]);

  const value: PortfolioContextType = {
    transactions,
    accounts,
    loading: loading || authLoading,
    error: error || authError,
    portfolio,
    getEpisodes,
    getOpenEpisodes,
    getClosedEpisodes,
    getEpisodesByKind,
    getBalance,
    getTotalPnL,
    getFilteredEpisodes,
    getFilteredPositions,
    getFilteredTransactions,
    refreshPortfolio,
    refreshOnAccountChange,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
