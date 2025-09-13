'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Download, TrendingUp, Building2, Trash2, Hash } from 'lucide-react';
import { Account } from '@/types/database';

interface AccountTileProps {
  account: Account;
  transactionCount: number;
  accountValue: number;
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
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatValue = (value: number) => {
    if (value === 0) return '$0.00';
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return formatCurrency(value);
  };

  return (
    <Card className="bg-[#1a1a1a] border-[#2d2d2d] hover:border-blue-400/50 transition-colors">
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
              <span className={`text-lg font-semibold ${accountValue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
              className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-colors group"
            >
              <Upload className="h-4 w-4 text-blue-400 group-hover:text-blue-300" />
              <span className="text-sm font-medium text-blue-400 group-hover:text-blue-300">
                Import
              </span>
            </button>
            
            <button
              onClick={() => onExport()}
              className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 hover:border-green-500/50 rounded-lg transition-colors group"
            >
              <Download className="h-4 w-4 text-green-400 group-hover:text-green-300" />
              <span className="text-sm font-medium text-green-400 group-hover:text-green-300">
                Export
              </span>
            </button>

            <button
              onClick={() => onDeleteAll(account.id)}
              className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500/50 rounded-lg transition-colors group"
            >
              <Trash2 className="h-4 w-4 text-red-400 group-hover:text-red-300" />
              <span className="text-sm font-medium text-red-400 group-hover:text-red-300">
                Delete All
              </span>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
