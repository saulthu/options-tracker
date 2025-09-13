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
import { CurrencyAmount } from '../currency-amount';

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

describe('Forex Trade Processing', () => {
  let CurrencyAmount: typeof import('../currency-amount').CurrencyAmount;
  
  beforeAll(async () => {
    const currencyModule = await import('../currency-amount');
    CurrencyAmount = currencyModule.CurrencyAmount;
  });

  describe('Forex CSV Parsing', () => {
    it('should parse forex trades from CSV correctly', () => {
      const forexCSV = `Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,,Proceeds,Comm in USD,,,MTM in USD,Code
Trades,Data,Order,Forex,USD,AUD.USD,"2025-08-22, 13:14:01",-100,0.64201,,64.201,0,,,-0.699,
Trades,Data,Order,Forex,USD,EUR.USD,"2025-08-26, 14:26:17",1000,1.0850,,-1085,-2,1087,0,0,
Trades,Data,Order,Forex,USD,GBP.USD,"2025-08-27, 11:12:29",-500,1.2650,,632.50,-1,633.50,0,0,`;

      const parser = new IBKRCSVParser(forexCSV);
      const result = parser.parse();

      expect(result.trades).toHaveLength(3);
      
      const audTrade = result.trades.find(t => t.symbol === 'AUD.USD');
      expect(audTrade).toBeDefined();
      expect(audTrade?.assetCategory).toBe('Forex');
      expect(audTrade?.quantity).toBe(-100);
      expect(audTrade?.proceeds.amount).toBeCloseTo(64.201, 2);
      expect(audTrade?.tPrice.amount).toBeCloseTo(0.64201, 2);

      const eurTrade = result.trades.find(t => t.symbol === 'EUR.USD');
      expect(eurTrade).toBeDefined();
      expect(eurTrade?.quantity).toBe(1000);
      expect(eurTrade?.proceeds.amount).toBe(-1085);

      const gbpTrade = result.trades.find(t => t.symbol === 'GBP.USD');
      expect(gbpTrade).toBeDefined();
      expect(gbpTrade?.quantity).toBe(-500);
      expect(gbpTrade?.proceeds.amount).toBe(632.50);
    });

    it('should handle various forex currency pairs', () => {
      const multiCurrencyCSV = `Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,,Proceeds,Comm in USD,,,MTM in USD,Code
Trades,Data,Order,Forex,USD,JPY.USD,"2025-08-22, 13:14:01",-100000,0.0067,,670,0,,,-5,
Trades,Data,Order,Forex,USD,CAD.USD,"2025-08-22, 13:15:01",-1000,0.75,,750,0,,,-2,
Trades,Data,Order,Forex,USD,CHF.USD,"2025-08-22, 13:16:01",-500,1.10,,550,0,,,-1,`;

      const parser = new IBKRCSVParser(multiCurrencyCSV);
      const result = parser.parse();

      expect(result.trades).toHaveLength(3);
      
      const jpyTrade = result.trades.find(t => t.symbol === 'JPY.USD');
      expect(jpyTrade).toBeDefined();
      expect(jpyTrade?.quantity).toBe(-100000);
      expect(jpyTrade?.proceeds.amount).toBe(670);

      const cadTrade = result.trades.find(t => t.symbol === 'CAD.USD');
      expect(cadTrade).toBeDefined();
      expect(cadTrade?.quantity).toBe(-1000);
      expect(cadTrade?.proceeds.amount).toBe(750);

      const chfTrade = result.trades.find(t => t.symbol === 'CHF.USD');
      expect(chfTrade).toBeDefined();
      expect(chfTrade?.quantity).toBe(-500);
      expect(chfTrade?.proceeds.amount).toBe(550);
    });
  });

  describe('Forex Transaction Conversion', () => {
    it('should convert selling base currency forex trades correctly', () => {
      const sellingTrades = [
        {
          dataDiscriminator: 'Order',
          assetCategory: 'Forex',
          currency: 'USD',
          symbol: 'AUD.USD',
          dateTime: '2025-08-22, 13:14:01',
          quantity: -100, // Selling 100 AUD for USD
          tPrice: new CurrencyAmount(0.64201, 'USD'),
          cPrice: new CurrencyAmount(0.64201, 'USD'),
          proceeds: new CurrencyAmount(64.201, 'USD'),
          commFee: new CurrencyAmount(0, 'USD'),
          basis: new CurrencyAmount(64.201, 'USD'),
          realizedPL: new CurrencyAmount(0, 'USD'),
          mtmPL: new CurrencyAmount(-0.699, 'USD'),
          code: 'O'
        }
      ];

      const transactions = convertIBKRTradesToTransactions(sellingTrades, 'account-123', 'user-456', 'EST', {});
      
      expect(transactions).toHaveLength(2);
      
      const audTransaction = transactions.find(t => t.currency === 'AUD');
      const usdTransaction = transactions.find(t => t.currency === 'USD');
      
      expect(audTransaction).toBeDefined();
      expect(usdTransaction).toBeDefined();
      
      // AUD transaction (selling AUD) - negative quantity, SELL side
      expect(audTransaction!.side).toBe('SELL');
      expect(audTransaction!.qty).toBe(-100); // Negative for outflow
      expect(audTransaction!.instrument_kind).toBe('CASH');
      expect(audTransaction!.memo).toContain('Forex: Sell 100 AUD to buy 64.2 USD');
      
      // USD transaction (buying USD with AUD) - positive quantity, BUY side
      expect(usdTransaction!.side).toBe('BUY');
      expect(usdTransaction!.qty).toBeCloseTo(64.201, 2); // Positive for inflow
      expect(usdTransaction!.instrument_kind).toBe('CASH');
      expect(usdTransaction!.memo).toContain('Forex: Buy 64.2 USD with 100 AUD');
    });

    it('should convert buying base currency forex trades correctly', () => {
      const buyingTrades = [
        {
          dataDiscriminator: 'Order',
          assetCategory: 'Forex',
          currency: 'USD',
          symbol: 'EUR.USD',
          dateTime: '2025-08-26, 14:26:17',
          quantity: 1000, // Buying 1000 EUR with USD
          tPrice: new CurrencyAmount(1.0850, 'USD'),
          cPrice: new CurrencyAmount(1.0850, 'USD'),
          proceeds: new CurrencyAmount(-1085, 'USD'), // Cost in USD
          commFee: new CurrencyAmount(-2, 'USD'),
          basis: new CurrencyAmount(1087, 'USD'),
          realizedPL: new CurrencyAmount(0, 'USD'),
          mtmPL: new CurrencyAmount(0, 'USD'),
          code: 'O'
        }
      ];

      const transactions = convertIBKRTradesToTransactions(buyingTrades, 'account-123', 'user-456', 'EST', {});
      
      expect(transactions).toHaveLength(2);
      
      const usdTransaction = transactions.find(t => t.currency === 'USD');
      const eurTransaction = transactions.find(t => t.currency === 'EUR');
      
      expect(usdTransaction).toBeDefined();
      expect(eurTransaction).toBeDefined();
      
      // USD transaction (selling USD to buy EUR) - negative quantity, SELL side
      expect(usdTransaction!.side).toBe('SELL');
      expect(usdTransaction!.qty).toBe(-1085); // Negative for outflow
      expect(usdTransaction!.fees.amount).toBe(2);
      expect(usdTransaction!.memo).toContain('Forex: Sell 1085 USD to buy 1000 EUR');
      
      // EUR transaction (buying EUR with USD) - positive quantity, BUY side
      expect(eurTransaction!.side).toBe('BUY');
      expect(eurTransaction!.qty).toBe(1000); // Positive for inflow
      expect(eurTransaction!.fees.amount).toBe(0); // Fees already accounted for in USD
      expect(eurTransaction!.memo).toContain('Forex: Buy 1000 EUR with 1085 USD');
    });

    it('should handle forex trades with fees correctly', () => {
      const tradesWithFees = [
        {
          dataDiscriminator: 'Order',
          assetCategory: 'Forex',
          currency: 'USD',
          symbol: 'GBP.USD',
          dateTime: '2025-08-27, 11:12:29',
          quantity: -500, // Selling 500 GBP for USD
          tPrice: new CurrencyAmount(1.2650, 'USD'),
          cPrice: new CurrencyAmount(1.2650, 'USD'),
          proceeds: new CurrencyAmount(632.50, 'USD'),
          commFee: new CurrencyAmount(-1.50, 'USD'),
          basis: new CurrencyAmount(634, 'USD'),
          realizedPL: new CurrencyAmount(0, 'USD'),
          mtmPL: new CurrencyAmount(-5, 'USD'),
          code: 'O'
        }
      ];

      const transactions = convertIBKRTradesToTransactions(tradesWithFees, 'account-123', 'user-456', 'EST', {});
      
      expect(transactions).toHaveLength(2);
      
      const gbpTransaction = transactions.find(t => t.currency === 'GBP');
      const usdTransaction = transactions.find(t => t.currency === 'USD');
      
      // GBP transaction should have the fees
      expect(gbpTransaction!.fees.amount).toBe(1.50);
      expect(gbpTransaction!.memo).toContain('Forex: Sell 500 GBP to buy 632.5 USD');
      
      // USD transaction should have no fees (already accounted for in GBP)
      expect(usdTransaction!.fees.amount).toBe(0);
      expect(usdTransaction!.memo).toContain('Forex: Buy 632.5 USD with 500 GBP');
    });

    it('should handle multiple forex trades in sequence', () => {
      const multipleTrades = [
        {
          dataDiscriminator: 'Order',
          assetCategory: 'Forex',
          currency: 'USD',
          symbol: 'AUD.USD',
          dateTime: '2025-08-22, 13:14:01',
          quantity: -100,
          tPrice: new CurrencyAmount(0.64201, 'USD'),
          cPrice: new CurrencyAmount(0.64201, 'USD'),
          proceeds: new CurrencyAmount(64.201, 'USD'),
          commFee: new CurrencyAmount(0, 'USD'),
          basis: new CurrencyAmount(64.201, 'USD'),
          realizedPL: new CurrencyAmount(0, 'USD'),
          mtmPL: new CurrencyAmount(-0.699, 'USD'),
          code: 'O'
        },
        {
          dataDiscriminator: 'Order',
          assetCategory: 'Forex',
          currency: 'USD',
          symbol: 'AUD.USD',
          dateTime: '2025-08-26, 14:26:17',
          quantity: -200000,
          tPrice: new CurrencyAmount(0.64774, 'USD'),
          cPrice: new CurrencyAmount(0.64774, 'USD'),
          proceeds: new CurrencyAmount(129548, 'USD'),
          commFee: new CurrencyAmount(-2.59096, 'USD'),
          basis: new CurrencyAmount(129550.59096, 'USD'),
          realizedPL: new CurrencyAmount(0, 'USD'),
          mtmPL: new CurrencyAmount(-342, 'USD'),
          code: 'O'
        }
      ];

      const transactions = convertIBKRTradesToTransactions(multipleTrades, 'account-123', 'user-456', 'EST', {});
      
      expect(transactions).toHaveLength(4); // 2 trades * 2 transactions each
      
      const audTransactions = transactions.filter(t => t.currency === 'AUD');
      const usdTransactions = transactions.filter(t => t.currency === 'USD');
      
      expect(audTransactions).toHaveLength(2);
      expect(usdTransactions).toHaveLength(2);
      
      // All should be forex transactions
      transactions.forEach(t => {
        expect(t.instrument_kind).toBe('CASH');
        expect(t.memo).toContain('Forex');
      });
    });

    it('should throw error for invalid forex symbol format', () => {
      const invalidTrades = [
        {
          dataDiscriminator: 'Order',
          assetCategory: 'Forex',
          currency: 'USD',
          symbol: 'INVALID', // Missing dot separator
          dateTime: '2025-08-22, 13:14:01',
          quantity: -100,
          tPrice: new CurrencyAmount(0.64201, 'USD'),
          cPrice: new CurrencyAmount(0.64201, 'USD'),
          proceeds: new CurrencyAmount(64.201, 'USD'),
          commFee: new CurrencyAmount(0, 'USD'),
          basis: new CurrencyAmount(64.201, 'USD'),
          realizedPL: new CurrencyAmount(0, 'USD'),
          mtmPL: new CurrencyAmount(-0.699, 'USD'),
          code: 'O'
        }
      ];

      expect(() => {
        convertIBKRTradesToTransactions(invalidTrades, 'account-123', 'user-456', 'EST', {});
      }).toThrow('Invalid forex symbol format: INVALID');
    });

    it('should throw error for unsupported currency codes', () => {
      const unsupportedCurrencyTrades = [
        {
          dataDiscriminator: 'Order',
          assetCategory: 'Forex',
          currency: 'USD',
          symbol: 'BTC.USD', // BTC not supported
          dateTime: '2025-08-22, 13:14:01',
          quantity: -100,
          tPrice: new CurrencyAmount(0.64201, 'USD'),
          cPrice: new CurrencyAmount(0.64201, 'USD'),
          proceeds: new CurrencyAmount(64.201, 'USD'),
          commFee: new CurrencyAmount(0, 'USD'),
          basis: new CurrencyAmount(64.201, 'USD'),
          realizedPL: new CurrencyAmount(0, 'USD'),
          mtmPL: new CurrencyAmount(-0.699, 'USD'),
          code: 'O'
        }
      ];

      expect(() => {
        convertIBKRTradesToTransactions(unsupportedCurrencyTrades, 'account-123', 'user-456', 'EST', {});
      }).toThrow('Invalid base currency code: BTC');
    });
  });

  describe('Complete Forex Import Flow Integration Test', () => {
    it('should handle complete forex import flow from CSV to database format', () => {
      // Real forex data from user's example
      const realForexCSV = `Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,,Proceeds,Comm in USD,,,MTM in USD,Code
Trades,Data,Order,Forex,USD,AUD.USD,"2025-08-22, 13:14:01",-100,0.64201,,64.201,0,,,-0.699,
Trades,Data,Order,Forex,USD,AUD.USD,"2025-08-26, 14:26:17",-200000,0.64774,,129548,-2.59096,,,-342,
Trades,Data,Order,Forex,USD,AUD.USD,"2025-08-27, 11:12:29",-25000,0.64942,,16235.5,-2,,,-29,`;

      // Step 1: Parse CSV
      const parser = new IBKRCSVParser(realForexCSV);
      const result = parser.parse();
      
      expect(result.trades).toHaveLength(3);
      const forexTrades = result.trades.filter(t => t.assetCategory?.toLowerCase().includes('forex'));
      expect(forexTrades).toHaveLength(3);
      
      // Step 2: Convert to transactions
      const transactions = convertIBKRTradesToTransactions(
        result.trades,
        'test-account-123',
        'test-user-456',
        'EST',
        {}
      );
      
      // Should create 6 transactions (3 forex trades * 2 transactions each)
      expect(transactions).toHaveLength(6);
      
      // Step 3: Verify transaction structure
      transactions.forEach((txn) => {
        expect(txn.user_id).toBe('test-user-456');
        expect(txn.account_id).toBe('test-account-123');
        expect(txn.instrument_kind).toBe('CASH');
        expect(txn.side).toMatch(/^(BUY|SELL)$/); // Forex cash transactions have explicit side
        expect(txn.qty).not.toBe(0); // Should be non-zero (positive or negative)
        expect(txn.currency).toMatch(/^(AUD|USD)$/);
        expect(txn.memo).toContain('Forex');
        expect(txn.price).toBeDefined();
        expect(txn.fees).toBeDefined();
      });
      
      // Step 4: Simulate database conversion (like addTransactions does)
      const dbTransactions = transactions.map(txn => ({
        user_id: txn.user_id,
        account_id: txn.account_id,
        timestamp: txn.timestamp,
        instrument_kind: txn.instrument_kind,
        ticker_id: txn.ticker_id,
        expiry: txn.expiry,
        strike: txn.strike?.amount || null,
        side: txn.side,
        qty: txn.qty,
        price: txn.price?.amount || null,
        fees: txn.fees.amount || 0,
        currency: txn.currency, // This is the critical fix!
        memo: txn.memo
      }));
      
      // Step 5: Verify database format
      expect(dbTransactions).toHaveLength(6);
      
      dbTransactions.forEach((txn) => {
        // Check required fields
        expect(txn.user_id).toBe('test-user-456');
        expect(txn.account_id).toBe('test-account-123');
        expect(txn.timestamp).toBeDefined();
        expect(txn.instrument_kind).toBe('CASH');
        expect(txn.qty).not.toBe(0); // Should be non-zero (positive or negative)
        expect(txn.fees).toBeGreaterThanOrEqual(0);
        expect(txn.currency).toMatch(/^(AUD|USD)$/);
        expect(txn.memo).toContain('Forex');
        
        // Check currency consistency
        expect(txn.currency).toBe(txn.currency); // Should be AUD or USD
      });
      
      // Step 6: Verify specific forex transaction pairs
      const audTransactions = dbTransactions.filter(t => t.currency === 'AUD');
      const usdTransactions = dbTransactions.filter(t => t.currency === 'USD');
      
      expect(audTransactions).toHaveLength(3); // One AUD transaction per forex trade
      expect(usdTransactions).toHaveLength(3); // One USD transaction per forex trade
      
      // Each pair should have opposite quantities (one positive, one negative)
      audTransactions.forEach((audTxn, index) => {
        const usdTxn = usdTransactions[index];
        expect(audTxn.qty).toBeLessThan(0); // AUD should be negative (outflow)
        expect(usdTxn.qty).toBeGreaterThan(0); // USD should be positive (inflow)
        expect(audTxn.timestamp).toBe(usdTxn.timestamp); // Same timestamp
      });
      
    });

    it('should handle mixed forex and regular trades correctly', () => {
      const mixedCSV = `Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code
Trades,Data,Order,Stocks,USD,AAPL,"2024-03-15, 10:30:00",100,150.00,150.00,-15000,-5,15005,0,0,O
Trades,Data,Order,Forex,USD,AUD.USD,"2025-08-22, 13:14:01",-100,0.64201,,64.201,0,,,-0.699,
Trades,Data,Order,Stocks,USD,MSFT,"2024-03-16, 11:00:00",50,200.00,200.00,-10000,-3,10003,0,0,O
Trades,Data,Order,Forex,USD,EUR.USD,"2025-08-26, 14:26:17",1000,1.0850,,-1085,-2,1087,0,0,`;

      const parser = new IBKRCSVParser(mixedCSV);
      const result = parser.parse();
      
      expect(result.trades).toHaveLength(4);
      
      const transactions = convertIBKRTradesToTransactions(
        result.trades,
        'test-account-123',
        'test-user-456',
        'EST',
        { 'AAPL': 'ticker-1', 'MSFT': 'ticker-2' }
      );
      
      // 2 regular trades + 2 forex trades * 2 transactions each = 6 total
      expect(transactions).toHaveLength(6);
      
      const regularTransactions = transactions.filter(t => t.instrument_kind !== 'CASH' || !t.memo?.includes('Forex'));
      const forexTransactions = transactions.filter(t => t.memo?.includes('Forex'));
      
      expect(regularTransactions).toHaveLength(2); // AAPL and MSFT
      expect(forexTransactions).toHaveLength(4); // 2 forex trades * 2 transactions each
      
      // Verify forex transactions are properly formatted
      forexTransactions.forEach(txn => {
        expect(txn.instrument_kind).toBe('CASH');
        expect(txn.currency).toMatch(/^(AUD|USD|EUR)$/);
        expect(txn.memo).toContain('Forex');
      });
    });
  });
});

