/**
 * Unit tests for IBKR CSV Parser
 */

import { 
  IBKRCSVParser, 
  convertIBKRTradesToTransactions, 
  convertIBKRCashToTransactions,
  convertIBKRDividendsToTransactions,
  convertIBKRWithholdingTaxToTransactions,
  convertIBKRCorporateActionsToTransactions,
  extractTickerNamesFromIBKRData
} from '../ibkr-csv-parser';

// Sample IBKR CSV content for testing
const sampleIBKRCSV = `Statement,Header,Field Name,Field Value
Statement,Data,BrokerName,"Interactive Brokers LLC"
Statement,Data,Title,Activity Statement
Statement,Data,Period,"January 1, 2024 - December 31, 2024"
Statement,Data,WhenGenerated,"2024-12-31, 15:30:00 EST"
Account Information,Header,Field Name,Field Value
Account Information,Data,Name,Test Trading LLC
Account Information,Data,Account,U12345678
Account Information,Data,Base Currency,USD
Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code
Trades,Data,Order,Stocks,USD,AAPL,"2024-03-15, 10:30:00",100,150.00,150.00,-15000,-5,15005,0,0,O
Trades,Data,Order,Stocks,USD,AAPL,"2024-03-20, 14:15:00",-100,155.00,155.00,15500,-5,-15005,495,0,C
Trades,Data,Order,Equity and Index Options,USD,AAPL 15MAR24 150 C,"2024-03-15, 10:35:00",1,5.00,5.00,-500,-2,502,0,0,O
Trades,Data,Order,Equity and Index Options,USD,AAPL 15MAR24 150 C,"2024-03-20, 14:20:00",-1,6.00,6.00,600,-2,-502,98,0,C
Trades,Data,Assignment,Stocks,USD,AAPL,"2024-03-22, 09:30:00",100,155.00,155.00,-15500,-1,15501,0,0,A
Trades,Data,Exercise,Equity and Index Options,USD,MSFT 15MAR24 300 P,"2024-03-22, 09:30:00",-2,300.00,300.00,60000,-2,-60002,0,0,Ex
Trades,Data,Order,Stocks,USD,TSLA,"2024-03-25, 11:00:00",50,200.00,200.00,-10000,-3,10003,0,0,O
Trades,Data,Order,Stocks,USD,TSLA,"2024-03-25, 11:00:00",25,200.00,200.00,-5000,-2,5002,0,0,P
Trades,Data,Order,Stocks,USD,TSLA,"2024-03-25, 11:05:00",25,201.00,201.00,-5025,-2,5027,0,0,P
Trades,Data,Order,Forex,USD,EUR.USD,"2024-03-26, 09:30:00",1000,1.0850,1.0850,-1085,-2,1087,0,0,O
Trades,Data,Order,Forex,USD,GBP.USD,"2024-03-26, 10:15:00",500,1.2650,1.2650,-632.50,-1,633.50,0,0,O
Deposits & Withdrawals,Header,Currency,Settle Date,Description,Amount
Deposits & Withdrawals,Data,USD,2024-01-15,Electronic Fund Transfer,50000
Deposits & Withdrawals,Data,USD,2024-12-15,Wire Transfer Out,-10000
Fees,Header,Subtitle,Currency,Date,Description,Amount
Fees,Data,Other Fees,USD,2024-03-31,Monthly Account Fee,-25
Interest,Header,Currency,Date,Description,Amount
Interest,Data,USD,2024-03-31,USD Credit Interest for Mar-2024,50
Dividends,Header,Currency,Date,Description,Amount,Symbol
Dividends,Data,USD,2024-03-15,AAPL Dividend,150,AAPL
Dividends,Data,USD,2024-06-15,MSFT Dividend,200,MSFT
Withholding Tax,Header,Currency,Date,Description,Amount,Symbol
Withholding Tax,Data,USD,2024-03-15,AAPL Dividend Tax,-22.50,AAPL
Withholding Tax,Data,USD,2024-06-15,MSFT Dividend Tax,-30.00,MSFT
Corporate Actions,Header,Currency,Date,Description,Amount,Symbol
Corporate Actions,Data,USD,2024-05-15,AAPL Stock Split 4:1,0,AAPL
Corporate Actions,Data,USD,2024-08-15,MSFT Stock Split 2:1,0,MSFT
Financial Instrument Information,Header,Symbol,Description,Asset Category,Currency,Multiplier
Financial Instrument Information,Data,AAPL,Apple Inc,Stocks,USD,1
Financial Instrument Information,Data,MSFT,Microsoft Corporation,Stocks,USD,1
Codes,Header,Code,Description
Codes,Data,O,Opening Trade
Codes,Data,C,Closing Trade
Codes,Data,A,Assignment
Codes,Data,P,Partial Execution
Codes,Data,Ex,Exercise`;

