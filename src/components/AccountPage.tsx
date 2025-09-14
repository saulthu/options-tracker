'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Building2, Edit, Download, Upload, Trash2 } from 'lucide-react';
import { ThemeButton } from '@/components/ui/theme-button';
import IBKRImporter from '@/components/IBKRImporter';
import AccountForm from '@/components/AccountForm';
import ImportTypeSelector from '@/components/ImportTypeSelector';
import AlertModal from '@/components/ui/alert-modal';
import SafeDeleteModal from '@/components/ui/safe-delete-modal';
import { Transaction, Account, AccountFormData } from '@/types/database';
import { RawTransaction } from '@/types/episodes';
import { isValidCurrencyCode } from '@/lib/currency-amount';
import { TimeRange } from '@/components/TimeRangeSelector';

interface AccountPageProps {
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

export default function AccountPage({}: AccountPageProps) {
  const { user } = useAuth();
  const { 
    accounts, 
    transactions, 
    getAccountValue, // Use all-time account values
    addTransactions,
    ensureTickersExist, 
    refreshPortfolio,
    deleteAllTransactionsForAccount,
    createAccount,
    updateAccount,
    deleteAccount
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

  // Account form state
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);

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
            <div className="text-[#b3b3b3] text-lg mb-2">Please log in to access your accounts</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleIBKRImport = async (transactions: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[]) => {
    try {
      // console.log('Starting IBKR batch import with', transactions.length, 'transactions');
      // console.log('First transaction sample:', transactions[0]);
      
      // Convert database transactions to RawTransaction format with CurrencyAmount
      const rawTransactions = transactions.map(convertDatabaseTransactionToRaw);
      
      // Batch insert all transactions at once
      const result = await addTransactions(rawTransactions);
      
      // console.log('Batch import completed:', result);

      // Refresh the portfolio after successful batch import
      // console.log('Refreshing portfolio after batch import...');
      await refreshPortfolio();
      // console.log('Portfolio refreshed successfully');

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
    
    if (transactionCount === 0) {
      // No transactions, delete the account itself
      setSafeDeleteModal({
        isOpen: true,
        title: 'Delete Account',
        message: `Are you sure you want to delete the account "${account.name}"?\n\nThis account has no transactions and will be permanently removed.\n\nTo confirm deletion, you must type the account name exactly as shown below.`,
        accountId,
        accountName: account.name,
        isLoading: false
      });
    } else {
      // Has transactions, delete all transactions
      setSafeDeleteModal({
        isOpen: true,
        title: 'Delete All Transactions',
        message: `Are you sure you want to delete ALL transactions for "${account.name}"?\n\nThis action cannot be undone and will permanently remove ${transactionCount} transactions.\n\nTo confirm deletion, you must type the account name exactly as shown below.`,
        accountId,
        accountName: account.name,
        isLoading: false
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!safeDeleteModal.accountId) return;

    const account = accounts.find(a => a.id === safeDeleteModal.accountId);
    if (!account) return;

    // Set loading state
    setSafeDeleteModal(prev => ({ ...prev, isLoading: true }));

    const transactionCount = transactions.filter(t => t.account_id === safeDeleteModal.accountId).length;

    try {
      if (transactionCount === 0) {
        // Delete the account itself
        // console.log(`Deleting account: ${account.name} (${safeDeleteModal.accountId})`);
        const result = await deleteAccount(safeDeleteModal.accountId);
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        // console.log('Account deleted successfully');
        
        // Close safe delete modal and show success alert
        setSafeDeleteModal({
          isOpen: false,
          title: '',
          message: '',
          accountId: null,
          accountName: '',
          isLoading: false
        });
        
        showAlert('Delete Successful', `Account "${account.name}" has been deleted.`, 'success');
      } else {
        // Delete all transactions
        // console.log(`Deleting all transactions for account: ${account.name} (${safeDeleteModal.accountId})`);
        await deleteAllTransactionsForAccount(safeDeleteModal.accountId);
        // console.log('Transactions deleted, refreshing portfolio...');
        await refreshPortfolio();
        // console.log('Portfolio refreshed successfully');
        
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
      }
    } catch (error) {
      console.error('Error during deletion:', error);
      
      // Close safe delete modal and show error alert
      setSafeDeleteModal({
        isOpen: false,
        title: '',
        message: '',
        accountId: null,
        accountName: '',
        isLoading: false
      });
      
      const errorMessage = transactionCount === 0 
        ? `Failed to delete account: ${error instanceof Error ? error.message : 'Unknown error'}`
        : `Failed to delete transactions: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      showAlert('Delete Failed', errorMessage, 'error');
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

  // Account management handlers
  const handleAddAccount = () => {
    setEditingAccount(null);
    setIsAccountFormOpen(true);
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setIsAccountFormOpen(true);
  };

  const handleAccountSubmit = async (accountData: AccountFormData) => {
    setAccountLoading(true);
    try {
      let result;
      
      if (editingAccount) {
        // Update existing account
        result = await updateAccount(editingAccount.id, accountData);
      } else {
        // Create new account
        result = await createAccount(accountData);
      }
      
      if (result.error) {
        showAlert('Error', `Failed to save account: ${result.error}`, 'error');
        return;
      }
      
      setIsAccountFormOpen(false);
      setEditingAccount(null);
      showAlert('Success', editingAccount ? 'Account updated successfully' : 'Account created successfully', 'success');
    } catch (error) {
      showAlert('Error', `Failed to save account: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setAccountLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6">
      {/* Main Content Based on Current View */}
      {currentView === 'accounts' && (
        <>
          {/* Add Account Button */}
          <div className="flex justify-end items-center">
            <ThemeButton
              icon={Plus}
              onClick={handleAddAccount}
            >
              Add Account
            </ThemeButton>
          </div>

          {/* Account List - Table Style */}
          {accountData.length > 0 ? (
            <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
              <CardContent className="p-0">
                {accountData.map(({ account, transactionCount, accountValues }, index) => {
                  const isFirst = index === 0;
                  const isLast = index === accountData.length - 1;
                  return (
                  <div key={account.id} className={`grid grid-cols-[300px_1fr_auto] gap-x-4 ${index > 0 ? 'border-t border-[#2d2d2d]' : ''}`}>
                    {/* Account Info Column */}
                    <div className={`flex items-center gap-3 px-4 ${isFirst ? 'pt-2 pb-4' : isLast ? 'pt-4 pb-2' : 'py-4'}`}>
                      <Building2 className="h-5 w-5 text-blue-400" />
                      <div>
                        <h3 className="text-lg font-semibold text-white">{account.name}</h3>
                        <div className="text-sm text-[#b3b3b3]">
                          {account.institution} • {account.type}
                        </div>
                      </div>
                    </div>

                    {/* Stats Column */}
                    <div className={`flex flex-col gap-1 justify-center px-4 ${isFirst ? 'pt-2 pb-4' : isLast ? 'pt-4 pb-2' : 'py-4'}`}>
                      <div className="flex items-center">
                        <span className="text-sm text-[#b3b3b3]">Transactions:</span>
                        <span className="text-lg font-semibold text-white ml-2">
                          {transactionCount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {Array.from(accountValues.entries()).map(([currency, amount]) => (
                          <div key={currency} className="flex items-center">
                            <span className="text-sm text-[#b3b3b3]">{currency}:</span>
                            <span className="text-lg font-semibold text-white ml-2">
                              {amount.format()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions Column */}
                    <div className={`flex items-center gap-2 px-4 ${isFirst ? 'pt-2 pb-4' : isLast ? 'pt-4 pb-2' : 'py-4'}`}>
                      <button
                        onClick={() => handleEditAccount(account)}
                        className="flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#4d4d4d] hover:border-[#5d5d5d] rounded-lg transition-colors group"
                      >
                        <Edit className="h-4 w-4 text-[#b3b3b3] group-hover:text-white" />
                        <span className="text-sm font-medium text-[#b3b3b3] group-hover:text-white">Edit</span>
                      </button>
                      <button
                        onClick={() => handleImport(account.id)}
                        className="flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#4d4d4d] hover:border-[#5d5d5d] rounded-lg transition-colors group"
                      >
                        <Download className="h-4 w-4 text-[#b3b3b3] group-hover:text-white" />
                        <span className="text-sm font-medium text-[#b3b3b3] group-hover:text-white">Import</span>
                      </button>
                      <button
                        onClick={() => handleExport()}
                        className="flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#4d4d4d] hover:border-[#5d5d5d] rounded-lg transition-colors group"
                      >
                        <Upload className="h-4 w-4 text-[#b3b3b3] group-hover:text-white" />
                        <span className="text-sm font-medium text-[#b3b3b3] group-hover:text-white">Export</span>
                      </button>
                      <button
                        onClick={() => handleDeleteAll(account.id)}
                        className="flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#4d4d4d] hover:border-[#5d5d5d] rounded-lg transition-colors group"
                      >
                        <Trash2 className="h-4 w-4 text-[#b3b3b3] group-hover:text-white" />
                        <span className="text-sm font-medium text-[#b3b3b3] group-hover:text-white">Delete All</span>
                      </button>
                    </div>
                  </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-[#1a1a1a] border-[#2d2d2d]">
              <CardContent className="py-12">
                <div className="text-center">
                  <div className="text-[#b3b3b3] text-lg mb-4">No accounts found</div>
                  <div className="text-sm text-[#666] mb-6">
                    Create your first trading account to start importing data
                  </div>
                  <ThemeButton
                    icon={Plus}
                    onClick={handleAddAccount}
                  >
                    Create Your First Account
                  </ThemeButton>
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

      {/* Account Form Modal */}
      <AccountForm
        isOpen={isAccountFormOpen}
        onClose={() => {
          setIsAccountFormOpen(false);
          setEditingAccount(null);
        }}
        onSubmit={handleAccountSubmit}
        account={editingAccount}
        loading={accountLoading}
        existingAccounts={accounts}
      />
    </div>
  );
}
