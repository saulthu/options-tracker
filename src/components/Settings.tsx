"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Save } from "lucide-react";


export default function Settings() {
  const { user } = useAuth();
  const { profile, updateProfile, loading: profileLoading } = useUserProfile();
  const [name, setName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState("");
  const [saving, setSaving] = useState(false);

  // Load profile data when component mounts or profile changes
  useEffect(() => {
    if (profile) {
      setName(profile.name);
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
      } else {
        setName(tempName.trim());
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setTempName(name);
    setIsEditing(false);
  };

  // Show loading state while profile is being fetched
  if (profileLoading) {
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
              {isEditing ? (
                <div className="space-y-3">
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
                  <div className="flex space-x-3">
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      disabled={saving}
                      className="border-[#404040] text-[#b3b3b3] hover:bg-[#2d2d2d] disabled:opacity-50"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded-lg text-white min-h-[40px] flex items-center">
                    {name || "No name set"}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="ml-3 border-[#404040] text-[#b3b3b3] hover:bg-[#2d2d2d]"
                  >
                    Edit
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account Settings */}
        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader>
            <CardTitle className="text-white">Account Settings</CardTitle>
            <CardDescription className="text-[#b3b3b3]">
              Manage your account security and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-[#b3b3b3] text-sm">
              More account settings will be available here in future updates.
            </p>
          </CardContent>
        </Card>


      </div>
    </div>
  );
}