describe('IBKRCSVParser', () => {
  let parser: IBKRCSVParser;

  beforeEach(() => {
    parser = new IBKRCSVParser(sampleIBKRCSV);
  });

  describe('parse', () => {
    it('should parse the CSV file correctly', () => {
      const result = parser.parse();

      expect(result).toBeDefined();
      expect(result.trades).toBeDefined();
      expect(result.cashTransactions).toBeDefined();
      expect(result.fees).toBeDefined();
      expect(result.interest).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should extract metadata correctly', () => {
      const result = parser.parse();

      expect(result.metadata.accountId).toBe('U12345678');
      expect(result.metadata.baseCurrency).toBe('USD');
      expect(result.metadata.statementPeriod).toBe('January 1, 2024 - December 31, 2024');
      expect(result.metadata.timezone).toBe('EST');
    });

    it('should parse trades correctly', () => {
      const result = parser.parse();

      expect(result.trades).toHaveLength(11); // 9 original + 2 Forex trades
      
      const stockTrade = result.trades[0];
      expect(stockTrade.symbol).toBe('AAPL');
      expect(stockTrade.assetCategory).toBe('Stocks');
      expect(stockTrade.quantity).toBe(100);
      expect(stockTrade.tPrice.amount).toBe(150.00);
      expect(stockTrade.tPrice.currency).toBe('USD');
      expect(stockTrade.proceeds.amount).toBe(-15000);
      expect(stockTrade.proceeds.currency).toBe('USD');
      expect(stockTrade.commFee.amount).toBe(-5);
      expect(stockTrade.commFee.currency).toBe('USD');

      const optionTrade = result.trades[2];
      expect(optionTrade.symbol).toBe('AAPL 15MAR24 150 C');
      expect(optionTrade.assetCategory).toBe('Equity and Index Options');
      expect(optionTrade.quantity).toBe(1);
      expect(optionTrade.tPrice.amount).toBe(5.00);
      expect(optionTrade.tPrice.currency).toBe('USD');
    });

    it('should parse cash transactions correctly', () => {
      const result = parser.parse();

      expect(result.cashTransactions).toHaveLength(2);
      
      const deposit = result.cashTransactions[0];
      expect(deposit.amount.currency).toBe('USD');
      expect(deposit.settleDate).toBe('2024-01-15');
      expect(deposit.description).toBe('Electronic Fund Transfer');
      expect(deposit.amount.amount).toBe(50000);

      const withdrawal = result.cashTransactions[1];
      expect(withdrawal.amount.currency).toBe('USD');
      expect(withdrawal.settleDate).toBe('2024-12-15');
      expect(withdrawal.description).toBe('Wire Transfer Out');
      expect(withdrawal.amount.amount).toBe(-10000);
    });

    it('should parse fees correctly', () => {
      const result = parser.parse();

      expect(result.fees).toHaveLength(1);
      
      const fee = result.fees[0];
      expect(fee.subtitle).toBe('Other Fees');
      expect(fee.amount.currency).toBe('USD');
      expect(fee.date).toBe('2024-03-31');
      expect(fee.description).toBe('Monthly Account Fee');
      expect(fee.amount.amount).toBe(-25);
    });

    it('should parse interest correctly', () => {
      const result = parser.parse();

      expect(result.interest).toHaveLength(1);
      
      const interest = result.interest[0];
      expect(interest.amount.currency).toBe('USD');
      expect(interest.date).toBe('2024-03-31');
      expect(interest.description).toBe('USD Credit Interest for Mar-2024');
      expect(interest.amount.amount).toBe(50);
    });

    it('should parse dividends correctly', () => {
      const result = parser.parse();

      expect(result.dividends).toHaveLength(2);
      
      const dividend1 = result.dividends[0];
      expect(dividend1.amount.currency).toBe('USD');
      expect(dividend1.date).toBe('2024-03-15');
      expect(dividend1.description).toBe('AAPL Dividend');
      expect(dividend1.amount.amount).toBe(150);
      expect(dividend1.symbol).toBe('AAPL');

      const dividend2 = result.dividends[1];
      expect(dividend2.amount.currency).toBe('USD');
      expect(dividend2.date).toBe('2024-06-15');
      expect(dividend2.description).toBe('MSFT Dividend');
      expect(dividend2.amount.amount).toBe(200);
      expect(dividend2.symbol).toBe('MSFT');
    });

    it('should parse withholding tax correctly', () => {
      const result = parser.parse();

      expect(result.withholdingTax).toHaveLength(2);
      
      const tax1 = result.withholdingTax[0];
      expect(tax1.amount.currency).toBe('USD');
      expect(tax1.date).toBe('2024-03-15');
      expect(tax1.description).toBe('AAPL Dividend Tax');
      expect(tax1.amount.amount).toBe(-22.50);
      expect(tax1.symbol).toBe('AAPL');
    });

    it('should parse corporate actions correctly', () => {
      const result = parser.parse();

      expect(result.corporateActions).toHaveLength(2);
      
      const action1 = result.corporateActions[0];
      expect(action1.amount.currency).toBe('USD');
      expect(action1.date).toBe('2024-05-15');
      expect(action1.description).toBe('AAPL Stock Split 4:1');
      expect(action1.amount.amount).toBe(0);
      expect(action1.symbol).toBe('AAPL');
    });

    it('should parse financial instruments correctly', () => {
      const result = parser.parse();

      expect(result.financialInstruments).toHaveLength(2);
      
      const instrument1 = result.financialInstruments[0];
      expect(instrument1.symbol).toBe('AAPL');
      expect(instrument1.description).toBe('Apple Inc');
      expect(instrument1.assetCategory).toBe('Stocks');
      expect(instrument1.currency).toBe('USD');
      expect(instrument1.multiplier).toBe(1);
    });

    it('should parse codes correctly', () => {
      const result = parser.parse();

      expect(result.codes).toHaveLength(5);
      
      const code1 = result.codes[0];
      expect(code1.code).toBe('O');
      expect(code1.description).toBe('Opening Trade');

      const code2 = result.codes[1];
      expect(code2.code).toBe('C');
      expect(code2.description).toBe('Closing Trade');
    });

    it('should extract enhanced metadata correctly', () => {
      const result = parser.parse();

      expect(result.metadata.accountId).toBe('U12345678');
      expect(result.metadata.baseCurrency).toBe('USD');
      expect(result.metadata.statementPeriod).toBe('January 1, 2024 - December 31, 2024');
      expect(result.metadata.timezone).toBe('EST');
      expect(result.metadata.brokerName).toBe('Interactive Brokers LLC');
      expect(result.metadata.title).toBe('Activity Statement');
    });

    it('should handle various trade codes correctly', () => {
      const result = parser.parse();

      expect(result.trades).toHaveLength(11); // 9 original + 2 Forex trades
      
      // Check for different trade types
      const openingTrade = result.trades.find(t => t.code === 'O');
      expect(openingTrade).toBeDefined();
      expect(openingTrade?.dataDiscriminator).toBe('Order');

      const closingTrade = result.trades.find(t => t.code === 'C');
      expect(closingTrade).toBeDefined();
      expect(closingTrade?.dataDiscriminator).toBe('Order');

      const assignmentTrade = result.trades.find(t => t.code === 'A');
      expect(assignmentTrade).toBeDefined();
      expect(assignmentTrade?.dataDiscriminator).toBe('Assignment');

      const exerciseTrade = result.trades.find(t => t.code === 'Ex');
      expect(exerciseTrade).toBeDefined();
      expect(exerciseTrade?.dataDiscriminator).toBe('Exercise');

      const partialTrade = result.trades.find(t => t.code === 'P');
      expect(partialTrade).toBeDefined();
      expect(partialTrade?.dataDiscriminator).toBe('Order');
    });

    it('should identify Forex trades correctly', () => {
      const result = parser.parse();

      const forexTrades = result.trades.filter(trade => 
        trade.assetCategory?.toLowerCase().includes('forex')
      );
      
      expect(forexTrades).toHaveLength(2);
      
      const eurUsdTrade = forexTrades.find(t => t.symbol === 'EUR.USD');
      expect(eurUsdTrade).toBeDefined();
      expect(eurUsdTrade?.assetCategory).toBe('Forex');
      expect(eurUsdTrade?.quantity).toBe(1000);
      expect(eurUsdTrade?.tPrice.amount).toBe(1.09); // Rounded to 2 decimal places
      expect(eurUsdTrade?.tPrice.currency).toBe('USD');

      const gbpUsdTrade = forexTrades.find(t => t.symbol === 'GBP.USD');
      expect(gbpUsdTrade).toBeDefined();
      expect(gbpUsdTrade?.assetCategory).toBe('Forex');
      expect(gbpUsdTrade?.quantity).toBe(500);
      expect(gbpUsdTrade?.tPrice.amount).toBe(1.26); // Rounded to 2 decimal places
      expect(gbpUsdTrade?.tPrice.currency).toBe('USD');
    });
  });

  describe('CSV parsing', () => {
    it('should handle quoted fields correctly', () => {
      const csvWithQuotes = 'Field1,Field2,"Field with, comma",Field4';
      const parser = new IBKRCSVParser(csvWithQuotes);
      const result = parser['parseCSVLine'](csvWithQuotes);
      
      expect(result).toEqual(['Field1', 'Field2', 'Field with, comma', 'Field4']);
    });

    it('should handle escaped quotes correctly', () => {
      const csvWithEscapedQuotes = 'Field1,Field2,"Field with ""quotes""",Field4';
      const parser = new IBKRCSVParser(csvWithEscapedQuotes);
      const result = parser['parseCSVLine'](csvWithEscapedQuotes);
      
      expect(result).toEqual(['Field1', 'Field2', 'Field with "quotes"', 'Field4']);
    });
  });
});

