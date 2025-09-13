'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Download } from 'lucide-react';
import IBKRImporter from '@/components/IBKRImporter';
import AlertModal from '@/components/ui/alert-modal';
import { Transaction } from '@/types/database';

interface DataPageProps {
  selectedRange: unknown; // TimeRange type, but keeping it simple for now
}

export default function DataPage({ selectedRange: _selectedRange }: DataPageProps) {
  const { user } = useAuth();
  const { accounts, addTransaction } = usePortfolio();
  const [showIBKRImporter, setShowIBKRImporter] = useState(false);
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type
    });
  };

  const closeAlert = () => {
    setAlertModal(prev => ({ ...prev, isOpen: false }));
  };

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

  const handleIBKRImport = async (transactions: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[]) => {
    try {
      // Add each transaction to the database
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const transaction of transactions) {
        try {
          await addTransaction(transaction);
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push(`Failed to import transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      setShowIBKRImporter(false);
      
      // Show import results
      if (errorCount === 0) {
        showAlert('Import Successful', `Successfully imported ${successCount} transactions!`, 'success');
      } else {
        showAlert(
          'Import Completed with Errors', 
          `Imported ${successCount} transactions successfully, but ${errorCount} failed.\n\nErrors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more errors` : ''}`, 
          'warning'
        );
      }
    } catch (error) {
      console.error('Error importing IBKR transactions:', error);
      showAlert('Import Failed', `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleShowIBKRImporter = () => {
    if (accounts.length === 0) {
      showAlert('Account Required', 'Please create an account first before importing data. Go to Settings to add an account.', 'warning');
      return;
    }
    setShowIBKRImporter(true);
  };

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
                onClick={handleShowIBKRImporter}
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

      {/* IBKR Importer Modal */}
      {showIBKRImporter && (
        <IBKRImporter
          onImport={handleIBKRImport}
          onCancel={() => setShowIBKRImporter(false)}
          accountId={accounts[0]?.id || ''}
          userId={user.id}
        />
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={closeAlert}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
}
