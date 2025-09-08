'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from './AuthContext';
import { 
  buildPortfolio, 
  PortfolioState, 
  Transaction, 
  Position, 
  RealizedEvent,
  TimeRange,
  getAccountPositions,
  getAccountRealizedPnL,
  getAccountBalance,
  getTotalRealizedPnL,
  filterTransactionsByTimeRange
} from '@/lib/portfolio-calculator';

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PortfolioContextType {
  // Raw data
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  
  // Derived state
  portfolio: PortfolioState | null;
  
  // Helper functions
  getPositions: (accountId: string) => Position[];
  getRealizedPnL: (accountId: string) => RealizedEvent[];
  getBalance: (accountId: string) => number;
  getTotalPnL: (accountId: string) => number;
  getFilteredTransactions: (timeRange: TimeRange) => Transaction[];
  getFilteredPortfolio: (timeRange: TimeRange) => PortfolioState | null;
  
  // Actions
  refreshPortfolio: () => Promise<void>;
  refreshOnAccountChange: () => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

interface PortfolioProviderProps {
  children: ReactNode;
}

export function PortfolioProvider({ children }: PortfolioProviderProps) {
  const { user, loading: authLoading, error: authError } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
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
      const newPortfolio = buildPortfolio(transactions);
      setPortfolio(newPortfolio);
    } else {
      setPortfolio(null);
    }
  }, [transactions]);

  // Initial fetch - only when auth is ready and user is available
  useEffect(() => {
    if (!authLoading && user && !authError) {
      fetchTransactions();
    } else if (!authLoading && !user) {
      // User is not authenticated, clear data
      setTransactions([]);
      setPortfolio(null);
      setLoading(false);
    }
  }, [fetchTransactions, authLoading, user, authError]);

  // Helper functions
  const getPositions = useCallback((accountId: string): Position[] => {
    if (!portfolio) return [];
    return getAccountPositions(portfolio, accountId);
  }, [portfolio]);

  const getRealizedPnL = useCallback((accountId: string): RealizedEvent[] => {
    if (!portfolio) return [];
    return getAccountRealizedPnL(portfolio, accountId);
  }, [portfolio]);

  const getBalance = useCallback((accountId: string): number => {
    if (!portfolio) return 0;
    return getAccountBalance(portfolio, accountId);
  }, [portfolio]);

  const getTotalPnL = useCallback((accountId: string): number => {
    if (!portfolio) return 0;
    return getTotalRealizedPnL(portfolio, accountId);
  }, [portfolio]);

  const getFilteredTransactions = useCallback((timeRange: TimeRange): Transaction[] => {
    return filterTransactionsByTimeRange(transactions, timeRange);
  }, [transactions]);

  const getFilteredPortfolio = useCallback((): PortfolioState | null => {
    // Always use the full portfolio (built from ALL transactions)
    // The filtering should only affect the display, not the calculation
    return portfolio;
  }, [portfolio]);

  // Actions
  const refreshPortfolio = useCallback(async () => {
    await fetchTransactions();
  }, [fetchTransactions]);

  const refreshOnAccountChange = useCallback(async () => {
    // Refresh portfolio data when accounts change to get updated account names
    await fetchTransactions();
  }, [fetchTransactions]);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => {
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

  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>) => {
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
    loading: loading || authLoading,
    error: error || authError,
    portfolio,
    getPositions,
    getRealizedPnL,
    getBalance,
    getTotalPnL,
    getFilteredTransactions,
    getFilteredPortfolio,
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