describe('convertIBKRTradesToTransactions', () => {
  let CurrencyAmount: typeof import('../currency-amount').CurrencyAmount;
  let mockTrades: any[];
  
  beforeAll(async () => {
    const currencyModule = await import('../currency-amount');
    CurrencyAmount = currencyModule.CurrencyAmount;
    
    mockTrades = [
    {
      dataDiscriminator: 'Order',
      assetCategory: 'Stocks',
      currency: 'USD',
      symbol: 'AAPL',
      dateTime: '2024-03-15, 10:30:00',
      quantity: 100,
      tPrice: new CurrencyAmount(150.00, 'USD'),
      cPrice: new CurrencyAmount(150.00, 'USD'),
      proceeds: new CurrencyAmount(-15000, 'USD'),
      commFee: new CurrencyAmount(-5, 'USD'),
      basis: new CurrencyAmount(15005, 'USD'),
      realizedPL: new CurrencyAmount(0, 'USD'),
      mtmPL: new CurrencyAmount(0, 'USD'),
      code: 'O'
    },
    {
      dataDiscriminator: 'Order',
      assetCategory: 'Equity and Index Options',
      currency: 'USD',
      symbol: 'AAPL 15MAR24 150 C',
      dateTime: '2024-03-15, 10:35:00',
      quantity: 1,
      tPrice: new CurrencyAmount(5.00, 'USD'),
      cPrice: new CurrencyAmount(5.00, 'USD'),
      proceeds: new CurrencyAmount(-500, 'USD'),
      commFee: new CurrencyAmount(-2, 'USD'),
      basis: new CurrencyAmount(502, 'USD'),
      realizedPL: new CurrencyAmount(0, 'USD'),
      mtmPL: new CurrencyAmount(0, 'USD'),
      code: 'O'
    }
    ];
  });

  it('should convert stock trades correctly', () => {
    const tickerIdMap = { 'AAPL': 'ticker-uuid-123' };
    const transactions = convertIBKRTradesToTransactions(mockTrades, 'account-123', 'user-456', 'EST', tickerIdMap);
    
    expect(transactions).toHaveLength(2);
    
    const stockTransaction = transactions[0];
    expect(stockTransaction.instrument_kind).toBe('SHARES');
    expect(stockTransaction.ticker_id).toBe('ticker-uuid-123');
    expect(stockTransaction.side).toBe('BUY');
    expect(stockTransaction.qty).toBe(100);
    expect(stockTransaction.price).toBe(150.00);
    expect(stockTransaction.fees).toBe(5);
    expect(stockTransaction.user_id).toBe('user-456');
    expect(stockTransaction.account_id).toBe('account-123');
  });

  it('should convert option trades correctly', () => {
    const tickerIdMap = { 'AAPL': 'ticker-uuid-123' };
    const transactions = convertIBKRTradesToTransactions(mockTrades, 'account-123', 'user-456', 'EST', tickerIdMap);
    
    const optionTransaction = transactions[1];
    expect(optionTransaction.instrument_kind).toBe('CALL');
    expect(optionTransaction.ticker_id).toBe('ticker-uuid-123');
    expect(optionTransaction.expiry).toBe('2024-03-15');
    expect(optionTransaction.strike).toBe(150);
    expect(optionTransaction.side).toBe('BUY');
    expect(optionTransaction.qty).toBe(1);
    expect(optionTransaction.price).toBe(5.00);
    expect(optionTransaction.fees).toBe(2);
  });

  it('should handle timezone conversion', () => {
    const tickerIdMap = { 'AAPL': 'ticker-uuid-123' };
    const transactions = convertIBKRTradesToTransactions(mockTrades, 'account-123', 'user-456', 'EST', tickerIdMap);
    
    const transaction = transactions[0];
    expect(transaction.timestamp).toBeDefined();
    expect(new Date(transaction.timestamp).toISOString()).toBeDefined();
  });

  it('should throw error for missing account ID', () => {
    expect(() => {
      convertIBKRTradesToTransactions(mockTrades, '', 'user-456', 'EST', {});
    }).toThrow('Account ID and User ID are required for transaction conversion');
  });

  it('should throw error for missing user ID', () => {
    expect(() => {
      convertIBKRTradesToTransactions(mockTrades, 'account-123', '', 'EST', {});
    }).toThrow('Account ID and User ID are required for transaction conversion');
  });

  it('should ignore Forex transactions', () => {
    const tradesWithForex = [
      ...mockTrades,
      {
        dataDiscriminator: 'Order',
        assetCategory: 'Forex',
        currency: 'USD',
        symbol: 'EUR.USD',
        dateTime: '2024-03-15, 10:30:00',
        quantity: 1000,
        tPrice: new CurrencyAmount(1.0850, 'USD'),
        cPrice: new CurrencyAmount(1.0850, 'USD'),
        proceeds: new CurrencyAmount(-1085, 'USD'),
        commFee: new CurrencyAmount(-2, 'USD'),
        basis: new CurrencyAmount(1087, 'USD'),
        realizedPL: new CurrencyAmount(0, 'USD'),
        mtmPL: new CurrencyAmount(0, 'USD'),
        code: 'O'
      }
    ];

    const transactions = convertIBKRTradesToTransactions(tradesWithForex, 'account-123', 'user-456', 'EST', {});
    
    // Should only have the original 2 transactions, Forex should be filtered out
    expect(transactions).toHaveLength(2);
    
    // Verify no Forex transactions are present
    const forexTransactions = transactions.filter(t => t.memo?.includes('Forex'));
    expect(forexTransactions).toHaveLength(0);
  });
});

