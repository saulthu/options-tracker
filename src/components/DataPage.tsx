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
import SafeDeleteModal from '@/components/ui/safe-delete-modal';
import { Transaction } from '@/types/database';
import { RawTransaction } from '@/types/episodes';
import { isValidCurrencyCode } from '@/lib/currency-amount';
import { TimeRange } from '@/components/TimeRangeSelector';

interface DataPageProps {
  selectedRange: TimeRange;
}

/**
 * Convert database transaction to RawTransaction with CurrencyAmount
 */
function convertDatabaseTransactionToRaw(dbTxn: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Omit<RawTransaction, 'id' | 'created_at' | 'updated_at'> {
  // Validate currency code
  if (!isValidCurrencyCode(dbTxn.currency)) {
    throw new Error(`Invalid currency code in transaction: ${dbTxn.currency}`);
  }

  // Currency is already validated above

  // Price, fees, and strike are already CurrencyAmount instances
  const price = dbTxn.price;
  const fees = dbTxn.fees;
  const strike = dbTxn.strike;

  return {
    user_id: dbTxn.user_id,
    account_id: dbTxn.account_id,
    timestamp: dbTxn.timestamp,
    instrument_kind: dbTxn.instrument_kind,
    ticker_id: dbTxn.ticker_id,
    expiry: dbTxn.expiry,
    strike: strike,
    side: dbTxn.side,
    qty: dbTxn.qty,
    price,
    fees,
    currency: dbTxn.currency,
    memo: dbTxn.memo,
    tickers: dbTxn.tickers,
    accounts: dbTxn.accounts
  };
}

export default function DataPage({}: DataPageProps) {
  const { user } = useAuth();
  const { 
    accounts, 
    transactions, 
    getAccountValue, // Use all-time account values
    addTransactions,
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

  const [safeDeleteModal, setSafeDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    accountId: string | null;
    accountName: string;
    isLoading: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    accountId: null,
    accountName: '',
    isLoading: false
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

  // Calculate account data for tiles using all-time account values
  const accountData = useMemo(() => {
    return accounts.map(account => {
      const accountTransactions = transactions.filter(t => t.account_id === account.id);
      
      // Get all-time account values (not filtered by time range)
      const accountValues = getAccountValue(account.id);
      
      return {
        account,
        transactionCount: accountTransactions.length,
        balances: accountValues, // Use all-time account values
        pnl: new Map(), // P&L not relevant for this view
        accountValues: accountValues // Use all-time account values
      };
    });
  }, [accounts, transactions, getAccountValue]);


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
      console.log('Starting IBKR batch import with', transactions.length, 'transactions');
      console.log('First transaction sample:', transactions[0]);
      
      // Convert database transactions to RawTransaction format with CurrencyAmount
      const rawTransactions = transactions.map(convertDatabaseTransactionToRaw);
      
      // Batch insert all transactions at once
      const result = await addTransactions(rawTransactions);
      
      console.log('Batch import completed:', result);

      // Refresh the portfolio after successful batch import
      console.log('Refreshing portfolio after batch import...');
      await refreshPortfolio();
      console.log('Portfolio refreshed successfully');

      setShowIBKRImporter(false);
      setCurrentView('accounts');
      
      // Show import results
      if (result.errorCount === 0) {
        showAlert('Import Successful', `Successfully imported ${result.successCount} transactions!`, 'success');
      } else {
        showAlert(
          'Import Completed with Errors', 
          `Imported ${result.successCount} transactions successfully, but ${result.errorCount} failed.\n\nErrors:\n${result.errors.slice(0, 5).join('\n')}${result.errors.length > 5 ? `\n... and ${result.errors.length - 5} more errors` : ''}`, 
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

  const handleExport = () => {
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

  const handleDeleteAll = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    const transactionCount = transactions.filter(t => t.account_id === accountId).length;
    
    // Show safe delete modal
    setSafeDeleteModal({
      isOpen: true,
      title: 'Delete All Transactions',
      message: `Are you sure you want to delete ALL transactions for "${account.name}"?\n\nThis action cannot be undone and will permanently remove ${transactionCount} transactions.\n\nTo confirm deletion, you must type the account name exactly as shown below.`,
      accountId,
      accountName: account.name,
      isLoading: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!safeDeleteModal.accountId) return;

    const account = accounts.find(a => a.id === safeDeleteModal.accountId);
    if (!account) return;

    // Set loading state
    setSafeDeleteModal(prev => ({ ...prev, isLoading: true }));

    try {
      console.log(`Deleting all transactions for account: ${account.name} (${safeDeleteModal.accountId})`);
      await deleteAllTransactionsForAccount(safeDeleteModal.accountId);
      console.log('Transactions deleted, refreshing portfolio...');
      await refreshPortfolio();
      console.log('Portfolio refreshed successfully');
      
      // Close safe delete modal and show success alert
      setSafeDeleteModal({
        isOpen: false,
        title: '',
        message: '',
        accountId: null,
        accountName: '',
        isLoading: false
      });
      
      showAlert('Delete Successful', `All transactions for "${account.name}" have been deleted.`, 'success');
    } catch (error) {
      console.error('Error deleting transactions:', error);
      
      // Close safe delete modal and show error alert
      setSafeDeleteModal({
        isOpen: false,
        title: '',
        message: '',
        accountId: null,
        accountName: '',
        isLoading: false
      });
      
      showAlert('Delete Failed', `Failed to delete transactions: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleCancelDelete = () => {
    setSafeDeleteModal({
      isOpen: false,
      title: '',
      message: '',
      accountId: null,
      accountName: '',
      isLoading: false
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6">
      {/* Main Content Based on Current View */}
      {currentView === 'accounts' && (
        <>
          {/* Account Tiles */}
          {accountData.length > 0 ? (
            <div className="space-y-3">
              {accountData.map(({ account, transactionCount, accountValues, balances, pnl }) => (
                <AccountTile
                  key={account.id}
                  account={account}
                  transactionCount={transactionCount}
                  accountValues={accountValues}
                  balances={balances}
                  pnl={pnl}
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
      {currentView === 'importer' && showIBKRImporter && selectedAccountId && (() => {
        const selectedAccount = accounts.find(a => a.id === selectedAccountId);
        return selectedAccount ? (
          <IBKRImporter
            onImport={handleIBKRImport}
            onCancel={() => {
              setShowIBKRImporter(false);
              setCurrentView('import-type');
            }}
            accountId={selectedAccountId}
            accountName={selectedAccount.name}
            userId={user.id}
            ensureTickersExist={ensureTickersExist}
          />
        ) : null;
      })()}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={closeAlert}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

      {/* Safe Delete Modal */}
      <SafeDeleteModal
        isOpen={safeDeleteModal.isOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title={safeDeleteModal.title}
        message={safeDeleteModal.message}
        accountName={safeDeleteModal.accountName}
        confirmText="Delete All"
        cancelText="Cancel"
        type="danger"
        isLoading={safeDeleteModal.isLoading}
      />
    </div>
  );
}
