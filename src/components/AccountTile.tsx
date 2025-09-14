'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Download, TrendingUp, Building2, Trash2, Hash, Edit } from 'lucide-react';
import { Account } from '@/types/database';
import { CurrencyAmount, CurrencyCode } from '@/lib/currency-amount';
import { MultiCurrencyBalanceInline } from '@/components/MultiCurrencyBalance';

interface AccountTileProps {
  account: Account;
  transactionCount: number;
  accountValues: Map<CurrencyCode, CurrencyAmount>;
  balances?: Map<CurrencyCode, CurrencyAmount>;
  pnl?: Map<CurrencyCode, CurrencyAmount>;
  onImport: (accountId: string) => void;
  onExport: () => void;
  onDeleteAll: (accountId: string) => void;
  onEdit: (account: Account) => void;
}

export default function AccountTile({ 
  account, 
  transactionCount, 
  accountValues,
  onImport, 
  onExport,
  onDeleteAll,
  onEdit
}: AccountTileProps) {

  return (
    <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
      <CardContent className="p-4">
        <div className="grid grid-cols-[auto_24px_1fr_auto] gap-4 items-center">
          {/* Left side - Account Info */}
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-blue-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">{account.name}</h3>
              <div className="text-sm text-[#b3b3b3]">
                {account.institution} • {account.type}
              </div>
            </div>
          </div>

          {/* Icon Column - Fixed Width */}
          <div className="flex flex-col gap-2 items-center">
            <Hash className="h-4 w-4 text-blue-400" />
            <TrendingUp className="h-4 w-4 text-green-400" />
          </div>

          {/* Middle - Stats */}
          <div className="flex flex-col gap-2">
            {/* Transaction Count */}
            <div className="flex items-center">
              <span className="text-sm text-[#b3b3b3]">Transactions:</span>
              <span className="text-lg font-semibold text-white ml-2">
                {transactionCount.toLocaleString()}
              </span>
            </div>
            
            {/* Account Value */}
            <div className="flex items-center">
              <span className="text-sm text-[#b3b3b3]">Value:</span>
              <MultiCurrencyBalanceInline 
                balances={accountValues} 
                className="text-lg font-semibold ml-2"
              />
            </div>
          </div>

          {/* Right side - Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(account)}
              className="flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#4d4d4d] hover:border-[#5d5d5d] rounded-lg transition-colors group"
            >
              <Edit className="h-4 w-4 text-[#b3b3b3] group-hover:text-white" />
              <span className="text-sm font-medium text-[#b3b3b3] group-hover:text-white">
                Edit
              </span>
            </button>
            
            <button
              onClick={() => onImport(account.id)}
              className="flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#4d4d4d] hover:border-[#5d5d5d] rounded-lg transition-colors group"
            >
              <Download className="h-4 w-4 text-[#b3b3b3] group-hover:text-white" />
              <span className="text-sm font-medium text-[#b3b3b3] group-hover:text-white">
                Import
              </span>
            </button>
            
            <button
              onClick={() => onExport()}
              className="flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#4d4d4d] hover:border-[#5d5d5d] rounded-lg transition-colors group"
            >
              <Upload className="h-4 w-4 text-[#b3b3b3] group-hover:text-white" />
              <span className="text-sm font-medium text-[#b3b3b3] group-hover:text-white">
                Export
              </span>
            </button>

            <button
              onClick={() => onDeleteAll(account.id)}
              className="flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#4d4d4d] hover:border-[#5d5d5d] rounded-lg transition-colors group"
            >
              <Trash2 className="h-4 w-4 text-[#b3b3b3] group-hover:text-white" />
              <span className="text-sm font-medium text-[#b3b3b3] group-hover:text-white">
                Delete All
              </span>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