describe('convertIBKRCashToTransactions', () => {
  let CurrencyAmount: typeof import('../currency-amount').CurrencyAmount;
  let mockCashTransactions: any[];
  
  beforeAll(async () => {
    const currencyModule = await import('../currency-amount');
    CurrencyAmount = currencyModule.CurrencyAmount;
    
    mockCashTransactions = [
    {
      currency: 'USD',
      settleDate: '2024-01-15',
      description: 'Electronic Fund Transfer',
      amount: new CurrencyAmount(50000, 'USD')
    },
    {
      currency: 'USD',
      settleDate: '2024-12-15',
      description: 'Wire Transfer Out',
      amount: new CurrencyAmount(-10000, 'USD')
    }
    ];
  });

  it('should convert cash transactions correctly', () => {
    const transactions = convertIBKRCashToTransactions(mockCashTransactions, 'account-123', 'user-456');
    
    expect(transactions).toHaveLength(2);
    
    const deposit = transactions[0];
    expect(deposit.instrument_kind).toBe('CASH');
    expect(deposit.side).toBe('BUY');
    expect(deposit.qty).toBe(50000);
    expect(deposit.price).toBe(1);
    expect(deposit.fees).toBe(0);
    expect(deposit.memo).toContain('Electronic Fund Transfer');
    
    const withdrawal = transactions[1];
    expect(withdrawal.side).toBe('SELL');
    expect(withdrawal.qty).toBe(10000);
  });

  it('should determine transaction side based on amount', () => {
    const transactions = convertIBKRCashToTransactions(mockCashTransactions, 'account-123', 'user-456');
    
    expect(transactions[0].side).toBe('BUY'); // Positive amount
    expect(transactions[1].side).toBe('SELL'); // Negative amount
  });
});