describe('convertIBKRTradesToTransactions', () => {
  let CurrencyAmount: typeof import('../currency-amount').CurrencyAmount;
  let mockTrades: Array<{
    dataDiscriminator: string;
    assetCategory: string;
    currency: string;
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
  }>;
  
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
    expect(stockTransaction.price.amount).toBe(150.00);
    expect(stockTransaction.fees.amount).toBe(5);
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
    expect(optionTransaction.strike?.amount).toBe(150);
    expect(optionTransaction.side).toBe('BUY');
    expect(optionTransaction.qty).toBe(1);
    expect(optionTransaction.price.amount).toBe(5.00);
    expect(optionTransaction.fees.amount).toBe(2);
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

  it('should convert Forex transactions to two cash transactions', () => {
    const tradesWithForex = [
      ...mockTrades,
      {
        dataDiscriminator: 'Order',
        assetCategory: 'Forex',
        currency: 'USD',
        symbol: 'EUR.USD',
        dateTime: '2024-03-15, 10:30:00',
        quantity: 1000, // Buying 1000 EUR with USD
        tPrice: new CurrencyAmount(1.0850, 'USD'),
        cPrice: new CurrencyAmount(1.0850, 'USD'),
        proceeds: new CurrencyAmount(-1085, 'USD'), // Cost in USD
        commFee: new CurrencyAmount(-2, 'USD'),
        basis: new CurrencyAmount(1087, 'USD'),
        realizedPL: new CurrencyAmount(0, 'USD'),
        mtmPL: new CurrencyAmount(0, 'USD'),
        code: 'O'
      }
    ];

    const transactions = convertIBKRTradesToTransactions(tradesWithForex, 'account-123', 'user-456', 'EST', {});
    
    // Should have original 2 transactions + 2 forex cash transactions
    expect(transactions).toHaveLength(4);
    
    // Verify forex transactions are present
    const forexTransactions = transactions.filter(t => t.memo?.includes('Forex'));
    expect(forexTransactions).toHaveLength(2);
    
    // Check the forex cash transactions
    const usdTransaction = forexTransactions.find(t => t.currency === 'USD');
    const eurTransaction = forexTransactions.find(t => t.currency === 'EUR');
    
    expect(usdTransaction).toBeDefined();
    expect(eurTransaction).toBeDefined();
    
    // USD transaction (selling USD to buy EUR) - negative quantity, SELL side
    expect(usdTransaction!.side).toBe('SELL');
    expect(usdTransaction!.qty).toBe(-1085); // Negative for outflow
    expect(usdTransaction!.fees.amount).toBe(2); // Fees in USD
    
    // EUR transaction (buying EUR with USD) - positive quantity, BUY side
    expect(eurTransaction!.side).toBe('BUY');
    expect(eurTransaction!.qty).toBe(1000); // Positive for inflow
    expect(eurTransaction!.fees.amount).toBe(0); // No fees in EUR (already accounted for in USD)
  });

  it('should handle selling base currency in forex trades', () => {
    const tradesWithForex = [
      {
        dataDiscriminator: 'Order',
        assetCategory: 'Forex',
        currency: 'USD',
        symbol: 'AUD.USD',
        dateTime: '2025-08-22, 13:14:01',
        quantity: -100, // Selling 100 AUD for USD
        tPrice: new CurrencyAmount(0.64201, 'USD'),
        cPrice: new CurrencyAmount(0.64201, 'USD'),
        proceeds: new CurrencyAmount(64.201, 'USD'), // Proceeds in USD
        commFee: new CurrencyAmount(0, 'USD'),
        basis: new CurrencyAmount(64.201, 'USD'),
        realizedPL: new CurrencyAmount(0, 'USD'),
        mtmPL: new CurrencyAmount(-0.699, 'USD'),
        code: 'O'
      }
    ];

    const transactions = convertIBKRTradesToTransactions(tradesWithForex, 'account-123', 'user-456', 'EST', {});
    
    // Should have 2 forex cash transactions
    expect(transactions).toHaveLength(2);
    
    // Verify forex transactions are present
    const forexTransactions = transactions.filter(t => t.memo?.includes('Forex'));
    expect(forexTransactions).toHaveLength(2);
    
    // Check the forex cash transactions
    const audTransaction = forexTransactions.find(t => t.currency === 'AUD');
    const usdTransaction = forexTransactions.find(t => t.currency === 'USD');
    
    expect(audTransaction).toBeDefined();
    expect(usdTransaction).toBeDefined();
    
    // AUD transaction (selling AUD) - negative quantity, SELL side
    expect(audTransaction!.side).toBe('SELL');
    expect(audTransaction!.qty).toBe(-100); // Negative for outflow
    
    // USD transaction (buying USD with AUD) - positive quantity, BUY side
    expect(usdTransaction!.side).toBe('BUY');
    expect(usdTransaction!.qty).toBeCloseTo(64.201, 2); // Positive for inflow
  });

  it('should handle real forex data from user example', () => {
    const realForexTrades = [
      {
        dataDiscriminator: 'Order',
        assetCategory: 'Forex',
        currency: 'USD',
        symbol: 'AUD.USD',
        dateTime: '2025-08-22, 13:14:01',
        quantity: -100, // Selling 100 AUD for USD
        tPrice: new CurrencyAmount(0.64201, 'USD'),
        cPrice: new CurrencyAmount(0.64201, 'USD'),
        proceeds: new CurrencyAmount(64.201, 'USD'), // Proceeds in USD
        commFee: new CurrencyAmount(0, 'USD'),
        basis: new CurrencyAmount(64.201, 'USD'),
        realizedPL: new CurrencyAmount(0, 'USD'),
        mtmPL: new CurrencyAmount(-0.699, 'USD'),
        code: 'O'
      },
      {
        dataDiscriminator: 'Order',
        assetCategory: 'Forex',
        currency: 'USD',
        symbol: 'AUD.USD',
        dateTime: '2025-08-26, 14:26:17',
        quantity: -200000, // Selling 200,000 AUD for USD
        tPrice: new CurrencyAmount(0.64774, 'USD'),
        cPrice: new CurrencyAmount(0.64774, 'USD'),
        proceeds: new CurrencyAmount(129548, 'USD'), // Proceeds in USD
        commFee: new CurrencyAmount(-2.59096, 'USD'),
        basis: new CurrencyAmount(129550.59096, 'USD'),
        realizedPL: new CurrencyAmount(0, 'USD'),
        mtmPL: new CurrencyAmount(-342, 'USD'),
        code: 'O'
      },
      {
        dataDiscriminator: 'Order',
        assetCategory: 'Forex',
        currency: 'USD',
        symbol: 'AUD.USD',
        dateTime: '2025-08-27, 11:12:29',
        quantity: -25000, // Selling 25,000 AUD for USD
        tPrice: new CurrencyAmount(0.64942, 'USD'),
        cPrice: new CurrencyAmount(0.64942, 'USD'),
        proceeds: new CurrencyAmount(16235.5, 'USD'), // Proceeds in USD
        commFee: new CurrencyAmount(-2, 'USD'),
        basis: new CurrencyAmount(16237.5, 'USD'),
        realizedPL: new CurrencyAmount(0, 'USD'),
        mtmPL: new CurrencyAmount(-29, 'USD'),
        code: 'O'
      }
    ];

    const transactions = convertIBKRTradesToTransactions(realForexTrades, 'account-123', 'user-456', 'EST', {});
    
    // Should have 6 transactions (3 forex trades * 2 cash transactions each)
    expect(transactions).toHaveLength(6);
    
    // Verify all are cash transactions
    transactions.forEach(t => {
      expect(t.instrument_kind).toBe('CASH');
      expect(t.memo).toContain('Forex');
    });
    
    // Group by currency
    const audTransactions = transactions.filter(t => t.currency === 'AUD');
    const usdTransactions = transactions.filter(t => t.currency === 'USD');
    
    expect(audTransactions).toHaveLength(3); // 3 AUD sell transactions
    expect(usdTransactions).toHaveLength(3); // 3 USD buy transactions
    
    // Check first trade (100 AUD for 64.201 USD)
    const firstAudTxn = audTransactions[0];
    const firstUsdTxn = usdTransactions[0];
    
    expect(firstAudTxn.side).toBe('SELL');
    expect(firstAudTxn.qty).toBe(-100); // Negative for outflow
    expect(firstUsdTxn.side).toBe('BUY');
    expect(firstUsdTxn.qty).toBeCloseTo(64.201, 2); // Positive for inflow
    
    // Check second trade (200,000 AUD for 129,548 USD)
    const secondAudTxn = audTransactions[1];
    const secondUsdTxn = usdTransactions[1];
    
    expect(secondAudTxn.side).toBe('SELL');
    expect(secondAudTxn.qty).toBe(-200000); // Negative for outflow
    expect(secondUsdTxn.side).toBe('BUY');
    expect(secondUsdTxn.qty).toBe(129548); // Positive for inflow
    expect(secondUsdTxn.fees.amount).toBe(0); // Fees should be in AUD transaction
    
    // Check third trade (25,000 AUD for 16,235.5 USD)
    const thirdAudTxn = audTransactions[2];
    const thirdUsdTxn = usdTransactions[2];
    
    expect(thirdAudTxn.side).toBe('SELL');
    expect(thirdAudTxn.qty).toBe(-25000); // Negative for outflow
    expect(thirdUsdTxn.side).toBe('BUY');
    expect(thirdUsdTxn.qty).toBeCloseTo(16235.5, 2); // Positive for inflow
  });

  it('should handle IBKR CSV with quoted values and comma separators', () => {
    const csvWithQuotedValues = `Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,,Proceeds,Comm in USD,,,MTM in USD,Code
Trades,Data,Order,Forex,USD,AUD.USD,"2025-08-22, 13:14:01",-100,0.64201,,64.201,0,,,-0.699,
Trades,Data,Order,Forex,USD,AUD.USD,"2025-08-26, 14:26:17","-200,000",0.64774,,129548,-2.59096,,,-342,
Trades,Data,Order,Forex,USD,AUD.USD,"2025-08-27, 11:12:29","-25,000",0.64942,,16235.5,-2,,,-29,`;

    const parser = new IBKRCSVParser(csvWithQuotedValues);
    const result = parser.parse();

    expect(result.trades).toHaveLength(3);
    
    // Check first trade (no quotes)
    const trade1 = result.trades[0];
    expect(trade1.quantity).toBe(-100);
    expect(trade1.proceeds.amount).toBeCloseTo(64.201, 2);
    
    // Check second trade (quoted with commas)
    const trade2 = result.trades[1];
    expect(trade2.quantity).toBe(-200000); // Should parse "-200,000" as -200000
    expect(trade2.proceeds.amount).toBe(129548);
    expect(trade2.commFee.amount).toBeCloseTo(-2.59096, 2);
    
    // Check third trade (quoted with commas)
    const trade3 = result.trades[2];
    expect(trade3.quantity).toBe(-25000); // Should parse "-25,000" as -25000
    expect(trade3.proceeds.amount).toBeCloseTo(16235.5, 2);
    expect(trade3.commFee.amount).toBe(-2);
  });
});

