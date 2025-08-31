"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Save, Plus, Building2, CreditCard } from "lucide-react";
import AccountForm from "./AccountForm";


export default function Settings() {
  const { user } = useAuth();
  const { profile, updateProfile, loading: profileLoading } = useUserProfile();
  const [name, setName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Define Account type
  type Account = {
    id: string;
    name: string;
    type: 'Individual' | 'IRA' | '401k' | 'Roth IRA' | 'Traditional IRA' | 'Other';
    institution: string;
    account_number?: string;
    description?: string;
  };

  // Accounts state
  const [accounts, setAccounts] = useState<Account[]>([
    {
      id: "1",
      name: "Main Trading Account",
      type: "Individual",
      institution: "Fidelity",
      account_number: "****1234",
      description: "Primary account for options trading"
    },
    {
      id: "2",
      name: "Retirement IRA",
      type: "Traditional IRA",
      institution: "Vanguard",
      account_number: "****5678",
      description: "Long-term retirement investments"
    }
  ]);
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);

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

  // Account handlers
  const handleAddAccount = () => {
    setEditingAccount(null);
    setIsAccountFormOpen(true);
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setIsAccountFormOpen(true);
  };

  const handleAccountSubmit = async (accountData: Omit<Account, 'id'>) => {
    setAccountLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (editingAccount) {
        // Update existing account
        setAccounts(prev => prev.map(acc => 
          acc.id === editingAccount.id ? { ...accountData, id: acc.id } : acc
        ));
      } else {
        // Add new account
        const newAccount = {
          ...accountData,
          id: Date.now().toString()
        };
        setAccounts(prev => [...prev, newAccount]);
      }
      
      setIsAccountFormOpen(false);
      setEditingAccount(null);
    } catch (error) {
      console.error('Error saving account:', error);
    } finally {
      setAccountLoading(false);
    }
  };

  const handleDeleteAccount = (accountId: string) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      setAccounts(prev => prev.filter(acc => acc.id !== accountId));
    }
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

        {/* Trading Accounts */}
        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center">
                  <Building2 className="w-5 h-5 mr-2" />
                  Trading Accounts
                </CardTitle>
                <CardDescription className="text-[#b3b3b3]">
                  Manage your trading accounts and institutions
                </CardDescription>
              </div>
              <Button
                onClick={handleAddAccount}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Account
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-[#666666] mx-auto mb-4" />
                <p className="text-[#b3b3b3] mb-2">No trading accounts yet</p>
                <p className="text-[#666666] text-sm">Add your first trading account to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 bg-[#2d2d2d] rounded-lg border border-[#404040]"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-medium text-white">{account.name}</h3>
                        <span className="px-2 py-1 bg-[#404040] text-[#b3b3b3] text-xs rounded">
                          {account.type}
                        </span>
                      </div>
                      <div className="text-sm text-[#b3b3b3] space-y-1">
                        <p><span className="text-[#666666]">Institution:</span> {account.institution}</p>
                        {account.account_number && (
                          <p><span className="text-[#666666]">Account:</span> {account.account_number}</p>
                        )}
                        {account.description && (
                          <p><span className="text-[#666666]">Description:</span> {account.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditAccount(account)}
                        className="border-[#404040] text-[#b3b3b3] hover:bg-[#2d2d2d]"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteAccount(account.id)}
                        className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

        {/* Account Form Modal */}
        <AccountForm
          isOpen={isAccountFormOpen}
          onClose={() => {
            setIsAccountFormOpen(false);
            setEditingAccount(null);
          }}
          onSubmit={handleAccountSubmit}
          account={editingAccount}
          loading={accountLoading}
        />

      </div>
    </div>
  );
}