describe('convertIBKRDividendsToTransactions', () => {
  let CurrencyAmount: typeof import('../currency-amount').CurrencyAmount;
  let mockDividends: any[];
  
  beforeAll(async () => {
    const currencyModule = await import('../currency-amount');
    CurrencyAmount = currencyModule.CurrencyAmount;
    
    mockDividends = [
    {
      currency: 'USD',
      date: '2024-03-15',
      description: 'AAPL Dividend',
      amount: new CurrencyAmount(150, 'USD'),
      symbol: 'AAPL'
    },
    {
      currency: 'USD',
      date: '2024-06-15',
      description: 'MSFT Dividend',
      amount: new CurrencyAmount(200, 'USD'),
      symbol: 'MSFT'
    }
    ];
  });

  it('should convert dividends correctly', () => {
    const transactions = convertIBKRDividendsToTransactions(mockDividends, 'account-123', 'user-456', {});
    
    expect(transactions).toHaveLength(2);
    
    const dividend1 = transactions[0];
    expect(dividend1.instrument_kind).toBe('CASH');
    expect(dividend1.side).toBe('BUY');
    expect(dividend1.qty).toBe(150);
    expect(dividend1.price).toBe(1);
    expect(dividend1.fees).toBe(0);
    expect(dividend1.memo).toContain('Dividend: AAPL Dividend (AAPL)');
    
    const dividend2 = transactions[1];
    expect(dividend2.side).toBe('BUY');
    expect(dividend2.qty).toBe(200);
    expect(dividend2.memo).toContain('Dividend: MSFT Dividend (MSFT)');
  });

  it('should handle dividends without symbol', () => {
    const dividendsWithoutSymbol = [    {
      currency: 'USD',
      date: '2024-03-15',
      description: 'General Dividend',
      amount: new CurrencyAmount(100, 'USD')
    }];

    const transactions = convertIBKRDividendsToTransactions(dividendsWithoutSymbol, 'account-123', 'user-456', {});
    
    expect(transactions[0].memo).toContain('Dividend: General Dividend (USD)');
  });
});

