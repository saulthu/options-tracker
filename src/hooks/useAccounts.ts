"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: 'Individual' | 'Corporate' | 'SMSF' | 'IRA' | '401k' | 'Roth IRA' | 'Traditional IRA' | 'Other';
  institution: string;
  account_number?: string;
  description?: string;
  created_at: string;
}

export type AccountFormData = Omit<Account, 'id' | 'user_id' | 'created_at'>;

export function useAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch accounts from database
  const fetchAccounts = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      
      const { data, error: fetchError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });


      if (fetchError) {
        console.error('Error fetching accounts:', fetchError);
        const errorMessage = fetchError.message || fetchError.details || fetchError.hint || 'Unknown database error';
        setError(`Failed to fetch accounts: ${errorMessage}`);
        return;
      }

      setAccounts(data || []);
    } catch (err) {
      console.error('Unexpected error fetching accounts:', err);
      setError('Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Create new account
  const createAccount = async (accountData: AccountFormData): Promise<{ data?: Account; error?: string }> => {
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
  };

  // Update existing account
  const updateAccount = async (accountId: string, accountData: AccountFormData): Promise<{ data?: Account; error?: string }> => {
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
  };

  // Delete account
  const deleteAccount = async (accountId: string): Promise<{ error?: string }> => {
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
  };

  // Load accounts when user changes
  useEffect(() => {
    if (user) {
      fetchAccounts();
    } else {
      setAccounts([]);
      setLoading(false);
    }
  }, [user, fetchAccounts]);

  return {
    accounts,
    loading,
    error,
    createAccount,
    updateAccount,
    deleteAccount,
    refetch: fetchAccounts
  };
}
