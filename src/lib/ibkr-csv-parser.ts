/**
 * IBKR CSV Parser - Simple Working Version
 * 
 * Parses Interactive Brokers CSV activity statements and converts them
 * to our transaction format. Based on real IBKR CSV format analysis.
 * 
 * Now uses CurrencyAmount for type-safe currency handling.
 */

import { Transaction } from '@/types/database';
import { CurrencyAmount, CurrencyCode, isValidCurrencyCode } from './currency-amount';

export interface IBKRTrade {
  dataDiscriminator: string;
  assetCategory: string;
  symbol: string;
  dateTime: string;
  quantity: number;
  tPrice: CurrencyAmount;
  cPrice: CurrencyAmount;
  proceeds: CurrencyAmount;
  commFee: CurrencyAmount;
  basis: CurrencyAmount;
  realizedPL: CurrencyAmount;
  mtmPL: CurrencyAmount;
  code: string;
}

export interface IBKRCashTransaction {
  settleDate: string;
  description: string;
  amount: CurrencyAmount;
}

export interface IBKRFee {
  subtitle: string;
  date: string;
  description: string;
  amount: CurrencyAmount;
}

export interface IBKRInterest {
  date: string;
  description: string;
  amount: CurrencyAmount;
}

export interface IBKRDividend {
  date: string;
  description: string;
  amount: CurrencyAmount;
  symbol?: string;
}

export interface IBKRWithholdingTax {
  date: string;
  description: string;
  amount: CurrencyAmount;
  symbol?: string;
}

export interface IBKRCorporateAction {
  date: string;
  description: string;
  amount: CurrencyAmount;
  symbol?: string;
}

export interface IBKRFinancialInstrument {
  symbol: string;
  description: string;
  assetCategory: string;
  currency: string;
  multiplier: number;
}

export interface IBKRCode {
  code: string;
  description: string;
}

export interface IBKRParseResult {
  trades: IBKRTrade[];
  cashTransactions: IBKRCashTransaction[];
  fees: IBKRFee[];
  interest: IBKRInterest[];
  dividends: IBKRDividend[];
  withholdingTax: IBKRWithholdingTax[];
  corporateActions: IBKRCorporateAction[];
  financialInstruments: IBKRFinancialInstrument[];
  codes: IBKRCode[];
  metadata: {
    accountId: string;
    statementPeriod: string;
    baseCurrency: string;
    timezone: string;
    whenGenerated: string;
    brokerName: string;
    title: string;
  };
}

export class IBKRCSVParser {
  private content: string;

  /**
   * Create a CurrencyAmount from a string value and currency code
   * Validates currency code and handles parsing errors
   */
  private createCurrencyAmount(value: string, currency: string): CurrencyAmount {
    if (!isValidCurrencyCode(currency)) {
      throw new Error(`Invalid currency code in IBKR data: ${currency}`);
    }
    
    const numericValue = parseFloat(value) || 0;
    return new CurrencyAmount(numericValue, currency as CurrencyCode);
  }
  private lines: string[];

  constructor(csvContent: string) {
    this.content = csvContent;
    this.lines = csvContent.split('\n').map(line => line.trim());
  }