describe('convertIBKRWithholdingTaxToTransactions', () => {
  let CurrencyAmount: typeof import('../currency-amount').CurrencyAmount;
  let mockWithholdingTax: any[];
  
  beforeAll(async () => {
    const currencyModule = await import('../currency-amount');
    CurrencyAmount = currencyModule.CurrencyAmount;
    
    mockWithholdingTax = [
    {
      currency: 'USD',
      date: '2024-03-15',
      description: 'AAPL Dividend Tax',
      amount: new CurrencyAmount(-22.50, 'USD'),
      symbol: 'AAPL'
    }
    ];
  });

  it('should convert withholding tax correctly', () => {
    const transactions = convertIBKRWithholdingTaxToTransactions(mockWithholdingTax, 'account-123', 'user-456', {});
    
    expect(transactions).toHaveLength(1);
    
    const tax = transactions[0];
    expect(tax.instrument_kind).toBe('CASH');
    expect(tax.side).toBe('SELL'); // Withholding tax is always an outflow
    expect(tax.qty).toBe(22.50);
    expect(tax.price).toBe(1);
    expect(tax.fees).toBe(0);
    expect(tax.memo).toContain('Withholding Tax: AAPL Dividend Tax (AAPL)');
  });
});

describe('convertIBKRCorporateActionsToTransactions', () => {
  let CurrencyAmount: typeof import('../currency-amount').CurrencyAmount;
  let mockCorporateActions: any[];
  
  beforeAll(async () => {
    const currencyModule = await import('../currency-amount');
    CurrencyAmount = currencyModule.CurrencyAmount;
    
    mockCorporateActions = [
    {
      currency: 'USD',
      date: '2024-05-15',
      description: 'AAPL Stock Split 4:1',
      amount: new CurrencyAmount(0, 'USD'),
      symbol: 'AAPL'
    },
    {
      currency: 'USD',
      date: '2024-08-15',
      description: 'MSFT Special Dividend',
      amount: new CurrencyAmount(500, 'USD'),
      symbol: 'MSFT'
    },
    {
      currency: 'USD',
      date: '2024-11-15',
      description: 'GOOGL Stock Buyback',
      amount: new CurrencyAmount(-1000, 'USD'),
      symbol: 'GOOGL'
    }
    ];
  });

  it('should convert corporate actions correctly', () => {
    const transactions = convertIBKRCorporateActionsToTransactions(mockCorporateActions, 'account-123', 'user-456', {});
    
    expect(transactions).toHaveLength(3);
    
    const action1 = transactions[0];
    expect(action1.instrument_kind).toBe('CASH');
    expect(action1.side).toBe('BUY'); // Zero amount defaults to BUY
    expect(action1.qty).toBe(0);
    expect(action1.memo).toContain('Corporate Action: AAPL Stock Split 4:1 (AAPL)');
    
    const action2 = transactions[1];
    expect(action2.side).toBe('BUY'); // Positive amount
    expect(action2.qty).toBe(500);
    
    const action3 = transactions[2];
    expect(action3.side).toBe('SELL'); // Negative amount
    expect(action3.qty).toBe(1000);
  });
});

