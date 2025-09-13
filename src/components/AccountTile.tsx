'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Download, TrendingUp, Building2, Trash2, Hash } from 'lucide-react';
import { Account } from '@/types/database';
import { CurrencyAmount } from '@/lib/currency-amount';

interface AccountTileProps {
  account: Account;
  transactionCount: number;
  accountValue: CurrencyAmount;
  onImport: (accountId: string) => void;
  onExport: () => void;
  onDeleteAll: (accountId: string) => void;
}

export default function AccountTile({ 
  account, 
  transactionCount, 
  accountValue, 
  onImport, 
  onExport,
  onDeleteAll
}: AccountTileProps) {
  const formatValue = (value: CurrencyAmount) => {
    if (value.amount === 0) return value.format();
    if (Math.abs(value.amount) >= 1000000) {
      const symbol = value.currencyInfo.symbol;
      return `${symbol}${(value.amount / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value.amount) >= 1000) {
      const symbol = value.currencyInfo.symbol;
      return `${symbol}${(value.amount / 1000).toFixed(1)}K`;
    }
    return value.format();
  };

  return (
    <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
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

          {/* Middle - Stats */}
          <div className="flex items-center gap-8">
            {/* Account Value */}
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-sm text-[#b3b3b3]">Value:</span>
              <span className={`text-lg font-semibold ${accountValue.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatValue(accountValue)}
              </span>
            </div>
            
            {/* Transaction Count */}
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-[#b3b3b3]">Transactions:</span>
              <span className="text-lg font-semibold text-white">
                {transactionCount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Right side - Action Buttons */}
          <div className="flex items-center gap-2">
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
