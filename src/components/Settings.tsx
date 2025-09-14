"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeButton, CancelButton } from "@/components/ui/theme-button";
import { User, Save } from "lucide-react";


interface SettingsProps {
  updateProfile: (updates: { name: string }) => Promise<{ data?: { id: string; name: string; email: string; created: string } | null; error?: string }>;
  profile: {
    id: string;
    name: string;
    email: string;
    created: string;
  } | null;
}

export default function Settings({ updateProfile, profile }: SettingsProps) {
  const { user } = useAuth();
  const [tempName, setTempName] = useState("");
  const [saving, setSaving] = useState(false);

  // Load profile data when component mounts or profile changes
  useEffect(() => {
    if (profile) {
      setTempName(profile.name);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!tempName.trim()) return;
    
    setSaving(true);
    try {
      const result = await updateProfile({ name: tempName.trim() });
      if (result.error) {
        console.error('Failed to save profile:', result.error);
        // You could add a toast notification here
      }
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setTempName(profile?.name || '');
  };



  // Show loading state while profile is being fetched
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-white text-xl">Loading profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {profile ? 'Settings' : 'Complete Your Profile'}
          </h1>
          <p className="text-[#b3b3b3]">
            {profile 
              ? 'Manage your account preferences and profile information'
              : 'Please set your display name to complete your profile setup'
            }
          </p>
        </div>

        {/* Profile Settings */}
        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white mb-6" data-1p-ignore data-lpignore="true" data-form-type="other">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <User className="w-5 h-5 mr-2" />
              Profile Information
            </CardTitle>
            <CardDescription className="text-[#b3b3b3]">
              Update your personal information and account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-[#b3b3b3] mb-2">
                Email Address
              </label>
              <div className="px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded-lg text-white">
                {user?.email || "Loading..."}
              </div>
              <p className="text-xs text-[#666666] mt-1">
                Email address cannot be changed
              </p>
            </div>

                         {/* Name (Editable) */}
             <div>
               <label className="block text-sm font-medium text-[#b3b3b3] mb-2">
                 Display Name
               </label>
               <input
                 type="text"
                 value={tempName}
                 onChange={(e) => setTempName(e.target.value)}
                 required
                 autoComplete="off"
                 data-1p-ignore
                 data-lpignore="true"
                 data-form-type="other"
                 className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded-lg text-white placeholder-[#666666] focus:outline-none focus:ring-2 focus:ring-blue-500"
                 placeholder="Enter your display name"
                                />
               </div>
               
               {/* Save Button */}
               <div className="flex space-x-3 pt-4">
                 <ThemeButton
                   icon={Save}
                   onClick={handleSave}
                   disabled={saving}
                 >
                   {saving ? 'Saving...' : 'Save Profile'}
                 </ThemeButton>
                 <CancelButton
                   onClick={handleCancel}
                   disabled={saving}
                 >
                   Cancel
                 </CancelButton>
               </div>
             </CardContent>
           </Card>


      </div>
    </div>
  );
}
