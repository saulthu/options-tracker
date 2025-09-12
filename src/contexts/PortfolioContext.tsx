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
  
  // Account management
  createAccount: (accountData: Omit<Account, 'id' | 'user_id' | 'created_at'>) => Promise<{ data?: Account; error?: string }>;
  updateAccount: (accountId: string, accountData: Omit<Account, 'id' | 'user_id' | 'created_at'>) => Promise<{ data?: Account; error?: string }>;
  deleteAccount: (accountId: string) => Promise<{ error?: string }>;
  refreshAccounts: () => Promise<void>;
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

  // Account management functions
  const createAccount = useCallback(async (accountData: Omit<Account, 'id' | 'user_id' | 'created_at'>): Promise<{ data?: Account; error?: string }> => {
    if (!user) return { error: 'No user found' };

    try {
      const { data, error: createError } = await supabase
        .from('accounts')
        .insert({
          user_id: user.id,
          ...accountData
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating account:', createError);
        
        // Handle unique constraint violation specifically
        if (createError.code === '23505' && createError.message.includes('unique constraint')) {
          return { error: 'An account with this name already exists. Please choose a different name.' };
        }
        
        return { error: createError.message || 'Failed to create account' };
      }

      // Update local state
      setAccounts(prev => [data, ...prev]);
      return { data };
    } catch (err) {
      console.error('Unexpected error creating account:', err);
      return { error: 'Failed to create account' };
    }
  }, [user]);

  const updateAccount = useCallback(async (accountId: string, accountData: Omit<Account, 'id' | 'user_id' | 'created_at'>): Promise<{ data?: Account; error?: string }> => {
    if (!user) return { error: 'No user found' };

    try {
      const { data, error: updateError } = await supabase
        .from('accounts')
        .update(accountData)
        .eq('id', accountId)
        .eq('user_id', user.id) // Ensure user owns the account
        .select()
        .single();

      if (updateError) {
        console.error('Error updating account:', updateError);
        
        // Handle unique constraint violation specifically
        if (updateError.code === '23505' && updateError.message.includes('unique constraint')) {
          return { error: 'An account with this name already exists. Please choose a different name.' };
        }
        
        return { error: updateError.message || 'Failed to update account' };
      }

      // Update local state
      setAccounts(prev => prev.map(acc => 
        acc.id === accountId ? data : acc
      ));
      return { data };
    } catch (err) {
      console.error('Unexpected error updating account:', err);
      return { error: 'Failed to update account' };
    }
  }, [user]);

  const deleteAccount = useCallback(async (accountId: string): Promise<{ error?: string }> => {
    if (!user) return { error: 'No user found' };

    try {
      const { error: deleteError } = await supabase
        .from('accounts')
        .delete()
        .eq('id', accountId)
        .eq('user_id', user.id); // Ensure user owns the account

      if (deleteError) {
        console.error('Error deleting account:', deleteError);
        return { error: deleteError.message };
      }

      // Update local state
      setAccounts(prev => prev.filter(acc => acc.id !== accountId));
      return {};
    } catch (err) {
      console.error('Unexpected error deleting account:', err);
      return { error: 'Failed to delete account' };
    }
  }, [user]);

  const refreshAccounts = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
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
      console.error('Error refreshing accounts:', err);
    }
  }, [user]);

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
    createAccount,
    updateAccount,
    deleteAccount,
    refreshAccounts,
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
