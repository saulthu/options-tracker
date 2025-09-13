'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeButton, CancelButton } from '@/components/ui/theme-button';
import { Upload, FileText, CheckCircle, AlertCircle, X, Eye, EyeOff } from 'lucide-react';
import { 
  IBKRCSVParser, 
  extractTickerNamesFromIBKRData,
  convertIBKRTradesToTransactions, 
  convertIBKRCashToTransactions,
  convertIBKRFeesToTransactions,
  convertIBKRInterestToTransactions,
  convertIBKRDividendsToTransactions,
  convertIBKRWithholdingTaxToTransactions,
  convertIBKRCorporateActionsToTransactions
} from '@/lib/ibkr-csv-parser';
import { Transaction } from '@/types/database';

// Validation function for transactions
function validateTransactions(transactions: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[]): string[] {
  const errors: string[] = [];
  
  transactions.forEach((transaction, index) => {
    // Check required fields
    if (!transaction.user_id) {
      errors.push(`Transaction ${index + 1}: Missing user_id`);
    }
    if (!transaction.account_id) {
      errors.push(`Transaction ${index + 1}: Missing account_id`);
    }
    if (!transaction.timestamp) {
      errors.push(`Transaction ${index + 1}: Missing timestamp`);
    }
    if (!transaction.instrument_kind) {
      errors.push(`Transaction ${index + 1}: Missing instrument_kind`);
    }
    if (transaction.qty === undefined || transaction.qty === null) {
      errors.push(`Transaction ${index + 1}: Missing quantity`);
    }
    if (transaction.fees === undefined || transaction.fees === null) {
      errors.push(`Transaction ${index + 1}: Missing fees`);
    }

    // Validate timestamp format
    if (transaction.timestamp) {
      const date = new Date(transaction.timestamp);
      if (isNaN(date.getTime())) {
        errors.push(`Transaction ${index + 1}: Invalid timestamp format`);
      }
    }

    // Validate instrument kind
    const validInstrumentKinds = ['CASH', 'SHARES', 'CALL', 'PUT'];
    if (transaction.instrument_kind && !validInstrumentKinds.includes(transaction.instrument_kind)) {
      errors.push(`Transaction ${index + 1}: Invalid instrument_kind: ${transaction.instrument_kind}`);
    }

    // Validate side for non-CASH instruments
    if (transaction.instrument_kind !== 'CASH' && !transaction.side) {
      errors.push(`Transaction ${index + 1}: Missing side for ${transaction.instrument_kind} transaction`);
    }

    // Validate options-specific fields
    if (transaction.instrument_kind === 'CALL' || transaction.instrument_kind === 'PUT') {
      // Note: ticker_id is optional and will be implemented later
      if (!transaction.expiry) {
        errors.push(`Transaction ${index + 1}: Missing expiry for options transaction`);
      }
      if (!transaction.strike) {
        errors.push(`Transaction ${index + 1}: Missing strike for options transaction`);
      }
    }
  });

  return errors;
}

interface IBKRImporterProps {
  onImport: (transactions: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[]) => void;
  onCancel: () => void;
  accountId: string;
  accountName: string;
  userId: string;
  ensureTickersExist: (tickerNames: string[]) => Promise<{ [tickerName: string]: string }>;
}

interface ImportPreview {
  trades: Array<{
    dataDiscriminator: string;
    assetCategory: string;
    currency: string;
    symbol: string;
    dateTime: string;
    quantity: number;
    tPrice: number;
    cPrice: number;
    proceeds: number;
    commFee: number;
    basis: number;
    realizedPL: number;
    mtmPL: number;
    code: string;
  }>;
  cashTransactions: Array<{
    currency: string;
    settleDate: string;
    description: string;
    amount: number;
  }>;
  fees: Array<{
    subtitle: string;
    currency: string;
    date: string;
    description: string;
    amount: number;
  }>;
  interest: Array<{
    currency: string;
    date: string;
    description: string;
    amount: number;
  }>;
  dividends: Array<{
    currency: string;
    date: string;
    description: string;
    amount: number;
    symbol?: string;
  }>;
  withholdingTax: Array<{
    currency: string;
    date: string;
    description: string;
    amount: number;
    symbol?: string;
  }>;
  corporateActions: Array<{
    currency: string;
    date: string;
    description: string;
    amount: number;
    symbol?: string;
  }>;
  metadata: {
    accountId: string;
    statementPeriod: string;
    baseCurrency: string;
    timezone: string;
    whenGenerated: string;
    brokerName: string;
    title: string;
  };
  totalTransactions: number;
  tickerIdMap: { [tickerName: string]: string };
}

