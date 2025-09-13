'use client';

import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

interface ImportTypeSelectorProps {
  accountName: string;
  onBack: () => void;
  onSelectIBKR: () => void;
  onSelectGeneric: () => void;
}

export default function ImportTypeSelector({ 
  accountName, 
  onBack, 
  onSelectIBKR, 
  onSelectGeneric 
}: ImportTypeSelectorProps) {
  // Handle Escape key to go back to accounts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onBack();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[#b3b3b3] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Accounts
        </button>
        <div className="h-6 w-px bg-[#2d2d2d]" />
        <div>
          <h2 className="text-2xl font-bold text-white">Import Data</h2>
          <p className="text-[#b3b3b3]">Choose import method for {accountName}</p>
        </div>
      </div>

      {/* Import Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Interactive Brokers Import */}
        <Card 
          className="bg-[#1a1a1a] border-[#2d2d2d] hover:border-blue-400/50 transition-colors cursor-pointer group"
          onClick={onSelectIBKR}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-white">
              <Image 
                src="/ibkr.svg" 
                alt="Interactive Brokers" 
                width={32}
                height={32}
              />
              Interactive Brokers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-[#b3b3b3] text-sm">
                Import from IBKR CSV activity statements. Supports trades, dividends, fees, and cash movements.
              </p>
              <div className="flex items-center gap-2 text-xs text-[#666]">
                <FileText className="h-3 w-3" />
                CSV Format
              </div>
              <div className="text-right">
                <div className="text-[#666] group-hover:text-blue-400 transition-colors">
                  →
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Generic CSV Import */}
        <Card 
          className="bg-[#1a1a1a] border-[#2d2d2d] hover:border-green-400/50 transition-colors cursor-pointer group"
          onClick={onSelectGeneric}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-white">
              <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                <Upload className="h-4 w-4 text-green-400" />
              </div>
              Generic CSV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-[#b3b3b3] text-sm">
                Import from any CSV format. You&apos;ll be able to map columns to our transaction format.
              </p>
              <div className="flex items-center gap-2 text-xs text-[#666]">
                <FileText className="h-3 w-3" />
                CSV Format
              </div>
              <div className="text-right">
                <div className="text-[#666] group-hover:text-green-400 transition-colors">
                  →
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
