"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { type Account, type AccountFormData } from "@/types/database";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeButton, CancelButton, DestructiveButton } from "@/components/ui/theme-button";
import { User, Save, Plus, Building2, Edit } from "lucide-react";
import AccountForm from "./AccountForm";


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
  const { 
    accounts, 
    loading: accountsLoading, 
    createAccount, 
    updateAccount, 
    deleteAccount
  } = usePortfolio();
  const [tempName, setTempName] = useState("");
  const [saving, setSaving] = useState(false);
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);

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

  // Account handlers
  const handleAddAccount = () => {
    setEditingAccount(null);
    setIsAccountFormOpen(true);
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setIsAccountFormOpen(true);
  };

  const handleAccountSubmit = async (accountData: AccountFormData) => {
    setAccountLoading(true);
    try {
      let result;
      
      if (editingAccount) {
        // Update existing account
        result = await updateAccount(editingAccount.id, accountData);
      } else {
        // Create new account
        result = await createAccount(accountData);
      }
      
      if (result.error) {
        console.error('Error saving account:', result.error);
        // You could add a toast notification here
        return;
      }
      
      // PortfolioContext automatically updates local state, no need to refresh
      
      setIsAccountFormOpen(false);
      setEditingAccount(null);
    } catch (error) {
      console.error('Error saving account:', error);
    } finally {
      setAccountLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      const result = await deleteAccount(accountId);
      if (result.error) {
        console.error('Error deleting account:', result.error);
        // You could add a toast notification here
      } else {
        // PortfolioContext automatically updates local state, no need to refresh
      }
    }
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
                             <ThemeButton
                 icon={Plus}
                 onClick={handleAddAccount}
               >
                 Add Account
               </ThemeButton>
            </div>
          </CardHeader>
          <CardContent>
            {accountsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-[#b3b3b3]">Loading accounts...</p>
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="w-12 h-12 text-[#666666] mx-auto mb-4" />
                <p className="text-[#b3b3b3] text-lg mb-2">No trading accounts yet</p>
                <p className="text-[#666666]">Get started by adding your first trading account</p>
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
                      <ThemeButton
                        icon={Edit}
                        size="sm"
                        onClick={() => handleEditAccount(account)}
                      >
                        Edit
                      </ThemeButton>
                                             <DestructiveButton
                         size="sm"
                         onClick={() => handleDeleteAccount(account.id)}
                       >
                         Delete
                       </DestructiveButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
          existingAccounts={accounts}
        />

      </div>
    </div>
  );
}
