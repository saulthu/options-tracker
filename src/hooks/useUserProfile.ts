import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  created: string;
}

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const createDefaultProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      // Create user profile with default name
      const defaultName = user.email?.split('@')[0] || 'User';
      
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          name: defaultName,
          email: user.email
        })
        .select()
        .single();

      if (profileError) {
        console.error('Failed to create profile:', profileError);
        setError(`Failed to create profile: ${profileError.message || 'Unknown error occurred'}`);
        return;
      }

      // Create default trading account
      const { error: accountError } = await supabase
        .from('accounts')
        .insert({
          user_id: user.id,
          name: 'Main Trading Account',
          type: 'Individual',
          institution: 'TD Ameritrade'
        });

      if (accountError) {
        console.warn('Profile created but account failed:', accountError.message);
        // Don't fail completely - profile is more important
      }

      setProfile(profileData);
    } catch (err) {
      console.error('Failed to create default profile:', err);
      setError(`Failed to create default profile: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        try {
          const { data, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
          
          return { data, error: fetchError };
        } catch (requestError) {
          throw requestError;
        }

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            // No profile found - create one automatically
            await createDefaultProfile();
          } else {
            setError(`Database error: ${fetchError.message || 'Unknown error occurred'}`);
          }
        } else {
          setProfile(data);
        }
      } catch (err) {
        console.error('Unexpected error fetching profile:', err);
        setError('Failed to fetch user profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, createDefaultProfile]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user || !profile) return { error: 'No user or profile found' };

    try {
      const { data, error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating profile:', updateError);
        return { error: updateError.message };
      }

      setProfile(data);
      return { data };
    } catch (err) {
      console.error('Unexpected error updating profile:', err);
      return { error: 'Failed to update profile' };
    }
  };

  return {
    profile,
    loading,
    error,
    updateProfile,
    hasProfile: !!profile,
  };
}
