'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Select from '@/components/ui/select';
import { Building2, CreditCard } from 'lucide-react';
import { Account } from '@/types/database';

interface AccountSelectorProps {
  accounts: Account[];
  selectedAccountId: string | null;
  onAccountSelect: (accountId: string) => void;
  disabled?: boolean;
}

export default function AccountSelector({ 
  accounts, 
  selectedAccountId, 
  onAccountSelect, 
  disabled = false 
}: AccountSelectorProps) {
  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);

  return (
    <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Building2 className="h-5 w-5" />
          Select Target Account
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-[#b3b3b3] mb-3">
            Choose the account for importing or exporting data. All imported transactions will be linked to this account.
          </div>
          
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-[#666] mx-auto mb-4" />
              <div className="text-[#b3b3b3] mb-2">No accounts found</div>
              <div className="text-sm text-[#666]">Please create an account first in Settings</div>
            </div>
          ) : (
            <div className="space-y-3">
              <Select
                value={selectedAccountId || ''}
                onChange={onAccountSelect}
                options={accounts.map(account => ({
                  value: account.id,
                  label: `${account.name} (${account.institution})`,
                  description: `${account.type}`
                }))}
                placeholder="Select an account..."
                className={disabled ? 'opacity-50 cursor-not-allowed' : ''}
              />

              {selectedAccount && (
                <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium">{selectedAccount.name}</div>
                      <div className="text-sm text-[#b3b3b3]">
                        {selectedAccount.institution} • {selectedAccount.type}
                      </div>
                      {selectedAccount.description && (
                        <div className="text-sm text-[#666] mt-1">
                          {selectedAccount.description}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
