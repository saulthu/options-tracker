"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Save } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const [name, setName] = useState("codoo"); // Default name, could be loaded from user profile
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(name);

  const handleSave = () => {
    setName(tempName);
    setIsEditing(false);
    // TODO: Save to database
  };

  const handleCancel = () => {
    setTempName(name);
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-[#b3b3b3]">Manage your account preferences and profile information</p>
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
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      className="border-[#404040] text-[#b3b3b3] hover:bg-[#2d2d2d]"
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