describe('extractTickerNamesFromIBKRData', () => {
  it('should extract ticker names from trades and ignore Forex transactions', () => {
    const trades = [
      {
        dataDiscriminator: 'Order',
        assetCategory: 'Stocks',
        currency: 'USD',
        symbol: 'AAPL',
        dateTime: '2024-03-15, 10:30:00',
        quantity: 100,
        tPrice: 150.00,
        cPrice: 150.00,
        proceeds: -15000,
        commFee: -5,
        basis: 15005,
        realizedPL: 0,
        mtmPL: 0,
        code: 'O'
      },
      {
        dataDiscriminator: 'Order',
        assetCategory: 'Forex',
        currency: 'USD',
        symbol: 'EUR.USD',
        dateTime: '2024-03-15, 10:30:00',
        quantity: 1000,
        tPrice: 1.0850,
        cPrice: 1.0850,
        proceeds: -1085,
        commFee: -2,
        basis: 1087,
        realizedPL: 0,
        mtmPL: 0,
        code: 'O'
      }
    ];

    const dividends = [
      {
        currency: 'USD',
        date: '2024-03-15',
        description: 'AAPL Dividend',
        amount: 150,
        symbol: 'AAPL'
      }
    ];

    const tickerNames = extractTickerNamesFromIBKRData(trades, [], [], [], dividends, [], []);

    // Should only include AAPL (from stocks and dividends), not EUR.USD from Forex
    expect(tickerNames).toEqual(['AAPL']);
    expect(tickerNames).not.toContain('EUR.USD');
  });
});