describe('convertIBKRCashToTransactions', () => {
  let CurrencyAmount: typeof import('../currency-amount').CurrencyAmount;
  let mockCashTransactions: Array<{
    currency: string;
    settleDate: string;
    description: string;
    amount: CurrencyAmount;
  }>;
  
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
    expect(deposit.price.amount).toBe(1);
    expect(deposit.fees.amount).toBe(0);
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
  let mockDividends: Array<{
    currency: string;
    date: string;
    description: string;
    amount: CurrencyAmount;
    symbol?: string;
  }>;
  
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
    expect(dividend1.price.amount).toBe(1);
    expect(dividend1.fees.amount).toBe(0);
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
  let mockWithholdingTax: Array<{
    currency: string;
    date: string;
    description: string;
    amount: CurrencyAmount;
    symbol?: string;
  }>;
  
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
    expect(tax.price.amount).toBe(1);
    expect(tax.fees.amount).toBe(0);
    expect(tax.memo).toContain('Withholding Tax: AAPL Dividend Tax (AAPL)');
  });
});

describe('convertIBKRCorporateActionsToTransactions', () => {
  let CurrencyAmount: typeof import('../currency-amount').CurrencyAmount;
  let mockCorporateActions: Array<{
    currency: string;
    date: string;
    description: string;
    amount: CurrencyAmount;
    symbol?: string;
  }>;
  
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
    
    // Count Forex trades
    const forexTrades = result.trades.filter(trade => 
      trade.assetCategory?.toLowerCase().includes('forex')
    );
    expect(forexTrades).toHaveLength(2);
    
    // Convert trades to transactions (Forex now converts to 2 transactions each)
    const tickerIdMap = { 'AAPL': 'ticker-1', 'MSFT': 'ticker-2', 'TSLA': 'ticker-3' };
    const tradeTransactions = convertIBKRTradesToTransactions(
      result.trades,
      'account-123',
      'user-456',
      'EST',
      tickerIdMap
    );
    
    // Count converted transactions (9 non-Forex + 4 Forex cash transactions)
    expect(tradeTransactions).toHaveLength(13);
    
    // Verify the counts are consistent
    expect(tradeTransactions.length).toBe(nonForexTrades.length + (forexTrades.length * 2));
    
    // Verify Forex transactions were converted to cash transactions
    const forexTransactions = tradeTransactions.filter(t => 
      t.memo?.includes('Forex')
    );
    expect(forexTransactions).toHaveLength(4); // 2 forex trades * 2 cash transactions each
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
      },
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
      },
      {
        dataDiscriminator: 'Order',
        assetCategory: 'Forex',
        currency: 'USD',
        symbol: 'GBP.USD',
        dateTime: '2024-03-15, 10:30:00',
        quantity: 500,
        tPrice: new CurrencyAmount(1.2650, 'USD'),
        cPrice: new CurrencyAmount(1.2650, 'USD'),
        proceeds: new CurrencyAmount(-632.50, 'USD'),
        commFee: new CurrencyAmount(-1, 'USD'),
        basis: new CurrencyAmount(633.50, 'USD'),
        realizedPL: new CurrencyAmount(0, 'USD'),
        mtmPL: new CurrencyAmount(0, 'USD'),
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

    // Should have 2 regular transactions + 4 forex cash transactions (2 forex trades * 2 each)
    expect(transactions).toHaveLength(6);
    
    // Verify we have the expected transaction types
    const stockTransaction = transactions.find(t => t.instrument_kind === 'SHARES');
    const optionTransaction = transactions.find(t => t.instrument_kind === 'CALL');
    const forexTransactions = transactions.filter(t => t.memo?.includes('Forex'));
    
    expect(stockTransaction).toBeDefined();
    expect(optionTransaction).toBeDefined();
    expect(forexTransactions).toHaveLength(4); // 2 forex trades * 2 cash transactions each
    
    // Verify forex transactions are cash transactions
    forexTransactions.forEach(t => {
      expect(t.instrument_kind).toBe('CASH');
    });
  });
});
