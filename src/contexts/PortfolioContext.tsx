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
} from '@/lib/portfolio-calculator';
import { createTagManager, TagFilter as TagFilterType } from '@/lib/tag-manager';
import { InstrumentKind } from '@/types/episodes';
import { CurrencyAmount, CurrencyCode, isValidCurrencyCode } from '@/lib/currency-amount';
import { marketData } from '@/lib/market-data';
import { Candle, OptionsEntry } from '@/types/market-data';
import { 
  PortfolioResult,
  PositionEpisode,
  RawTransaction
} from '@/types/episodes';
import { Account, User } from '@/types/database';
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
  
  // Lookup maps for efficient name resolution
  accountLookup: Map<string, Account>;
  userLookup: Map<string, User>;
  
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
  
  // Lookup helper functions
  getAccountName: (accountId: string) => string;
  getUserName: (userId: string) => string;
  
  // Tag filtering
  getAllTags: () => string[];
  getTagStats: () => { tag: string; count: number }[];
  getFilteredEpisodesByTags: (tagFilter: TagFilterType, timeRange: TimeRange, accountId?: string) => PositionEpisode[];
  getFilteredTransactionsByTags: (tagFilter: TagFilterType, timeRange: TimeRange) => RawTransaction[];
  getEpisodeTags: (episode: PositionEpisode) => string[];
  
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
  
  // Market data
  primeMarketData: () => Promise<void>;
  getMarketCandles: (ticker: string, timeframe: '1D' | '1W', forceRefresh?: boolean) => Promise<Candle[]>;
  getMarketIndicator: (ticker: string, indicator: 'SMA' | 'EMA', params: { window: number }, timeframe: '1D' | '1W') => Promise<number[]>;
  getMarketOption: (ticker: string, key: { expiry: string; strike: number }, forceRefresh?: boolean) => Promise<OptionsEntry | null>;
  listMarketOptionKeys: (ticker: string) => Promise<{ expiry: string; strike: number }[]>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

