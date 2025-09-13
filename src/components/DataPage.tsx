'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { Card, CardContent } from '@/components/ui/card';
import { Settings } from 'lucide-react';
import IBKRImporter from '@/components/IBKRImporter';
import AccountTile from '@/components/AccountTile';
import ImportTypeSelector from '@/components/ImportTypeSelector';
import AlertModal from '@/components/ui/alert-modal';
import { Transaction } from '@/types/database';

interface DataPageProps {
  selectedRange: unknown; // TimeRange type, but keeping it simple for now
}

export default function DataPage({}: DataPageProps) {
  const { user } = useAuth();
  const { 
    accounts, 
    transactions, 
    getBalance, 
    getTotalPnL, 
    addTransaction, 
    ensureTickersExist, 
    refreshPortfolio,
    deleteAllTransactionsForAccount
  } = usePortfolio();
  
  const [currentView, setCurrentView] = useState<'accounts' | 'import-type' | 'importer'>('accounts');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
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

  // Calculate account data for tiles
  const accountData = useMemo(() => {
    return accounts.map(account => {
      const accountTransactions = transactions.filter(t => t.account_id === account.id);
      const accountValue = getBalance(account.id) + getTotalPnL(account.id);
      
      return {
        account,
        transactionCount: accountTransactions.length,
        accountValue
      };
    });
  }, [accounts, transactions, getBalance, getTotalPnL]);


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
      console.log('Starting IBKR import with', transactions.length, 'transactions');
      console.log('First transaction sample:', transactions[0]);
      
      // Add each transaction to the database (without refreshing portfolio)
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const transaction of transactions) {
        try {
          console.log('Adding transaction:', transaction);
          await addTransaction(transaction);
          successCount++;
        } catch (error) {
          console.error('Transaction import error:', error);
          errorCount++;
          errors.push(`Failed to import transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Refresh the portfolio only once at the end of the bulk import
      console.log('Bulk import completed. Refreshing portfolio...');
      await refreshPortfolio();
      console.log('Portfolio refreshed successfully');

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

  const handleImport = (accountId: string) => {
    setSelectedAccountId(accountId);
    setCurrentView('import-type');
  };

  const handleExport = (_accountId: string) => {
    // TODO: Implement export functionality
    showAlert('Export Coming Soon', 'Export functionality will be available soon.', 'info');
  };

  const handleBackToAccounts = () => {
    setCurrentView('accounts');
    setSelectedAccountId(null);
  };

  const handleSelectIBKR = () => {
    setCurrentView('importer');
    setShowIBKRImporter(true);
  };

  const handleSelectGeneric = () => {
    showAlert('Generic Import Coming Soon', 'Generic CSV import functionality will be available soon.', 'info');
  };

  const handleDeleteAll = async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete ALL transactions for "${account.name}"?\n\nThis action cannot be undone and will permanently remove ${transactions.filter(t => t.account_id === accountId).length} transactions.`
    );

    if (!confirmed) return;

    try {
      await deleteAllTransactionsForAccount(accountId);
      await refreshPortfolio();
      showAlert('Delete Successful', `All transactions for "${account.name}" have been deleted.`, 'success');
    } catch (error) {
      console.error('Error deleting transactions:', error);
      showAlert('Delete Failed', `Failed to delete transactions: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Data Management</h1>
        <p className="text-[#b3b3b3]">Import and export your trading data</p>
      </div>


      {/* Main Content Based on Current View */}
      {currentView === 'accounts' && (
        <>
          {/* Account Tiles */}
          {accountData.length > 0 ? (
            <div className="space-y-3">
              {accountData.map(({ account, transactionCount, accountValue }) => (
                <AccountTile
                  key={account.id}
                  account={account}
                  transactionCount={transactionCount}
                  accountValue={accountValue}
                  onImport={handleImport}
                  onExport={handleExport}
                  onDeleteAll={handleDeleteAll}
                />
              ))}
            </div>
          ) : (
            <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
              <CardContent className="py-12">
                <div className="text-center">
                  <div className="text-[#b3b3b3] text-lg mb-4">No accounts found</div>
                  <div className="text-sm text-[#666] mb-6">
                    Create your first trading account to start importing data
                  </div>
                  <button
                    onClick={() => {
                      // Navigate to settings - this would typically be handled by the parent component
                      showAlert('Go to Settings', 'Please go to Settings to create your first account.', 'info');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-colors mx-auto"
                  >
                    <Settings className="h-4 w-4" />
                    Go to Settings
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Import Type Selection */}
      {currentView === 'import-type' && selectedAccountId && (
        <ImportTypeSelector
          accountName={accounts.find(a => a.id === selectedAccountId)?.name || 'Unknown Account'}
          onBack={handleBackToAccounts}
          onSelectIBKR={handleSelectIBKR}
          onSelectGeneric={handleSelectGeneric}
        />
      )}

      {/* IBKR Importer Modal */}
      {currentView === 'importer' && showIBKRImporter && selectedAccountId && (
        <IBKRImporter
          onImport={handleIBKRImport}
          onCancel={() => {
            setShowIBKRImporter(false);
            setCurrentView('import-type');
          }}
          accountId={selectedAccountId}
          userId={user.id}
          ensureTickersExist={ensureTickersExist}
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
