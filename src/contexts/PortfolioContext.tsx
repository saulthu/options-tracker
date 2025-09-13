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
} from '@/lib/episode-portfolio-calculator-v2';
import { InstrumentKind } from '@/types/episodes';
import { CurrencyAmount, CurrencyCode, isValidCurrencyCode } from '@/lib/currency-amount';
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

/**
 * Convert raw database transaction to RawTransaction with CurrencyAmount
 */
function convertToRawTransaction(dbTxn: {
  id: string;
  user_id: string;
  account_id: string;
  timestamp: string;
  created_at: string;
  updated_at: string;
  instrument_kind: string;
  ticker_id?: string;
  expiry?: string;
  strike?: number;
  side?: string;
  qty: number;
  price?: number;
  fees: number;
  currency: string;
  memo?: string;
  tickers?: {
    id: string;
    user_id: string;
    name: string;
    icon?: string;
  };
  accounts?: {
    id: string;
    name: string;
    type: string;
    institution: string;
  };
}): RawTransaction {
  // Validate currency code
  if (!isValidCurrencyCode(dbTxn.currency)) {
    throw new Error(`Invalid currency code in transaction ${dbTxn.id}: ${dbTxn.currency}`);
  }

  const currency = dbTxn.currency as CurrencyCode;

  // Convert price to CurrencyAmount if present
  let price: CurrencyAmount | undefined;
  if (dbTxn.price !== null && dbTxn.price !== undefined) {
    price = new CurrencyAmount(dbTxn.price, currency);
  }

  // Convert fees to CurrencyAmount
  const fees = new CurrencyAmount(dbTxn.fees || 0, currency);

  // Convert strike to CurrencyAmount if present
  let strike: CurrencyAmount | undefined;
  if (dbTxn.strike !== null && dbTxn.strike !== undefined) {
    strike = new CurrencyAmount(dbTxn.strike, currency);
  }

  return {
    id: dbTxn.id,
    user_id: dbTxn.user_id,
    account_id: dbTxn.account_id,
    timestamp: dbTxn.timestamp,
    created_at: dbTxn.created_at,
    updated_at: dbTxn.updated_at,
    instrument_kind: dbTxn.instrument_kind as InstrumentKind,
    ticker_id: dbTxn.ticker_id,
    expiry: dbTxn.expiry,
    strike: strike,
    side: dbTxn.side as 'BUY' | 'SELL' | undefined,
    qty: dbTxn.qty,
    price,
    fees,
    currency: dbTxn.currency,
    memo: dbTxn.memo,
    tickers: dbTxn.tickers,
    accounts: dbTxn.accounts
  };
}

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
  getBalance: (accountId: string) => Map<CurrencyCode, CurrencyAmount>;
  getTotalPnL: (accountId?: string) => Map<CurrencyCode, CurrencyAmount>;
  getAccountValue: (accountId: string) => Map<CurrencyCode, CurrencyAmount>;
  getFilteredEpisodes: (timeRange: TimeRange, accountId?: string, filterType?: 'overlap' | 'openedDuring' | 'closedDuring') => PositionEpisode[];
  getFilteredPositions: (timeRange: TimeRange, accountId?: string, filterType?: 'overlap' | 'openedDuring' | 'closedDuring') => PositionEpisode[];
  getFilteredTransactions: (timeRange: TimeRange) => RawTransaction[];
  
  // Actions
  refreshPortfolio: () => Promise<void>;
  refreshOnAccountChange: () => Promise<void>;
  addTransaction: (transaction: Omit<RawTransaction, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  addTransactions: (transactions: Omit<RawTransaction, 'id' | 'created_at' | 'updated_at'>[]) => Promise<{ successCount: number; errorCount: number; errors: string[] }>;
  updateTransaction: (id: string, updates: Partial<RawTransaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  deleteAllTransactionsForAccount: (accountId: string) => Promise<void>;
  
  // Account management
  createAccount: (accountData: Omit<Account, 'id' | 'user_id' | 'created_at'>) => Promise<{ data?: Account; error?: string }>;
  updateAccount: (accountId: string, accountData: Omit<Account, 'id' | 'user_id' | 'created_at'>) => Promise<{ data?: Account; error?: string }>;
  deleteAccount: (accountId: string) => Promise<{ error?: string }>;
  refreshAccounts: () => Promise<void>;
  
  // Ticker management
  ensureTickersExist: (tickerNames: string[]) => Promise<{ [tickerName: string]: string }>; // Returns ticker name to ID mapping
  getTickerId: (tickerName: string) => Promise<string | null>;
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

      // Convert raw database transactions to RawTransaction with CurrencyAmount
      const convertedTransactions = (data || []).map(convertToRawTransaction);
      setTransactions(convertedTransactions);

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
    console.log('Portfolio recalculation triggered, transaction count:', transactions.length);
    if (transactions.length > 0) {
      const tickerLookup = createTickerLookup(transactions);
      const openingBalances = new Map<string, CurrencyAmount>(); // No opening balances for now
      const newPortfolio = buildPortfolioView(transactions, tickerLookup, openingBalances);
      console.log('Portfolio rebuilt with', newPortfolio.episodes.length, 'episodes');
      setPortfolio(newPortfolio);
    } else {
      console.log('No transactions, setting portfolio to null');
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

  const getBalance = useCallback((accountId: string): Map<CurrencyCode, CurrencyAmount> => {
    if (!portfolio) return new Map();
    
    // Get all balances for this account across all currencies
    const accountBalances = new Map<CurrencyCode, CurrencyAmount>();
    
    // Find all currencies that have transactions for this account
    const accountTransactions = transactions.filter(t => t.account_id === accountId);
    const currencies = new Set(accountTransactions.map(t => t.currency));
    
    // Get balance for each currency
    const accountBalancesMap = portfolio.balances.get(accountId) || new Map<CurrencyCode, CurrencyAmount>();
    for (const currency of currencies) {
      const balance = accountBalancesMap.get(currency as CurrencyCode);
      if (balance) {
        accountBalances.set(currency as CurrencyCode, balance);
      } else {
        // If no balance for this currency, it's zero
        accountBalances.set(currency as CurrencyCode, CurrencyAmount.zero(currency as CurrencyCode));
      }
    }
    
    return accountBalances;
  }, [portfolio, transactions]);

  const getTotalPnL = useCallback((accountId?: string): Map<CurrencyCode, CurrencyAmount> => {
    if (!portfolio) return new Map();
    if (accountId) {
      return getAccountRealizedPnL(portfolio.episodes, accountId);
    }
    return getTotalRealizedPnL(portfolio.episodes);
  }, [portfolio]);

  const getAccountValue = useCallback((accountId: string): Map<CurrencyCode, CurrencyAmount> => {
    if (!portfolio) return new Map();
    
    const balances = getBalance(accountId);
    const pnl = getTotalPnL(accountId);
    
    // Combine balances and P&L for each currency
    const accountValues = new Map<CurrencyCode, CurrencyAmount>();
    
    // Get all currencies from both balance and P&L
    const allCurrencies = new Set([...balances.keys(), ...pnl.keys()]);
    
    for (const currency of allCurrencies) {
      const balance = balances.get(currency) || CurrencyAmount.zero(currency);
      const pnlAmount = pnl.get(currency) || CurrencyAmount.zero(currency);
      accountValues.set(currency, balance.add(pnlAmount));
    }
    
    return accountValues;
  }, [portfolio, getBalance, getTotalPnL]);

  const getFilteredEpisodes = useCallback((timeRange: TimeRange, accountId?: string, filterType: 'overlap' | 'openedDuring' | 'closedDuring' = 'overlap'): PositionEpisode[] => {
    if (!portfolio) return [];
    const episodes = accountId ? getAccountEpisodes(portfolio.episodes, accountId) : portfolio.episodes;
    const startDate = timeRange.startDate.toISOString();
    const endDate = timeRange.endDate.toISOString();
    return filterEpisodesByDateRange(episodes, startDate, endDate, filterType);
  }, [portfolio]);

  const getFilteredPositions = useCallback((timeRange: TimeRange, accountId?: string, filterType: 'overlap' | 'openedDuring' | 'closedDuring' = 'overlap'): PositionEpisode[] => {
    if (!portfolio) return [];
    const positions = accountId ? getAccountEpisodes(portfolio.episodes, accountId) : portfolio.episodes;
    const startDate = timeRange.startDate.toISOString();
    const endDate = timeRange.endDate.toISOString();
    return filterEpisodesByDateRange(positions, startDate, endDate, filterType);
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
    // Reset fetch flag to allow re-fetch
    hasFetchedRef.current = false;
    await fetchTransactions();
  }, [fetchTransactions]);

  const refreshOnAccountChange = useCallback(async () => {
    // Refresh portfolio data when accounts change to get updated account names
    hasFetchedRef.current = false; // Reset fetch flag to allow re-fetch
    await fetchTransactions();
  }, [fetchTransactions]);

  const addTransaction = useCallback(async (transaction: Omit<RawTransaction, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      console.log('Attempting to insert transaction:', JSON.stringify(transaction, null, 2));
      
      const { data, error: insertError } = await supabase
        .from('transactions')
        .insert([transaction])
        .select()
        .single();

      if (insertError) {
        console.error('Supabase insert error details:', {
          error: insertError,
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        });
        throw insertError;
      }

      console.log('Transaction inserted successfully:', data);
      
      // Note: Portfolio refresh is now explicit - caller decides when to refresh
    } catch (err) {
      console.error('Error adding transaction:', err);
      setError(err instanceof Error ? err.message : 'Failed to add transaction');
      // Re-throw the error so calling code can handle it
      throw err;
    }
  }, []);

  const addTransactions = useCallback(async (transactions: Omit<RawTransaction, 'id' | 'created_at' | 'updated_at'>[]) => {
    try {
      console.log(`Attempting to batch insert ${transactions.length} transactions`);
      console.log('Sample transaction before conversion:', transactions[0]);
      
      // Convert CurrencyAmount instances to primitive types for Supabase
      const dbTransactions = transactions.map(txn => ({
        user_id: txn.user_id,
        account_id: txn.account_id,
        timestamp: txn.timestamp,
        instrument_kind: txn.instrument_kind,
        ticker_id: txn.ticker_id,
        expiry: txn.expiry,
        strike: txn.strike?.amount || null,
        side: txn.side,
        qty: txn.qty,
        price: txn.price?.amount || null,
        fees: txn.fees.amount || 0, // Ensure fees is never null
        currency: txn.fees.currency, // Use fees currency as the transaction currency
        memo: txn.memo
      }));
      
      console.log('Sample transaction after conversion:', dbTransactions[0]);
      
      // Validate required fields
      const validationErrors: string[] = [];
      dbTransactions.forEach((txn, index) => {
        if (!txn.user_id) validationErrors.push(`Transaction ${index}: missing user_id`);
        if (!txn.account_id) validationErrors.push(`Transaction ${index}: missing account_id`);
        if (!txn.timestamp) validationErrors.push(`Transaction ${index}: missing timestamp`);
        if (!txn.instrument_kind) validationErrors.push(`Transaction ${index}: missing instrument_kind`);
        if (txn.qty === undefined || txn.qty === null) validationErrors.push(`Transaction ${index}: missing qty`);
        if (txn.fees === undefined || txn.fees === null) validationErrors.push(`Transaction ${index}: missing fees`);
        if (!txn.currency) validationErrors.push(`Transaction ${index}: missing currency`);
      });
      
      if (validationErrors.length > 0) {
        console.error('Validation errors:', validationErrors);
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }
      
      const { data, error: insertError } = await supabase
        .from('transactions')
        .insert(dbTransactions)
        .select();

      if (insertError) {
        console.error('Supabase batch insert error details:', {
          error: insertError,
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        });
        console.error('First transaction that failed:', dbTransactions[0]);
        console.error('All transactions being inserted:', dbTransactions);
        throw insertError;
      }

      console.log(`Successfully batch inserted ${data?.length || 0} transactions`);
      
      return {
        successCount: data?.length || 0,
        errorCount: 0,
        errors: []
      };
    } catch (err) {
      console.error('Error batch adding transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to batch add transactions');
      
      // Return error details for individual handling
      return {
        successCount: 0,
        errorCount: transactions.length,
        errors: [`Batch insert failed: ${err instanceof Error ? err.message : 'Unknown error'}`]
      };
    }
  }, []);

  const updateTransaction = useCallback(async (id: string, updates: Partial<RawTransaction>) => {
    try {
      const { error: updateError } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id);

      if (updateError) {
        throw updateError;
      }

      // Note: Portfolio refresh is now explicit - caller decides when to refresh
    } catch (err) {
      console.error('Error updating transaction:', err);
      setError(err instanceof Error ? err.message : 'Failed to update transaction');
      // Re-throw the error so calling code can handle it
      throw err;
    }
  }, []);

  const deleteTransaction = useCallback(async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      // Note: Portfolio refresh is now explicit - caller decides when to refresh
    } catch (err) {
      console.error('Error deleting transaction:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete transaction');
      // Re-throw the error so calling code can handle it
      throw err;
    }
  }, []);

  const deleteAllTransactionsForAccount = useCallback(async (accountId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('account_id', accountId);

      if (deleteError) {
        throw deleteError;
      }

      console.log(`All transactions for account ${accountId} deleted successfully`);
    } catch (err) {
      console.error('Error deleting transactions for account:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete transactions');
      // Re-throw the error so calling code can handle it
      throw err;
    }
  }, []);

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

  // Ticker management methods
  const ensureTickersExist = useCallback(async (tickerNames: string[]): Promise<{ [tickerName: string]: string }> => {
    if (!tickerNames.length) return {};
    if (!user) {
      throw new Error('User must be authenticated to manage tickers');
    }

    try {
      console.log('Ensuring tickers exist:', tickerNames);
      
      // First, check which tickers already exist for this user
      const { data: existingTickers, error: fetchError } = await supabase
        .from('tickers')
        .select('id, name')
        .eq('user_id', user.id)
        .in('name', tickerNames);

      if (fetchError) {
        console.error('Error fetching existing tickers:', fetchError);
        throw fetchError;
      }

      const existingTickerMap: { [name: string]: string } = {};
      const existingNames = new Set<string>();

      if (existingTickers) {
        existingTickers.forEach(ticker => {
          existingTickerMap[ticker.name] = ticker.id;
          existingNames.add(ticker.name);
        });
      }

      // Find tickers that need to be created
      const tickersToCreate = tickerNames.filter(name => !existingNames.has(name));
      
      if (tickersToCreate.length > 0) {
        console.log('Creating new tickers:', tickersToCreate);
        
        // Create missing tickers with user_id
        const { data: newTickers, error: createError } = await supabase
          .from('tickers')
          .insert(tickersToCreate.map(name => ({ name, user_id: user.id })))
          .select('id, name');

        if (createError) {
          console.error('Error creating tickers:', createError);
          throw createError;
        }

        // Add new tickers to the map
        if (newTickers) {
          newTickers.forEach(ticker => {
            existingTickerMap[ticker.name] = ticker.id;
          });
        }
      }

      console.log('Ticker mapping created:', existingTickerMap);
      return existingTickerMap;
    } catch (err) {
      console.error('Error ensuring tickers exist:', err);
      throw err;
    }
  }, [user]);

  const getTickerId = useCallback(async (tickerName: string): Promise<string | null> => {
    if (!user) {
      console.error('User must be authenticated to get ticker ID');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('tickers')
        .select('id')
        .eq('name', tickerName)
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching ticker ID:', error);
        return null;
      }

      return data?.id || null;
    } catch (err) {
      console.error('Error getting ticker ID:', err);
      return null;
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
    getAccountValue,
    getFilteredEpisodes,
    getFilteredPositions,
    getFilteredTransactions,
    refreshPortfolio,
    refreshOnAccountChange,
    addTransaction,
    addTransactions,
    updateTransaction,
    deleteTransaction,
    deleteAllTransactionsForAccount,
    createAccount,
    updateAccount,
    deleteAccount,
    refreshAccounts,
    ensureTickersExist,
    getTickerId,
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
