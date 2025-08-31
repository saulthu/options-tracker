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
      
      console.log('🔍 Creating profile for user:', user.id, 'with name:', defaultName);
      
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          name: defaultName,
          email: user.email
        })
        .select()
        .single();

      console.log('📊 Profile creation response:', { data: profileData, error: profileError });

      if (profileError) {
        console.error('Failed to create profile:', profileError);
        const errorMessage = profileError.message || profileError.details || profileError.hint || 'Unknown database error';
        setError(`Failed to create profile: ${errorMessage}`);
        return;
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

        console.log('🔍 Fetching profile for user:', user.id);
        
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        console.log('📊 Profile fetch response:', { data, error: fetchError });

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

  // Debug: Log profile changes
  useEffect(() => {
    console.log('🔄 Profile state changed:', profile);
  }, [profile]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user || !profile) return { error: 'No user or profile found' };

    try {
      console.log('🔍 Updating profile with:', updates);
      
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

      console.log('📊 Profile update response:', { data, error: updateError });
      console.log('🔄 Setting profile to:', data);
      
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