  /**
   * Parse the entire IBKR CSV file
   */
  parse(): IBKRParseResult {
    try {
      const trades = this.parseTrades();
      const cashTransactions = this.parseCashTransactions();
      const fees = this.parseFees();
      const interest = this.parseInterest();
      const dividends = this.parseDividends();
      const withholdingTax = this.parseWithholdingTax();
      const corporateActions = this.parseCorporateActions();
      const financialInstruments = this.parseFinancialInstruments();
      const codes = this.parseCodes();
      const metadata = this.extractMetadata();

      return {
        trades,
        cashTransactions,
        fees,
        interest,
        dividends,
        withholdingTax,
        corporateActions,
        financialInstruments,
        codes,
        metadata
      };
    } catch (error) {
      console.error('Error parsing IBKR CSV:', error);
      throw new Error(`Failed to parse IBKR CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse trades from the CSV
   */
  private parseTrades(): IBKRTrade[] {
    const trades: IBKRTrade[] = [];
    let inTradesSection = false;
    let headers: string[] = [];

    for (const line of this.lines) {
      const parts = this.parseCSVLine(line);
      
      if (parts.length > 0 && parts[0] === 'Trades') {
        if (parts[1] === 'Header') {
          inTradesSection = true;
          headers = parts.slice(2); // Skip 'Trades' and 'Header'
          continue;
        } else if (parts[1] === 'Data' && inTradesSection) {
          // This is a trade data row
          const trade = this.parseTradeRow(parts.slice(2), headers);
          if (trade) {
            trades.push(trade);
          }
        }
      } else if (inTradesSection && parts.length > 0 && parts[0] !== 'Trades') {
        // We've moved to a different section
        inTradesSection = false;
      }
    }

    return trades;
  }

  /**
   * Parse a single trade row
   */
  private parseTradeRow(row: string[], headers: string[]): IBKRTrade | null {
    if (row.length < headers.length) {
      return null;
    }

    const getValue = (fieldName: string): string => {
      const index = headers.findIndex(h => h === fieldName);
      return index >= 0 ? row[index] || '' : '';
    };

    const dataDiscriminator = getValue('DataDiscriminator');
    const assetCategory = getValue('Asset Category');
    const currency = getValue('Currency');
    const symbol = getValue('Symbol');
    const dateTime = getValue('Date/Time');
    const quantity = parseFloat(getValue('Quantity')) || 0;
    const code = getValue('Code');

    // Skip subtotals and totals
    if (dataDiscriminator === 'SubTotal' || dataDiscriminator === 'Total') {
      return null;
    }

    // Skip if essential fields are missing
    if (!symbol || !dateTime || !currency) {
      return null;
    }

    // Create CurrencyAmount instances for all monetary values
    const tPrice = this.createCurrencyAmount(getValue('T. Price'), currency);
    const cPrice = this.createCurrencyAmount(getValue('C. Price'), currency);
    const proceeds = this.createCurrencyAmount(getValue('Proceeds'), currency);
    const commFee = this.createCurrencyAmount(getValue('Comm/Fee'), currency);
    const basis = this.createCurrencyAmount(getValue('Basis'), currency);
    const realizedPL = this.createCurrencyAmount(getValue('Realized P/L'), currency);
    const mtmPL = this.createCurrencyAmount(getValue('MTM P/L'), currency);

    return {
      dataDiscriminator,
      assetCategory,
      symbol,
      dateTime,
      quantity,
      tPrice,
      cPrice,
      proceeds,
      commFee,
      basis,
      realizedPL,
      mtmPL,
      code
    };
  }

  /**
   * Parse cash transactions from the CSV
   */
  private parseCashTransactions(): IBKRCashTransaction[] {
    const transactions: IBKRCashTransaction[] = [];
    let inCashSection = false;
    let headers: string[] = [];

    for (const line of this.lines) {
      const parts = this.parseCSVLine(line);
      
      if (parts.length > 0 && parts[0] === 'Deposits & Withdrawals') {
        if (parts[1] === 'Header') {
          inCashSection = true;
          headers = parts.slice(2); // Skip 'Deposits & Withdrawals' and 'Header'
          continue;
        } else if (parts[1] === 'Data' && inCashSection) {
          // This is a cash transaction data row
          const transaction = this.parseCashTransactionRow(parts.slice(2), headers);
          if (transaction) {
            transactions.push(transaction);
          }
        }
      } else if (inCashSection && parts.length > 0 && parts[0] !== 'Deposits & Withdrawals') {
        // We've moved to a different section
        inCashSection = false;
      }
    }

    return transactions;
  }

  /**
   * Parse a single cash transaction row
   */
  private parseCashTransactionRow(row: string[], headers: string[]): IBKRCashTransaction | null {
    if (row.length < headers.length) {
      return null;
    }

    const getValue = (fieldName: string): string => {
      const index = headers.findIndex(h => h === fieldName);
      return index >= 0 ? row[index] || '' : '';
    };

    const currency = getValue('Currency');
    const settleDate = getValue('Settle Date');
    const description = getValue('Description');
    
    // Skip totals
    if (currency === 'Total' || currency === 'Total in USD') {
      return null;
    }

    // Skip if essential fields are missing
    if (!currency || !settleDate || !description) {
      return null;
    }

    const amount = this.createCurrencyAmount(getValue('Amount'), currency);

    return {
      settleDate,
      description,
      amount
    };
  }

  /**
   * Parse fees from the CSV
   */
  private parseFees(): IBKRFee[] {
    const fees: IBKRFee[] = [];
    let inFeesSection = false;
    let headers: string[] = [];

    for (const line of this.lines) {
      const parts = this.parseCSVLine(line);
      
      if (parts.length > 0 && parts[0] === 'Fees') {
        if (parts[1] === 'Header') {
          inFeesSection = true;
          headers = parts.slice(2); // Skip 'Fees' and 'Header'
          continue;
        } else if (parts[1] === 'Data' && inFeesSection) {
          // This is a fee data row
          const fee = this.parseFeeRow(parts.slice(2), headers);
          if (fee) {
            fees.push(fee);
          }
        }
      } else if (inFeesSection && parts.length > 0 && parts[0] !== 'Fees') {
        // We've moved to a different section
        inFeesSection = false;
      }
    }

    return fees;
  }

  /**
   * Parse a single fee row
   */
  private parseFeeRow(row: string[], headers: string[]): IBKRFee | null {
    if (row.length < headers.length) {
      return null;
    }

    const getValue = (fieldName: string): string => {
      const index = headers.findIndex(h => h === fieldName);
      return index >= 0 ? row[index] || '' : '';
    };

    const subtitle = getValue('Subtitle');
    const currency = getValue('Currency');
    const date = getValue('Date');
    const description = getValue('Description');

    // Skip totals
    if (subtitle === 'Total') {
      return null;
    }

    if (!subtitle || !currency || !date || !description) {
      return null;
    }

    const amount = this.createCurrencyAmount(getValue('Amount'), currency);

    return {
      subtitle,
      date,
      description,
      amount
    };
  }

  /**
   * Parse interest from the CSV
   */
  private parseInterest(): IBKRInterest[] {
    const interest: IBKRInterest[] = [];
    let inInterestSection = false;
    let headers: string[] = [];

    for (const line of this.lines) {
      const parts = this.parseCSVLine(line);
      
      if (parts.length > 0 && parts[0] === 'Interest') {
        if (parts[1] === 'Header') {
          inInterestSection = true;
          headers = parts.slice(2); // Skip 'Interest' and 'Header'
          continue;
        } else if (parts[1] === 'Data' && inInterestSection) {
          // This is an interest data row
          const interestItem = this.parseInterestRow(parts.slice(2), headers);
          if (interestItem) {
            interest.push(interestItem);
          }
        }
      } else if (inInterestSection && parts.length > 0 && parts[0] !== 'Interest') {
        // We've moved to a different section
        inInterestSection = false;
      }
    }

    return interest;
  }

  /**
   * Parse a single interest row
   */
  private parseInterestRow(row: string[], headers: string[]): IBKRInterest | null {
    if (row.length < headers.length) {
      return null;
    }

    const getValue = (fieldName: string): string => {
      const index = headers.findIndex(h => h === fieldName);
      return index >= 0 ? row[index] || '' : '';
    };

    const currency = getValue('Currency');
    const date = getValue('Date');
    const description = getValue('Description');

    // Skip totals
    if (currency === 'Total' || currency === 'Total in USD' || currency === 'Total Interest in USD') {
      return null;
    }

    if (!currency || !date || !description) {
      return null;
    }

    const amount = this.createCurrencyAmount(getValue('Amount'), currency);

    return {
      date,
      description,
      amount
    };
  }

  /**
   * Parse dividends from the CSV
   */
  private parseDividends(): IBKRDividend[] {
    const dividends: IBKRDividend[] = [];
    let inDividendsSection = false;
    let headers: string[] = [];

    for (const line of this.lines) {
      const parts = this.parseCSVLine(line);
      
      if (parts.length > 0 && parts[0] === 'Dividends') {
        if (parts[1] === 'Header') {
          inDividendsSection = true;
          headers = parts.slice(2);
          continue;
        } else if (parts[1] === 'Data' && inDividendsSection) {
          const dividend = this.parseDividendRow(parts.slice(2), headers);
          if (dividend) {
            dividends.push(dividend);
          }
        }
      } else if (inDividendsSection && parts.length > 0 && parts[0] !== 'Dividends') {
        inDividendsSection = false;
      }
    }

    return dividends;
  }

  /**
   * Parse a single dividend row
   */
  private parseDividendRow(row: string[], headers: string[]): IBKRDividend | null {
    if (row.length < headers.length) {
      return null;
    }

    const getValue = (fieldName: string): string => {
      const index = headers.findIndex(h => h === fieldName);
      return index >= 0 ? row[index] || '' : '';
    };

    const currency = getValue('Currency');
    const date = getValue('Date');
    const description = getValue('Description');
    const symbol = getValue('Symbol') || undefined;

    // Skip totals
    if (currency === 'Total' || currency === 'Total in USD') {
      return null;
    }

    if (!currency || !date || !description) {
      return null;
    }

    const amount = this.createCurrencyAmount(getValue('Amount'), currency);

    return {
      date,
      description,
      amount,
      symbol
    };
  }

  /**
   * Parse withholding tax from the CSV
   */
  private parseWithholdingTax(): IBKRWithholdingTax[] {
    const withholdingTax: IBKRWithholdingTax[] = [];
    let inWithholdingSection = false;
    let headers: string[] = [];

    for (const line of this.lines) {
      const parts = this.parseCSVLine(line);
      
      if (parts.length > 0 && parts[0] === 'Withholding Tax') {
        if (parts[1] === 'Header') {
          inWithholdingSection = true;
          headers = parts.slice(2);
          continue;
        } else if (parts[1] === 'Data' && inWithholdingSection) {
          const tax = this.parseWithholdingTaxRow(parts.slice(2), headers);
          if (tax) {
            withholdingTax.push(tax);
          }
        }
      } else if (inWithholdingSection && parts.length > 0 && parts[0] !== 'Withholding Tax') {
        inWithholdingSection = false;
      }
    }

    return withholdingTax;
  }

  /**
   * Parse a single withholding tax row
   */
  private parseWithholdingTaxRow(row: string[], headers: string[]): IBKRWithholdingTax | null {
    if (row.length < headers.length) {
      return null;
    }

    const getValue = (fieldName: string): string => {
      const index = headers.findIndex(h => h === fieldName);
      return index >= 0 ? row[index] || '' : '';
    };

    const currency = getValue('Currency');
    const date = getValue('Date');
    const description = getValue('Description');
    const symbol = getValue('Symbol') || undefined;

    // Skip totals
    if (currency === 'Total' || currency === 'Total in USD') {
      return null;
    }

    if (!currency || !date || !description) {
      return null;
    }

    const amount = this.createCurrencyAmount(getValue('Amount'), currency);

    return {
      date,
      description,
      amount,
      symbol
    };
  }

  /**
   * Parse corporate actions from the CSV
   */
  private parseCorporateActions(): IBKRCorporateAction[] {
    const corporateActions: IBKRCorporateAction[] = [];
    let inCorporateActionsSection = false;
    let headers: string[] = [];

    for (const line of this.lines) {
      const parts = this.parseCSVLine(line);
      
      if (parts.length > 0 && parts[0] === 'Corporate Actions') {
        if (parts[1] === 'Header') {
          inCorporateActionsSection = true;
          headers = parts.slice(2);
          continue;
        } else if (parts[1] === 'Data' && inCorporateActionsSection) {
          const action = this.parseCorporateActionRow(parts.slice(2), headers);
          if (action) {
            corporateActions.push(action);
          }
        }
      } else if (inCorporateActionsSection && parts.length > 0 && parts[0] !== 'Corporate Actions') {
        inCorporateActionsSection = false;
      }
    }

    return corporateActions;
  }

  /**
   * Parse a single corporate action row
   */
  private parseCorporateActionRow(row: string[], headers: string[]): IBKRCorporateAction | null {
    if (row.length < headers.length) {
      return null;
    }

    const getValue = (fieldName: string): string => {
      const index = headers.findIndex(h => h === fieldName);
      return index >= 0 ? row[index] || '' : '';
    };

    const currency = getValue('Currency');
    const date = getValue('Date');
    const description = getValue('Description');
    const symbol = getValue('Symbol') || undefined;

    // Skip totals
    if (currency === 'Total' || currency === 'Total in USD') {
      return null;
    }

    if (!currency || !date || !description) {
      return null;
    }

    const amount = this.createCurrencyAmount(getValue('Amount'), currency);

    return {
      date,
      description,
      amount,
      symbol
    };
  }

  /**
   * Parse financial instruments from the CSV
   */
  private parseFinancialInstruments(): IBKRFinancialInstrument[] {
    const instruments: IBKRFinancialInstrument[] = [];
    let inInstrumentsSection = false;
    let headers: string[] = [];

    for (const line of this.lines) {
      const parts = this.parseCSVLine(line);
      
      if (parts.length > 0 && parts[0] === 'Financial Instrument Information') {
        if (parts[1] === 'Header') {
          inInstrumentsSection = true;
          headers = parts.slice(2);
          continue;
        } else if (parts[1] === 'Data' && inInstrumentsSection) {
          const instrument = this.parseFinancialInstrumentRow(parts.slice(2), headers);
          if (instrument) {
            instruments.push(instrument);
          }
        }
      } else if (inInstrumentsSection && parts.length > 0 && parts[0] !== 'Financial Instrument Information') {
        inInstrumentsSection = false;
      }
    }

    return instruments;
  }

  /**
   * Parse a single financial instrument row
   */
  private parseFinancialInstrumentRow(row: string[], headers: string[]): IBKRFinancialInstrument | null {
    if (row.length < headers.length) {
      return null;
    }

    const getValue = (fieldName: string): string => {
      const index = headers.findIndex(h => h === fieldName);
      return index >= 0 ? row[index] || '' : '';
    };

    const symbol = getValue('Symbol');
    const description = getValue('Description');
    const assetCategory = getValue('Asset Category');
    const currency = getValue('Currency');
    const multiplier = parseFloat(getValue('Multiplier')) || 1;

    if (!symbol || !description || !assetCategory || !currency) {
      return null;
    }

    return {
      symbol,
      description,
      assetCategory,
      currency,
      multiplier
    };
  }

  /**
   * Parse codes from the CSV
   */
  private parseCodes(): IBKRCode[] {
    const codes: IBKRCode[] = [];
    let inCodesSection = false;
    let headers: string[] = [];

    for (const line of this.lines) {
      const parts = this.parseCSVLine(line);
      
      if (parts.length > 0 && parts[0] === 'Codes') {
        if (parts[1] === 'Header') {
          inCodesSection = true;
          headers = parts.slice(2);
          continue;
        } else if (parts[1] === 'Data' && inCodesSection) {
          const code = this.parseCodeRow(parts.slice(2), headers);
          if (code) {
            codes.push(code);
          }
        }
      } else if (inCodesSection && parts.length > 0 && parts[0] !== 'Codes') {
        inCodesSection = false;
      }
    }

    return codes;
  }

  /**
   * Parse a single code row
   */
  private parseCodeRow(row: string[], headers: string[]): IBKRCode | null {
    if (row.length < headers.length) {
      return null;
    }

    const getValue = (fieldName: string): string => {
      const index = headers.findIndex(h => h === fieldName);
      return index >= 0 ? row[index] || '' : '';
    };

    const code = getValue('Code');
    const description = getValue('Description');

    if (!code || !description) {
      return null;
    }

    return {
      code,
      description
    };
  }

  /**
   * Extract metadata from the CSV file
   */
  private extractMetadata(): IBKRParseResult['metadata'] {
    let accountId = '';
    let statementPeriod = '';
    let baseCurrency = 'USD';
    let timezone = 'AEST';
    let whenGenerated = '';
    let brokerName = '';
    let title = '';

    for (const line of this.lines) {
      const parts = this.parseCSVLine(line);
      
      if (parts.length >= 4 && parts[1] === 'Data') {
        const fieldName = parts[2] || '';
        const fieldValue = parts[3] || '';
        
        if (fieldName === 'Account') {
          accountId = fieldValue;
        } else if (fieldName === 'Period') {
          statementPeriod = fieldValue;
        } else if (fieldName === 'Base Currency') {
          baseCurrency = fieldValue;
        } else if (fieldName === 'WhenGenerated') {
          whenGenerated = fieldValue;
          // Extract timezone from the generated time
          if (fieldValue.includes('AEST')) {
            timezone = 'AEST';
          } else if (fieldValue.includes('AEDT')) {
            timezone = 'AEDT';
          } else if (fieldValue.includes('EST')) {
            timezone = 'EST';
          }
        } else if (fieldName === 'BrokerName') {
          brokerName = fieldValue;
        } else if (fieldName === 'Title') {
          title = fieldValue;
        }
      }
    }

    return {
      accountId,
      statementPeriod,
      baseCurrency,
      timezone,
      whenGenerated,
      brokerName,
      title
    };
  }

  /**
   * Parse a CSV line, handling quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Convert AEST/AEDT time to UTC
   */
  private convertToUTC(dateTimeStr: string, timezone: string): string {
    try {
      // Parse the date time string
      const date = new Date(dateTimeStr);
      
      // AEST is UTC+10, AEDT is UTC+11
      const offset = timezone === 'AEST' ? 10 : 11;
      
      // Convert to UTC by subtracting the offset
      const utcDate = new Date(date.getTime() - (offset * 60 * 60 * 1000));
      
      return utcDate.toISOString();
    } catch (error) {
      console.warn('Failed to convert timezone:', dateTimeStr, timezone, error);
      return dateTimeStr;
    }
  }
}

/**
 * Convert IBKR trades to our transaction format
 */
export function extractTickerNamesFromIBKRData(
  trades: IBKRTrade[],
  cashTransactions: IBKRCashTransaction[],
  fees: IBKRFee[],
  interest: IBKRInterest[],
  dividends: IBKRDividend[],
  withholdingTax: IBKRWithholdingTax[],
  corporateActions: IBKRCorporateAction[]
): string[] {
  const tickerNames = new Set<string>();

  // Extract from trades (skip Forex transactions)
  trades
    .filter(trade => !trade.assetCategory?.toLowerCase().includes('forex'))
    .forEach(trade => {
      if (trade.symbol) {
        // For options, extract the underlying symbol
        const underlyingSymbol = trade.symbol.split(' ')[0];
        if (underlyingSymbol) {
          tickerNames.add(underlyingSymbol);
        }
      }
    });

  // Extract from dividends
  dividends.forEach(dividend => {
    if (dividend.symbol) {
      tickerNames.add(dividend.symbol);
    }
  });

  // Extract from withholding tax
  withholdingTax.forEach(tax => {
    if (tax.symbol) {
      tickerNames.add(tax.symbol);
    }
  });

  // Extract from corporate actions
  corporateActions.forEach(action => {
    if (action.symbol) {
      tickerNames.add(action.symbol);
    }
  });

  return Array.from(tickerNames);
}

export function convertIBKRTradesToTransactions(
  trades: IBKRTrade[],
  accountId: string,
  userId: string,
  timezone: string = 'AEST',
  tickerIdMap: { [tickerName: string]: string } = {}
): Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[] {
  if (!accountId || !userId) {
    throw new Error('Account ID and User ID are required for transaction conversion');
  }

  return trades
    .filter(trade => {
      // Skip Forex transactions entirely
      return !trade.assetCategory?.toLowerCase().includes('forex');
    })
    .map((trade, index) => {
      try {
        // Determine instrument kind based on asset category
        let instrumentKind: Transaction['instrument_kind'] = 'SHARES';
        
        if (trade.assetCategory?.toLowerCase().includes('option')) {
          // Parse option symbol to determine if it's a call or put
          const optionMatch = trade.symbol.match(/(\w+)\s+(\d{2}[A-Z]{3}\d{2})\s+(\d+(?:\.\d+)?)\s+([CP])/);
          if (optionMatch) {
            instrumentKind = optionMatch[4] === 'C' ? 'CALL' : 'PUT';
          } else {
            // Fallback: check if symbol contains 'C' or 'P'
            instrumentKind = trade.symbol.includes(' C') ? 'CALL' : 'PUT';
          }
        }

      // Parse expiry date from option symbol
      let expiry: string | undefined;
      if (instrumentKind === 'CALL' || instrumentKind === 'PUT') {
        const expiryMatch = trade.symbol.match(/(\d{2})([A-Z]{3})(\d{2})/);
        if (expiryMatch) {
          const day = expiryMatch[1];
          const month = expiryMatch[2];
          const year = '20' + expiryMatch[3];
          
          // Convert month abbreviation to number
          const monthMap: { [key: string]: string } = {
            'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
            'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
            'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
          };
          
          const monthNum = monthMap[month];
          if (monthNum) {
            expiry = `${year}-${monthNum}-${day}`;
          }
        }
      }

      // Parse strike price from option symbol
      let strike: number | undefined;
      if (instrumentKind === 'CALL' || instrumentKind === 'PUT') {
        const strikeMatch = trade.symbol.match(/(\d+(?:\.\d+)?)\s+[CP]/);
        if (strikeMatch) {
          strike = parseFloat(strikeMatch[1]);
        }
      }

      // Convert date to UTC
      const parser = new IBKRCSVParser('');
      const utcDateTime = parser['convertToUTC'](trade.dateTime, timezone);

      // Determine side based on quantity
      const side = trade.quantity > 0 ? 'BUY' : 'SELL';

      // Get ticker ID for the underlying symbol
      const underlyingSymbol = trade.symbol.split(' ')[0];
      const tickerId = tickerIdMap[underlyingSymbol];

      return {
        user_id: userId,
        account_id: accountId,
        timestamp: utcDateTime,
        instrument_kind: instrumentKind,
        ticker_id: tickerId,
        expiry,
        strike,
        side,
        qty: Math.abs(trade.quantity),
        price: trade.tPrice.amount,
        fees: Math.abs(trade.commFee.amount),
        currency: trade.tPrice.currency,
        memo: `${trade.assetCategory} - ${trade.symbol} (${trade.code || 'N/A'})`
      };
    } catch (error) {
      console.error(`Error converting trade ${index + 1}:`, error, trade);
      throw new Error(`Failed to convert trade ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

/**
 * Convert IBKR cash transactions to our transaction format
 */
export function convertIBKRCashToTransactions(
  cashTransactions: IBKRCashTransaction[],
  accountId: string,
  userId: string
): Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[] {
  if (!accountId || !userId) {
    throw new Error('Account ID and User ID are required for transaction conversion');
  }

  return cashTransactions.map((transaction, index) => {
    try {
      const transactionDate = new Date(transaction.settleDate);
      const timestamp = transactionDate.toISOString();

      // Determine transaction type based on description
      let side: 'BUY' | 'SELL' = 'BUY';
      if (transaction.description.toLowerCase().includes('withdrawal') || 
          transaction.description.toLowerCase().includes('transfer out')) {
        side = 'SELL';
      }

      return {
        user_id: userId,
        account_id: accountId,
        timestamp,
        instrument_kind: 'CASH',
        side,
        qty: Math.abs(transaction.amount.amount),
        price: 1, // Cash transactions have price of 1
        fees: 0,
        currency: transaction.amount.currency,
        memo: `${transaction.description} (${transaction.amount.currency})`
      };
    } catch (error) {
      console.error(`Error converting cash transaction ${index + 1}:`, error, transaction);
      throw new Error(`Failed to convert cash transaction ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

/**
 * Convert IBKR fees to our transaction format
 */
export function convertIBKRFeesToTransactions(
  fees: IBKRFee[],
  accountId: string,
  userId: string
): Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[] {
  if (!accountId || !userId) {
    throw new Error('Account ID and User ID are required for transaction conversion');
  }

  return fees.map((fee, index) => {
    try {
      const feeDate = new Date(fee.date);
      const timestamp = feeDate.toISOString();

      return {
        user_id: userId,
        account_id: accountId,
        timestamp,
        instrument_kind: 'CASH',
        side: 'SELL', // Fees are always outflows
        qty: Math.abs(fee.amount.amount),
        price: 1,
        fees: 0,
        currency: fee.amount.currency,
        memo: `${fee.subtitle}: ${fee.description} (${fee.amount.currency})`
      };
    } catch (error) {
      console.error(`Error converting fee ${index + 1}:`, error, fee);
      throw new Error(`Failed to convert fee ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

/**
 * Convert IBKR interest to our transaction format
 */
export function convertIBKRInterestToTransactions(
  interest: IBKRInterest[],
  accountId: string,
  userId: string
): Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[] {
  if (!accountId || !userId) {
    throw new Error('Account ID and User ID are required for transaction conversion');
  }

  return interest.map((interestItem, index) => {
    try {
      const interestDate = new Date(interestItem.date);
      const timestamp = interestDate.toISOString();

      return {
        user_id: userId,
        account_id: accountId,
        timestamp,
        instrument_kind: 'CASH',
        side: 'BUY', // Interest is always an inflow
        qty: Math.abs(interestItem.amount.amount),
        price: 1,
        fees: 0,
        currency: interestItem.amount.currency,
        memo: `${interestItem.description} (${interestItem.amount.currency})`
      };
    } catch (error) {
      console.error(`Error converting interest ${index + 1}:`, error, interestItem);
      throw new Error(`Failed to convert interest ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

/**
 * Convert IBKR dividends to our transaction format
 */
export function convertIBKRDividendsToTransactions(
  dividends: IBKRDividend[],
  accountId: string,
  userId: string,
  tickerIdMap: { [tickerName: string]: string } = {}
): Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[] {
  if (!accountId || !userId) {
    throw new Error('Account ID and User ID are required for transaction conversion');
  }

  return dividends.map((dividend, index) => {
    try {
      const dividendDate = new Date(dividend.date);
      const timestamp = dividendDate.toISOString();

      // Get ticker ID if symbol exists
      const tickerId = dividend.symbol ? tickerIdMap[dividend.symbol] : undefined;

      return {
        user_id: userId,
        account_id: accountId,
        timestamp,
        instrument_kind: 'CASH',
        ticker_id: tickerId,
        side: 'BUY', // Dividends are always inflows
        qty: Math.abs(dividend.amount.amount),
        price: 1,
        fees: 0,
        currency: dividend.amount.currency,
        memo: `Dividend: ${dividend.description}${dividend.symbol ? ` (${dividend.symbol})` : ''} (${dividend.amount.currency})`
      };
    } catch (error) {
      console.error(`Error converting dividend ${index + 1}:`, error, dividend);
      throw new Error(`Failed to convert dividend ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

/**
 * Convert IBKR withholding tax to our transaction format
 */
export function convertIBKRWithholdingTaxToTransactions(
  withholdingTax: IBKRWithholdingTax[],
  accountId: string,
  userId: string,
  tickerIdMap: { [tickerName: string]: string } = {}
): Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[] {
  if (!accountId || !userId) {
    throw new Error('Account ID and User ID are required for transaction conversion');
  }

  return withholdingTax.map((tax, index) => {
    try {
      const taxDate = new Date(tax.date);
      const timestamp = taxDate.toISOString();

      // Get ticker ID if symbol exists
      const tickerId = tax.symbol ? tickerIdMap[tax.symbol] : undefined;

      return {
        user_id: userId,
        account_id: accountId,
        timestamp,
        instrument_kind: 'CASH',
        ticker_id: tickerId,
        side: 'SELL', // Withholding tax is always an outflow
        qty: Math.abs(tax.amount.amount),
        price: 1,
        fees: 0,
        currency: tax.amount.currency,
        memo: `Withholding Tax: ${tax.description}${tax.symbol ? ` (${tax.symbol})` : ''} (${tax.amount.currency})`
      };
    } catch (error) {
      console.error(`Error converting withholding tax ${index + 1}:`, error, tax);
      throw new Error(`Failed to convert withholding tax ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

/**
 * Convert IBKR corporate actions to our transaction format
 */
export function convertIBKRCorporateActionsToTransactions(
  corporateActions: IBKRCorporateAction[],
  accountId: string,
  userId: string,
  tickerIdMap: { [tickerName: string]: string } = {}
): Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[] {
  if (!accountId || !userId) {
    throw new Error('Account ID and User ID are required for transaction conversion');
  }

  return corporateActions.map((action, index) => {
    try {
      const actionDate = new Date(action.date);
      const timestamp = actionDate.toISOString();

      // Get ticker ID if symbol exists
      const tickerId = action.symbol ? tickerIdMap[action.symbol] : undefined;

      // Determine side based on amount (positive = inflow, negative = outflow)
      const side = action.amount.amount >= 0 ? 'BUY' : 'SELL';

      return {
        user_id: userId,
        account_id: accountId,
        timestamp,
        instrument_kind: 'CASH',
        ticker_id: tickerId,
        side,
        qty: Math.abs(action.amount.amount),
        price: 1,
        fees: 0,
        currency: action.amount.currency,
        memo: `Corporate Action: ${action.description}${action.symbol ? ` (${action.symbol})` : ''} (${action.amount.currency})`
      };
    } catch (error) {
      console.error(`Error converting corporate action ${index + 1}:`, error, action);
      throw new Error(`Failed to convert corporate action ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}
