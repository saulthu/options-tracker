'use client';

import React from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Download } from 'lucide-react';

interface DataPageProps {
  selectedRange: unknown; // TimeRange type, but keeping it simple for now
}

export default function DataPage({ selectedRange: _ }: DataPageProps) {
  const { user } = useAuth();

  if (!user) {
    return (
      <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
        <CardContent className="py-12">
          <div className="text-center">
            <div className="text-[#b3b3b3] text-lg mb-2">Please log in to access data management</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Data Management</h1>
        <p className="text-[#b3b3b3]">Import and export your trading data</p>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Import Card */}
        <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Upload className="h-5 w-5" />
              Import Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Interactive Brokers Import */}
              <div 
                className="flex items-center gap-3 p-4 bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg hover:border-blue-400/50 hover:bg-[#1a1a1a] transition-colors cursor-pointer group"
                onClick={() => {
                  // TODO: Implement Interactive Brokers import
                  console.log('Interactive Brokers import clicked');
                }}
              >
                <Image 
                  src="/ibkr.svg" 
                  alt="Interactive Brokers" 
                  width={32}
                  height={32}
                />
                <div className="flex-1">
                  <div className="text-white font-medium">Interactive Brokers</div>
                  <div className="text-sm text-[#b3b3b3]">Import from IBKR CSV file</div>
                </div>
                <div className="text-[#666] group-hover:text-blue-400 transition-colors">
                  →
                </div>
              </div>

              {/* Generic CSV Import */}
              <div 
                className="flex items-center gap-3 p-4 bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg hover:border-green-400/50 hover:bg-[#1a1a1a] transition-colors cursor-pointer group"
                onClick={() => {
                  // TODO: Implement generic CSV import
                  console.log('Generic CSV import clicked');
                }}
              >
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                  <Upload className="h-5 w-5 text-green-400" />
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium">Generic CSV</div>
                  <div className="text-sm text-[#b3b3b3]">Import from any CSV format</div>
                </div>
                <div className="text-[#666] group-hover:text-green-400 transition-colors">
                  →
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Export Card */}
        <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Download className="h-5 w-5" />
              Export Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Download className="h-16 w-16 text-[#666] mx-auto mb-4" />
              <div className="text-[#b3b3b3] mb-2">Export your trading data</div>
              <div className="text-sm text-[#666]">Coming soon</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
