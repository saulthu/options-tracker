'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Download, TrendingUp, Building2 } from 'lucide-react';
import { Account } from '@/types/database';

interface AccountTileProps {
  account: Account;
  transactionCount: number;
  accountValue: number;
  onImport: (accountId: string) => void;
  onExport: (accountId: string) => void;
}

export default function AccountTile({ 
  account, 
  transactionCount, 
  accountValue, 
  onImport, 
  onExport 
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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-white text-lg">
          <Building2 className="h-5 w-5 text-blue-400" />
          {account.name}
        </CardTitle>
        <div className="text-sm text-[#b3b3b3]">
          {account.institution} • {account.type}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Account Value */}
        <div className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <span className="text-sm text-[#b3b3b3]">Current Value</span>
          </div>
          <div className={`text-lg font-semibold ${accountValue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatValue(accountValue)}
          </div>
        </div>

        {/* Transaction Count */}
        <div className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-[#b3b3b3]">Transactions</span>
          </div>
          <div className="text-lg font-semibold text-white">
            {transactionCount.toLocaleString()}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onImport(account.id)}
            className="flex items-center justify-center gap-2 p-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-colors group"
          >
            <Upload className="h-4 w-4 text-blue-400 group-hover:text-blue-300" />
            <span className="text-sm font-medium text-blue-400 group-hover:text-blue-300">
              Import
            </span>
          </button>
          
          <button
            onClick={() => onExport(account.id)}
            className="flex items-center justify-center gap-2 p-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 hover:border-green-500/50 rounded-lg transition-colors group"
          >
            <Download className="h-4 w-4 text-green-400 group-hover:text-green-300" />
            <span className="text-sm font-medium text-green-400 group-hover:text-green-300">
              Export
            </span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