// DEBUG: Toggle this to enable/disable debug logging

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
  
  // Lookup maps for efficient name resolution
  const [accountLookup, setAccountLookup] = useState<Map<string, Account>>(new Map());
  const [userLookup, setUserLookup] = useState<Map<string, User>>(new Map());

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

      // Test if the transactions table exists (for error handling)
      await supabase
        .from('transactions')
        .select('count')
        .limit(1);
      

      // Try to fetch transactions directly
      // Fetch ALL transactions using pagination to avoid 1000 row limit
      const allTransactions: unknown[] = [];
      let hasMore = true;
      let offset = 0;
      const batchSize = 1000;
      
      
      while (hasMore) {
        
        const { data: batchData, error: fetchError } = await supabase
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
          .order('timestamp', { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (fetchError) {
          console.error('Supabase pagination error:', {
            code: fetchError.code,
            message: fetchError.message,
            offset,
            batchSize
          });
          throw fetchError;
        }

        if (!batchData || batchData.length === 0) {
          hasMore = false;
        } else {
          allTransactions.push(...batchData);
          
          // If we got less than the batch size, we've reached the end
          if (batchData.length < batchSize) {
            hasMore = false;
          } else {
            offset += batchSize;
          }
        }
      }
      
      const data = allTransactions;


      // If no data was returned from pagination, set empty array
      if (!data || data.length === 0) {
        setTransactions([]);
        setAccounts([]);
        return;
      }

      // Continue with processing the fetched data

      // Convert raw database transactions to RawTransaction with CurrencyAmount
      const convertedTransactions = (data || []).map(convertToRawTransaction as (value: unknown) => RawTransaction);
      setTransactions(convertedTransactions);

      // Also fetch accounts for the debug page
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id);

      if (accountsError) {
        console.warn('Error fetching accounts:', accountsError);
        setAccounts([]);
        setAccountLookup(new Map());
      } else {
        const accountsList = accountsData || [];
        setAccounts(accountsList);
        
        // Build account lookup map
        const accountMap = new Map<string, Account>();
        accountsList.forEach(account => {
          accountMap.set(account.id, account);
        });
        setAccountLookup(accountMap);
      }
      
      // Build user lookup map
      const userMap = new Map<string, User>();
      userMap.set(user.id, {
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.name,
        created_at: user.created_at || new Date().toISOString(),
        updated_at: user.updated_at || new Date().toISOString()
      });
      setUserLookup(userMap);
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

  // Recalculate portfolio when transactions change - PER ACCOUNT APPROACH
  useEffect(() => {
    if (transactions.length > 0) {
      
      
      // Step 1: Extract unique account IDs
      const accountIds = Array.from(new Set(transactions.map(txn => txn.account_id)));
      
      // Step 2: Process each account independently
      const allEpisodes: PositionEpisode[] = [];
      const allBalances = new Map<string, Map<CurrencyCode, CurrencyAmount>>();
      const allLedger: PortfolioResult['ledger'] = [];
      
      accountIds.forEach(accountId => {
        // Filter transactions for this account only
        const accountTransactions = transactions.filter(txn => txn.account_id === accountId);
        
        
        
        // Create ticker lookup for this account's transactions
        const accountTickerLookup = createTickerLookup(accountTransactions);
        const accountOpeningBalances = new Map<string, CurrencyAmount>();
        
        // Run portfolio calculator on this account ONLY
        const accountPortfolio = buildPortfolioView(accountTransactions, accountTickerLookup, accountOpeningBalances);
        
        
        
        // Accumulate results from this account
        allEpisodes.push(...accountPortfolio.episodes);
        allLedger.push(...accountPortfolio.ledger);
        
        // Accumulate balances from this account
        accountPortfolio.balances.forEach((balanceMap, accountId) => {
          allBalances.set(accountId, balanceMap);
        });
      });
      
      // Step 3: Create unified portfolio result
      const unifiedPortfolio: PortfolioResult = {
        episodes: allEpisodes,
        balances: allBalances,
        ledger: allLedger
      };
      
      
      
      
      setPortfolio(unifiedPortfolio);
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
    
    // For account value, we just return the balances
    // The balances already include all cash flows (including forex transactions)
    // P&L is only relevant for closed positions, not for current account value
    return getBalance(accountId);
  }, [portfolio, getBalance]);

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
      
      const { error: insertError } = await supabase
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
        currency: txn.currency, // Use the transaction's own currency
        memo: txn.memo
      }));
      
      
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

  // Tag filtering methods
  const getAllTags = useCallback(() => {
    if (!portfolio) return [];
    const tagManager = createTagManager(transactions, portfolio.episodes);
    return tagManager.getAllTags();
  }, [transactions, portfolio]);

  const getTagStats = useCallback(() => {
    if (!portfolio) return [];
    const tagManager = createTagManager(transactions, portfolio.episodes);
    return tagManager.getTransactionTagStats();
  }, [transactions, portfolio]);

  const getFilteredEpisodesByTags = useCallback((
    tagFilter: TagFilterType, 
    timeRange: TimeRange, 
    accountId?: string
  ) => {
    if (!portfolio) return [];
    
    // First filter by time range and account
    const timeFilteredEpisodes = getFilteredEpisodes(timeRange, accountId);
    
    // Then filter by tags
    const tagManager = createTagManager(transactions, timeFilteredEpisodes);
    return tagManager.filterEpisodes(tagFilter);
  }, [portfolio, transactions, getFilteredEpisodes]);

  const getFilteredTransactionsByTags = useCallback((
    tagFilter: TagFilterType, 
    timeRange: TimeRange
  ) => {
    // First filter by time range
    const timeFilteredTransactions = getFilteredTransactions(timeRange);
    
    // Then filter by tags
    const tagManager = createTagManager(timeFilteredTransactions, []);
    return tagManager.filterTransactions(tagFilter);
  }, [getFilteredTransactions]);

  const getEpisodeTags = useCallback((episode: PositionEpisode) => {
    if (!portfolio) return [];
    const tagManager = createTagManager(transactions, portfolio.episodes);
    return tagManager.getEpisodeTags(episode);
  }, [transactions, portfolio]);

  // Lookup helper functions
  const getAccountName = useCallback((accountId: string): string => {
    const account = accountLookup.get(accountId);
    return account ? account.name : 'Unknown Account';
  }, [accountLookup]);

  const getUserName = useCallback((userId: string): string => {
    const user = userLookup.get(userId);
    return user ? (user.name || user.email || 'Unknown User') : 'Unknown User';
  }, [userLookup]);

  // Market data methods
  const primeMarketData = useCallback(async (): Promise<void> => {
    if (!portfolio) return;
    
    try {
      // Get all unique ticker names from the portfolio
      const tickerNames = Array.from(new Set(
        portfolio.episodes
          .filter(episode => episode.kindGroup !== 'CASH' && episode.episodeKey !== 'CASH')
          .map(episode => {
            // Extract ticker from episodeKey
            // For SHARES: episodeKey is just the ticker
            // For OPTIONS: episodeKey is "TICKER|CALL|STRIKE|EXPIRY" or "TICKER|PUT|STRIKE|EXPIRY"
            if (episode.kindGroup === 'SHARES') {
              return episode.episodeKey;
            } else if (episode.kindGroup === 'OPTION') {
              return episode.episodeKey.split('|')[0];
            }
            return null;
          })
          .filter((ticker): ticker is string => ticker !== null)
      ));
      
      if (tickerNames.length > 0) {
        await marketData.primeFromDB(tickerNames);
      }
    } catch (error) {
      console.warn('Failed to prime market data:', error);
    }
  }, [portfolio]);

  const getMarketCandles = useCallback(async (ticker: string, timeframe: '1D' | '1W', forceRefresh = false) => {
    try {
      return await marketData.getCandles(ticker, timeframe, { forceRefresh });
    } catch (error) {
      console.error(`Failed to get candles for ${ticker}:`, error);
      return [];
    }
  }, []);

  const getMarketIndicator = useCallback(async (
    ticker: string, 
    indicator: 'SMA' | 'EMA', 
    params: { window: number }, 
    timeframe: '1D' | '1W'
  ) => {
    try {
      return await marketData.getIndicator(ticker, indicator, params, timeframe);
    } catch (error) {
      console.error(`Failed to get ${indicator} for ${ticker}:`, error);
      return [];
    }
  }, []);

  const getMarketOption = useCallback(async (
    ticker: string, 
    key: { expiry: string; strike: number }, 
    forceRefresh = false
  ) => {
    try {
      return await marketData.getOption(ticker, key, { forceRefresh });
    } catch (error) {
      console.error(`Failed to get option data for ${ticker}:`, error);
      return null;
    }
  }, []);

  const listMarketOptionKeys = useCallback(async (ticker: string) => {
    try {
      return await marketData.listOptionKeys(ticker);
    } catch (error) {
      console.error(`Failed to list option keys for ${ticker}:`, error);
      return [];
    }
  }, []);

  // Prime market data when portfolio changes
  useEffect(() => {
    if (portfolio) {
      primeMarketData();
    }
  }, [portfolio, primeMarketData]);

  const value: PortfolioContextType = {
    transactions,
    accounts,
    accountLookup,
    userLookup,
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
    getAccountName,
    getUserName,
    getAllTags,
    getTagStats,
    getFilteredEpisodesByTags,
    getFilteredTransactionsByTags,
    getEpisodeTags,
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
    primeMarketData,
    getMarketCandles,
    getMarketIndicator,
    getMarketOption,
    listMarketOptionKeys,
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
