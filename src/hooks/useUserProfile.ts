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
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  const createDefaultProfile = useCallback(async () => {
    if (!user || isCreatingProfile) return;
    
    try {
      setIsCreatingProfile(true);
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

      console.log('📊 Profile creation response:', { 
        data: profileData, 
        error: profileError,
        errorType: typeof profileError,
        errorKeys: profileError ? Object.keys(profileError) : 'no error',
        errorStringified: JSON.stringify(profileError)
      });

      // Check if we have data despite an error (sometimes Supabase returns both)
      if (profileData) {
        console.log('✅ Profile created successfully despite error:', profileData);
        setProfile(profileData);
        return;
      }

      if (profileError) {
        console.error('Failed to create profile:', profileError);
        console.error('Error details:', {
          type: typeof profileError,
          keys: Object.keys(profileError),
          stringified: JSON.stringify(profileError),
          isArray: Array.isArray(profileError),
          constructor: profileError.constructor?.name
        });
        
        // Handle different error types
        let errorMessage = 'Unknown database error';
        
        // Check for unique constraint violation first (most common case)
        if (profileError.code === '23505') {
          // Unique constraint violation - profile already exists
          console.log('Profile already exists (race condition), code:', profileError.code);
          console.log('Profile already exists, this is likely a race condition');
          // Don't set error state for this case, just return
          return;
        } else if (profileError.message) {
          errorMessage = profileError.message;
        } else if (profileError.details) {
          errorMessage = profileError.details;
        } else if (profileError.hint) {
          errorMessage = profileError.hint;
        } else if (typeof profileError === 'object' && Object.keys(profileError).length === 0) {
          errorMessage = 'Empty error object - possible race condition or duplicate key';
          console.log('Empty error object detected, this might be a Supabase client issue');
          
          // Try to fetch the profile anyway in case it was actually created
          console.log('🔄 Attempting to fetch profile despite empty error...');
          try {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('users')
              .select('*')
              .eq('id', user.id)
              .single();
            
            if (fallbackData && !fallbackError) {
              console.log('✅ Profile found despite empty error:', fallbackData);
              setProfile(fallbackData);
              return;
            } else {
              console.log('❌ Fallback fetch also failed:', fallbackError);
            }
          } catch (fallbackErr) {
            console.log('❌ Fallback fetch threw error:', fallbackErr);
          }
        } else {
          // Log the full error object for debugging
          console.error('Unexpected error structure:', JSON.stringify(profileError, null, 2));
          errorMessage = `Database error: ${JSON.stringify(profileError)}`;
        }
        
        setError(`Failed to create profile: ${errorMessage}`);
        return;
      }

      // If we get here, we have data and no error
      setProfile(profileData);
    } catch (err) {
      console.error('Failed to create default profile:', err);
      setError(`Failed to create default profile: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsCreatingProfile(false);
    }
  }, [user, isCreatingProfile]);

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
            
            // After creating profile, try to fetch it again
            const { data: retryData, error: retryError } = await supabase
              .from('users')
              .select('*')
              .eq('id', user.id)
              .single();
            
            if (retryError) {
              console.error('Failed to fetch profile after creation:', retryError);
              setError(`Failed to fetch profile after creation: ${retryError.message || 'Unknown error'}`);
            } else {
              setProfile(retryData);
            }
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