describe('Trade vs Transaction Count Consistency', () => {
  it('should maintain consistent counts between raw trades and converted transactions', () => {
    // Use the sample CSV data which includes Forex trades
    const parser = new IBKRCSVParser(sampleIBKRCSV);
    const result = parser.parse();
    
    // Count raw trades (including Forex)
    const totalRawTrades = result.trades.length;
    expect(totalRawTrades).toBe(11); // 9 original + 2 Forex
    
    // Count non-Forex trades
    const nonForexTrades = result.trades.filter(trade => 
      !trade.assetCategory?.toLowerCase().includes('forex')
    );
    expect(nonForexTrades).toHaveLength(9);
    
    // Convert trades to transactions (should filter out Forex)
    const tickerIdMap = { 'AAPL': 'ticker-1', 'MSFT': 'ticker-2', 'TSLA': 'ticker-3' };
    const tradeTransactions = convertIBKRTradesToTransactions(
      result.trades,
      'account-123',
      'user-456',
      'EST',
      tickerIdMap
    );
    
    // Count converted transactions (should exclude Forex)
    expect(tradeTransactions).toHaveLength(9);
    
    // Verify the counts are consistent
    expect(tradeTransactions.length).toBe(nonForexTrades.length);
    expect(tradeTransactions.length).toBeLessThan(totalRawTrades);
    
    // Verify no Forex transactions were converted
    const forexTransactions = tradeTransactions.filter(t => 
      t.memo?.includes('Forex')
    );
    expect(forexTransactions).toHaveLength(0);
  });

  it('should handle mixed asset categories correctly', () => {
    const mixedTrades = [
      {
        dataDiscriminator: 'Order',
        assetCategory: 'Stocks',
        currency: 'USD',
        symbol: 'AAPL',
        dateTime: '2024-03-15, 10:30:00',
        quantity: 100,
        tPrice: 150.00,
        cPrice: 150.00,
        proceeds: -15000,
        commFee: -5,
        basis: 15005,
        realizedPL: 0,
        mtmPL: 0,
        code: 'O'
      },
      {
        dataDiscriminator: 'Order',
        assetCategory: 'Equity and Index Options',
        currency: 'USD',
        symbol: 'AAPL 15MAR24 150 C',
        dateTime: '2024-03-15, 10:35:00',
        quantity: 1,
        tPrice: 5.00,
        cPrice: 5.00,
        proceeds: -500,
        commFee: -2,
        basis: 502,
        realizedPL: 0,
        mtmPL: 0,
        code: 'O'
      },
      {
        dataDiscriminator: 'Order',
        assetCategory: 'Forex',
        currency: 'USD',
        symbol: 'EUR.USD',
        dateTime: '2024-03-15, 10:30:00',
        quantity: 1000,
        tPrice: 1.0850,
        cPrice: 1.0850,
        proceeds: -1085,
        commFee: -2,
        basis: 1087,
        realizedPL: 0,
        mtmPL: 0,
        code: 'O'
      },
      {
        dataDiscriminator: 'Order',
        assetCategory: 'Forex',
        currency: 'USD',
        symbol: 'GBP.USD',
        dateTime: '2024-03-15, 10:30:00',
        quantity: 500,
        tPrice: 1.2650,
        cPrice: 1.2650,
        proceeds: -632.50,
        commFee: -1,
        basis: 633.50,
        realizedPL: 0,
        mtmPL: 0,
        code: 'O'
      }
    ];

    const tickerIdMap = { 'AAPL': 'ticker-1' };
    const transactions = convertIBKRTradesToTransactions(
      mixedTrades,
      'account-123',
      'user-456',
      'EST',
      tickerIdMap
    );

    // Should have 2 transactions (stocks + options), not 4 (excluding 2 Forex)
    expect(transactions).toHaveLength(2);
    
    // Verify we have the expected transaction types
    const stockTransaction = transactions.find(t => t.instrument_kind === 'SHARES');
    const optionTransaction = transactions.find(t => t.instrument_kind === 'CALL');
    
    expect(stockTransaction).toBeDefined();
    expect(optionTransaction).toBeDefined();
    
    // Verify no Forex transactions
    const forexTransactions = transactions.filter(t => 
      t.memo?.includes('Forex')
    );
    expect(forexTransactions).toHaveLength(0);
  });
});