export default function IBKRImporter({ onImport, onCancel, accountId, accountName, userId, ensureTickersExist }: IBKRImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, message: '' });
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const processFile = useCallback(async (fileToProcess?: File) => {
    const fileToUse = fileToProcess || file;
    if (!fileToUse) return;

    setIsProcessing(true);
    setError(null);

    try {
      const content = await fileToUse.text();
      const parser = new IBKRCSVParser(content);
      const result = parser.parse();

      // Extract all unique ticker names from the IBKR data
      const tickerNames = extractTickerNamesFromIBKRData(
        result.trades,
        result.cashTransactions,
        result.fees,
        result.interest,
        result.dividends,
        result.withholdingTax,
        result.corporateActions
      );

      console.log('Extracted ticker names:', tickerNames);

      // Ensure all tickers exist in the database
      const tickerIdMap = await ensureTickersExist(tickerNames);
      console.log('Ticker ID mapping:', tickerIdMap);

      // Convert to our transaction format with ticker IDs
      const tradeTransactions = convertIBKRTradesToTransactions(
        result.trades,
        accountId,
        userId,
        result.metadata.timezone,
        tickerIdMap
      );

      const cashTransactions = convertIBKRCashToTransactions(
        result.cashTransactions,
        accountId,
        userId
      );

      const feeTransactions = convertIBKRFeesToTransactions(
        result.fees,
        accountId,
        userId
      );

      const interestTransactions = convertIBKRInterestToTransactions(
        result.interest,
        accountId,
        userId
      );

      const dividendTransactions = convertIBKRDividendsToTransactions(
        result.dividends,
        accountId,
        userId,
        tickerIdMap
      );

      const withholdingTaxTransactions = convertIBKRWithholdingTaxToTransactions(
        result.withholdingTax,
        accountId,
        userId,
        tickerIdMap
      );

      const corporateActionTransactions = convertIBKRCorporateActionsToTransactions(
        result.corporateActions,
        accountId,
        userId,
        tickerIdMap
      );

      const allTransactions = [
        ...tradeTransactions, 
        ...cashTransactions, 
        ...feeTransactions, 
        ...interestTransactions,
        ...dividendTransactions,
        ...withholdingTaxTransactions,
        ...corporateActionTransactions
      ];

      setPreview({
        trades: result.trades.filter(trade => !trade.assetCategory?.toLowerCase().includes('forex')),
        cashTransactions: result.cashTransactions,
        fees: result.fees,
        interest: result.interest,
        dividends: result.dividends,
        withholdingTax: result.withholdingTax,
        corporateActions: result.corporateActions,
        metadata: result.metadata,
        totalTransactions: allTransactions.length,
        tickerIdMap
      });

    } catch (err) {
      console.error('Error processing IBKR CSV:', err);
      setError('Failed to parse IBKR CSV file. Please check the file format and try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [file, accountId, userId, ensureTickersExist]);

  const validateAndSetFile = useCallback(async (selectedFile: File) => {
    if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
      setError('Please select a valid CSV file');
      return;
    }
    setFile(selectedFile);
    setError(null);
    setPreview(null);
    
    // Automatically process the file after validation
    // Pass the file directly to avoid state timing issues
    processFile(selectedFile);
  }, [processFile]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  }, [validateAndSetFile]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      const droppedFile = files[0];
      validateAndSetFile(droppedFile);
    }
  }, [validateAndSetFile]);

  const handleImport = useCallback(async () => {
    if (!preview) return;

    try {
      setIsImporting(true);
      setError(null);

      // Step 1: Convert transactions
      setImportProgress({ current: 1, total: 4, message: 'Converting transactions...' });
      const tradeTransactions = convertIBKRTradesToTransactions(
        preview.trades,
        accountId,
        userId,
        preview.metadata.timezone,
        preview.tickerIdMap
      );

      const cashTransactions = convertIBKRCashToTransactions(
        preview.cashTransactions,
        accountId,
        userId
      );

      const feeTransactions = convertIBKRFeesToTransactions(
        preview.fees,
        accountId,
        userId
      );

      const interestTransactions = convertIBKRInterestToTransactions(
        preview.interest,
        accountId,
        userId
      );

      const dividendTransactions = convertIBKRDividendsToTransactions(
        preview.dividends,
        accountId,
        userId,
        preview.tickerIdMap
      );

      const withholdingTaxTransactions = convertIBKRWithholdingTaxToTransactions(
        preview.withholdingTax,
        accountId,
        userId,
        preview.tickerIdMap
      );

      const corporateActionTransactions = convertIBKRCorporateActionsToTransactions(
        preview.corporateActions,
        accountId,
        userId,
        preview.tickerIdMap
      );

      const allTransactions = [
        ...tradeTransactions, 
        ...cashTransactions, 
        ...feeTransactions, 
        ...interestTransactions,
        ...dividendTransactions,
        ...withholdingTaxTransactions,
        ...corporateActionTransactions
      ];

      // Step 2: Validate transactions
      setImportProgress({ current: 2, total: 4, message: 'Validating transactions...' });
      const validationErrors = validateTransactions(allTransactions);
      if (validationErrors.length > 0) {
        setError(`Validation errors found:\n${validationErrors.join('\n')}`);
        return;
      }

      // Step 3: Import transactions
      setImportProgress({ current: 3, total: 4, message: 'Importing transactions to database...' });
      await onImport(allTransactions);

      // Step 4: Complete
      setImportProgress({ current: 4, total: 4, message: 'Import completed successfully!' });
      
      // Small delay to show completion message
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (err) {
      console.error('Error during import:', err);
      setError(err instanceof Error ? err.message : 'Failed to import transactions');
    } finally {
      setIsImporting(false);
    }
  }, [preview, accountId, userId, onImport]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const handleBackdropClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    // Don't allow closing during import
    if (isImporting) return;
    
    // Only close if clicking on the backdrop itself, not on the card
    if (event.target === event.currentTarget) {
      onCancel();
    }
  }, [onCancel, isImporting]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isImporting) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, isImporting]);

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <Card 
        className="bg-[#1a1a1a] border-[#2d2d2d] w-full max-w-6xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Import IBKR CSV
            </CardTitle>
            <p className="text-sm text-[#b3b3b3] mt-1">
              Importing into: <span className="text-blue-400 font-medium">{accountName}</span>
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-[#666] hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <CardContent className="space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* File Upload */}
          <div className="space-y-4">
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
                isDragOver 
                  ? 'border-blue-400 bg-blue-400/5' 
                  : 'border-[#2d2d2d] hover:border-blue-400/50'
              }`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="ibkr-file-input"
              />
              <label
                htmlFor="ibkr-file-input"
                className="cursor-pointer flex flex-col items-center gap-4"
              >
                <Upload className={`h-12 w-12 transition-colors ${
                  isDragOver ? 'text-blue-400' : 'text-[#666]'
                }`} />
                <div>
                  <div className={`font-medium transition-colors ${
                    isDragOver ? 'text-blue-400' : 'text-white'
                  }`}>
                    {file ? file.name : (isDragOver ? 'Drop CSV file here' : 'Select or drag IBKR CSV file')}
                  </div>
                  <div className="text-sm text-[#b3b3b3]">
                    {isDragOver 
                      ? 'Release to upload your Interactive Brokers activity statement'
                      : 'Choose your Interactive Brokers activity statement CSV file'
                    }
                  </div>
                </div>
              </label>
            </div>

            {file && !preview && isProcessing && (
              <div className="flex gap-3">
                <div className="flex-1 flex items-center justify-center py-3">
                  <div className="flex items-center gap-2 text-[#b3b3b3]">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                    Processing file...
                  </div>
                </div>
                <CancelButton onClick={onCancel}>
                  Cancel
                </CancelButton>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="text-red-400 whitespace-pre-line">{error}</div>
            </div>
          )}

          {/* Preview Section */}
          {preview && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Import Preview</h3>
                <ThemeButton
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2"
                >
                  {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showPreview ? 'Hide Details' : 'Show Details'}
                </ThemeButton>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg p-4">
                  <div className="text-sm text-[#b3b3b3]">Total Transactions</div>
                  <div className="text-2xl font-bold text-white">{preview.totalTransactions}</div>
                </div>
                <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg p-4">
                  <div className="text-sm text-[#b3b3b3]">Trades</div>
                  <div className="text-2xl font-bold text-blue-400">{preview.trades.length}</div>
                </div>
                <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg p-4">
                  <div className="text-sm text-[#b3b3b3]">Cash Transactions</div>
                  <div className="text-2xl font-bold text-green-400">{preview.cashTransactions.length}</div>
                </div>
                <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg p-4">
                  <div className="text-sm text-[#b3b3b3]">Fees & Interest</div>
                  <div className="text-2xl font-bold text-yellow-400">{preview.fees.length + preview.interest.length}</div>
                </div>
                <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg p-4">
                  <div className="text-sm text-[#b3b3b3]">Dividends</div>
                  <div className="text-2xl font-bold text-green-400">{preview.dividends.length}</div>
                </div>
                <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg p-4">
                  <div className="text-sm text-[#b3b3b3]">Tax & Actions</div>
                  <div className="text-2xl font-bold text-purple-400">{preview.withholdingTax.length + preview.corporateActions.length}</div>
                </div>
              </div>

              {/* Metadata */}
              <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Statement Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-[#b3b3b3]">Account ID:</span>
                    <div className="text-white">{preview.metadata.accountId || 'Not specified'}</div>
                  </div>
                  <div>
                    <span className="text-[#b3b3b3]">Period:</span>
                    <div className="text-white">{preview.metadata.statementPeriod || 'Not specified'}</div>
                  </div>
                  <div>
                    <span className="text-[#b3b3b3]">Base Currency:</span>
                    <div className="text-white">{preview.metadata.baseCurrency}</div>
                  </div>
                  <div>
                    <span className="text-[#b3b3b3]">Timezone:</span>
                    <div className="text-white">{preview.metadata.timezone}</div>
                  </div>
                  <div>
                    <span className="text-[#b3b3b3]">Generated:</span>
                    <div className="text-white">{preview.metadata.whenGenerated || 'Not specified'}</div>
                  </div>
                </div>
              </div>

              {/* Detailed Preview */}
              {showPreview && (
                <div className="space-y-6">
                  {/* Trades Preview */}
                  {preview.trades.length > 0 && (
                    <div>
                      <h4 className="text-white font-medium mb-3">Trades ({preview.trades.length})</h4>
                      <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-[#1a1a1a]">
                              <tr>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Date</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Symbol</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Category</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Quantity</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Price</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Proceeds</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Fees</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.trades.slice(0, 10).map((trade, index) => (
                                <tr key={index} className="border-t border-[#2d2d2d]">
                                  <td className="px-4 py-3 text-white">{formatDate(trade.dateTime)}</td>
                                  <td className="px-4 py-3 text-white">{trade.symbol}</td>
                                  <td className="px-4 py-3">
                                    <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400">
                                      {trade.assetCategory}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-white">{trade.quantity}</td>
                                  <td className="px-4 py-3 text-white">{formatCurrency(trade.tPrice, trade.currency)}</td>
                                  <td className="px-4 py-3 text-white">{formatCurrency(trade.proceeds, trade.currency)}</td>
                                  <td className="px-4 py-3 text-white">{formatCurrency(trade.commFee, trade.currency)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {preview.trades.length > 10 && (
                            <div className="px-4 py-3 text-center text-[#b3b3b3] text-sm">
                              ... and {preview.trades.length - 10} more trades
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cash Transactions Preview */}
                  {preview.cashTransactions.length > 0 && (
                    <div>
                      <h4 className="text-white font-medium mb-3">Cash Transactions ({preview.cashTransactions.length})</h4>
                      <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-[#1a1a1a]">
                              <tr>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Date</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Description</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Amount</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Currency</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.cashTransactions.slice(0, 10).map((transaction, index) => (
                                <tr key={index} className="border-t border-[#2d2d2d]">
                                  <td className="px-4 py-3 text-white">{formatDate(transaction.settleDate)}</td>
                                  <td className="px-4 py-3 text-white">{transaction.description}</td>
                                  <td className="px-4 py-3 text-white">{formatCurrency(transaction.amount, transaction.currency)}</td>
                                  <td className="px-4 py-3 text-white">{transaction.currency}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {preview.cashTransactions.length > 10 && (
                            <div className="px-4 py-3 text-center text-[#b3b3b3] text-sm">
                              ... and {preview.cashTransactions.length - 10} more transactions
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fees Preview */}
                  {preview.fees.length > 0 && (
                    <div>
                      <h4 className="text-white font-medium mb-3">Fees ({preview.fees.length})</h4>
                      <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-[#1a1a1a]">
                              <tr>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Date</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Type</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Description</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.fees.slice(0, 10).map((fee, index) => (
                                <tr key={index} className="border-t border-[#2d2d2d]">
                                  <td className="px-4 py-3 text-white">{formatDate(fee.date)}</td>
                                  <td className="px-4 py-3">
                                    <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
                                      {fee.subtitle}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-white">{fee.description}</td>
                                  <td className="px-4 py-3 text-white">{formatCurrency(fee.amount, fee.currency)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {preview.fees.length > 10 && (
                            <div className="px-4 py-3 text-center text-[#b3b3b3] text-sm">
                              ... and {preview.fees.length - 10} more fees
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Interest Preview */}
                  {preview.interest.length > 0 && (
                    <div>
                      <h4 className="text-white font-medium mb-3">Interest ({preview.interest.length})</h4>
                      <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-[#1a1a1a]">
                              <tr>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Date</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Description</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Amount</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Currency</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.interest.slice(0, 10).map((interestItem, index) => (
                                <tr key={index} className="border-t border-[#2d2d2d]">
                                  <td className="px-4 py-3 text-white">{formatDate(interestItem.date)}</td>
                                  <td className="px-4 py-3 text-white">{interestItem.description}</td>
                                  <td className="px-4 py-3 text-white">{formatCurrency(interestItem.amount, interestItem.currency)}</td>
                                  <td className="px-4 py-3 text-white">{interestItem.currency}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {preview.interest.length > 10 && (
                            <div className="px-4 py-3 text-center text-[#b3b3b3] text-sm">
                              ... and {preview.interest.length - 10} more interest entries
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dividends Preview */}
                  {preview.dividends.length > 0 && (
                    <div>
                      <h4 className="text-white font-medium mb-3">Dividends ({preview.dividends.length})</h4>
                      <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-[#1a1a1a]">
                              <tr>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Date</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Symbol</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Description</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Amount</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Currency</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.dividends.slice(0, 10).map((dividend, index) => (
                                <tr key={index} className="border-t border-[#2d2d2d]">
                                  <td className="px-4 py-3 text-white">{formatDate(dividend.date)}</td>
                                  <td className="px-4 py-3 text-white">{dividend.symbol || 'N/A'}</td>
                                  <td className="px-4 py-3 text-white">{dividend.description}</td>
                                  <td className="px-4 py-3 text-green-400">{formatCurrency(dividend.amount, dividend.currency)}</td>
                                  <td className="px-4 py-3 text-white">{dividend.currency}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {preview.dividends.length > 10 && (
                            <div className="px-4 py-3 text-center text-[#b3b3b3] text-sm">
                              ... and {preview.dividends.length - 10} more dividend entries
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Withholding Tax Preview */}
                  {preview.withholdingTax.length > 0 && (
                    <div>
                      <h4 className="text-white font-medium mb-3">Withholding Tax ({preview.withholdingTax.length})</h4>
                      <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-[#1a1a1a]">
                              <tr>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Date</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Symbol</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Description</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Amount</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Currency</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.withholdingTax.slice(0, 10).map((tax, index) => (
                                <tr key={index} className="border-t border-[#2d2d2d]">
                                  <td className="px-4 py-3 text-white">{formatDate(tax.date)}</td>
                                  <td className="px-4 py-3 text-white">{tax.symbol || 'N/A'}</td>
                                  <td className="px-4 py-3 text-white">{tax.description}</td>
                                  <td className="px-4 py-3 text-red-400">{formatCurrency(tax.amount, tax.currency)}</td>
                                  <td className="px-4 py-3 text-white">{tax.currency}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {preview.withholdingTax.length > 10 && (
                            <div className="px-4 py-3 text-center text-[#b3b3b3] text-sm">
                              ... and {preview.withholdingTax.length - 10} more tax entries
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Corporate Actions Preview */}
                  {preview.corporateActions.length > 0 && (
                    <div>
                      <h4 className="text-white font-medium mb-3">Corporate Actions ({preview.corporateActions.length})</h4>
                      <div className="bg-[#0f0f0f] border border-[#2d2d2d] rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-[#1a1a1a]">
                              <tr>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Date</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Symbol</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Description</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Amount</th>
                                <th className="px-4 py-3 text-left text-[#b3b3b3]">Currency</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.corporateActions.slice(0, 10).map((action, index) => (
                                <tr key={index} className="border-t border-[#2d2d2d]">
                                  <td className="px-4 py-3 text-white">{formatDate(action.date)}</td>
                                  <td className="px-4 py-3 text-white">{action.symbol || 'N/A'}</td>
                                  <td className="px-4 py-3 text-white">{action.description}</td>
                                  <td className={`px-4 py-3 ${action.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {formatCurrency(action.amount, action.currency)}
                                  </td>
                                  <td className="px-4 py-3 text-white">{action.currency}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {preview.corporateActions.length > 10 && (
                            <div className="px-4 py-3 text-center text-[#b3b3b3] text-sm">
                              ... and {preview.corporateActions.length - 10} more corporate action entries
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Import Actions */}
              <div className="flex gap-3 pt-4 border-t border-[#2d2d2d]">
                <ThemeButton
                  onClick={handleImport}
                  disabled={isProcessing}
                  className="flex-1 flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Import {preview.totalTransactions} Transactions
                </ThemeButton>
                <CancelButton onClick={onCancel}>
                  Cancel
                </CancelButton>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Modal */}
      {isImporting && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]">
          <Card className="bg-[#1a1a1a] border-[#2d2d2d] w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Importing Transactions
              </CardTitle>
              <p className="text-sm text-[#b3b3b3]">
                Importing into: <span className="text-blue-400 font-medium">{accountName}</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#b3b3b3]">Progress</span>
                  <span className="text-white">{importProgress.current} of {importProgress.total}</span>
                </div>
                <div className="w-full bg-[#2d2d2d] rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-white font-medium">{importProgress.message}</p>
                <p className="text-sm text-[#b3b3b3] mt-2">
                  Please wait while we process your data...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

