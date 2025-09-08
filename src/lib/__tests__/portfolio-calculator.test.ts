/**
 * Portfolio Calculator Tests
 * 
 * Comprehensive unit and behavioral tests for the core business logic
 * that calculates positions, balances, and P&L from transaction data.
 */

import {
  Transaction,
  PortfolioState,
  TimeRange,
  instrumentKey,
  filterTransactionsByTimeRange,
  isOption,
  multiplierFor,
  sign,
  getPositionKey,
  sharesQty,
  buildPortfolio,
  getAccountPositions,
  getAccountRealizedPnL,
  getAccountBalance,
  getTotalRealizedPnL,
  getUnrealizedPnL,
} from '../portfolio-calculator';

// Test data factories
const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'test-id',
  user_id: 'user-1',
  account_id: 'account-1',
  timestamp: '2025-01-01T10:00:00Z',
  created_at: '2025-01-01T10:00:00Z',
  updated_at: '2025-01-01T10:00:00Z',
  instrument_kind: 'SHARES',
  ticker_id: 'ticker-1',
  side: 'BUY',
  qty: 100,
  price: 50.00,
  fees: 1.00,
  memo: 'Test transaction',
  ...overrides,
});

const createTimeRange = (start: string, end: string): TimeRange => ({
  startDate: new Date(start),
  endDate: new Date(end),
  scale: 'day',
  label: 'Test Range',
});

describe('Portfolio Calculator - Utility Functions', () => {
  describe('instrumentKey', () => {
    it('should create key for cash', () => {
      expect(instrumentKey('CASH')).toBe('CASH');
    });

    it('should create key for shares', () => {
      expect(instrumentKey('SHARES', 'AAPL')).toBe('AAPL');
    });

    it('should create key for options with strike and expiry', () => {
      expect(instrumentKey('CALL', 'AAPL', '2025-03-21', 150)).toBe('AAPL|2025-03-21|150|CALL');
      expect(instrumentKey('PUT', 'AAPL', '2025-03-21', 140)).toBe('AAPL|2025-03-21|140|PUT');
    });

    it('should handle undefined strike and expiry', () => {
      expect(instrumentKey('CALL', 'AAPL')).toBe('AAPL|undefined|undefined|CALL');
    });
  });

  describe('isOption', () => {
    it('should identify options correctly', () => {
      expect(isOption('CALL')).toBe(true);
      expect(isOption('PUT')).toBe(true);
      expect(isOption('SHARES')).toBe(false);
      expect(isOption('CASH')).toBe(false);
    });
  });

  describe('multiplierFor', () => {
    it('should return correct multipliers', () => {
      expect(multiplierFor('SHARES')).toBe(1);
      expect(multiplierFor('CASH')).toBe(1);
      expect(multiplierFor('CALL')).toBe(100);
      expect(multiplierFor('PUT')).toBe(100);
    });
  });

  describe('sign', () => {
    it('should return correct signs', () => {
      expect(sign(5)).toBe(1);
      expect(sign(-5)).toBe(-1);
      expect(sign(0)).toBe(0);
    });
  });

  describe('getPositionKey', () => {
    it('should create position key correctly', () => {
      expect(getPositionKey('account-1', 'AAPL')).toBe('account-1|AAPL');
    });
  });

  describe('sharesQty', () => {
    it('should calculate shares quantity correctly', () => {
      const positions = new Map([
        ['account-1|AAPL', {
          accountId: 'account-1',
          instrumentKey: 'AAPL',
          instrumentKind: 'SHARES',
          ticker: 'AAPL',
          qty: 100,
          avgPrice: 150.00,
        }],
        ['account-1|AAPL|2025-03-21|150|CALL', {
          accountId: 'account-1',
          instrumentKey: 'AAPL|2025-03-21|150|CALL',
          instrumentKind: 'CALL',
          ticker: 'AAPL',
          qty: 2,
          avgPrice: 5.00,
          strike: 150,
          expiry: '2025-03-21',
        }],
      ]);

      expect(sharesQty(positions, 'account-1', 'AAPL')).toBe(100);
      expect(sharesQty(positions, 'account-1', 'MSFT')).toBe(0); // No position
    });
  });
});

describe('Portfolio Calculator - Time Filtering', () => {
  const transactions = [
    createTransaction({ timestamp: '2025-01-01T10:00:00Z' }),
    createTransaction({ timestamp: '2025-01-15T10:00:00Z' }),
    createTransaction({ timestamp: '2025-01-30T10:00:00Z' }),
    createTransaction({ timestamp: '2025-02-01T10:00:00Z' }),
  ];

  it('should filter transactions by time range', () => {
    const timeRange = createTimeRange('2025-01-01T00:00:00Z', '2025-01-31T23:59:59Z');
    const filtered = filterTransactionsByTimeRange(transactions, timeRange);
    
    expect(filtered).toHaveLength(3);
    expect(filtered[0].timestamp).toBe('2025-01-01T10:00:00Z');
    expect(filtered[1].timestamp).toBe('2025-01-15T10:00:00Z');
    expect(filtered[2].timestamp).toBe('2025-01-30T10:00:00Z');
  });

  it('should return empty array for no matching transactions', () => {
    const timeRange = createTimeRange('2025-03-01T00:00:00Z', '2025-03-31T23:59:59Z');
    const filtered = filterTransactionsByTimeRange(transactions, timeRange);
    
    expect(filtered).toHaveLength(0);
  });

  it('should handle edge cases with exact boundaries', () => {
    const timeRange = createTimeRange('2025-01-01T10:00:00Z', '2025-01-01T10:00:00Z');
    const filtered = filterTransactionsByTimeRange(transactions, timeRange);
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].timestamp).toBe('2025-01-01T10:00:00Z');
  });
});

describe('Portfolio Calculator - Basic Share Trading', () => {
  it('should handle simple share purchase', () => {
    const transactions = [
      createTransaction({
        instrument_kind: 'SHARES',
        ticker_id: 'AAPL',
        side: 'BUY',
        qty: 100,
        price: 150.00,
        fees: 1.00,
      }),
    ];

    const portfolio = buildPortfolio(transactions);

    // Check positions
    const positions = Array.from(portfolio.positions.values());
    expect(positions).toHaveLength(1);
    
    const position = positions[0];
    expect(position.ticker).toBe('AAPL');
    expect(position.qty).toBe(100);
    expect(position.avgPrice).toBe(150.01); // includes fees
    expect(position.instrumentKind).toBe('SHARES');

    // Check cash balance
    const balances = Array.from(portfolio.balances.entries());
    expect(balances).toHaveLength(1);
    expect(balances[0][1]).toBe(-15001); // -$15,000 - $1 fees
  });

  it('should handle share sale with profit', () => {
    const transactions = [
      createTransaction({
        instrument_kind: 'SHARES',
        ticker_id: 'AAPL',
        side: 'BUY',
        qty: 100,
        price: 150.00,
        fees: 1.00,
      }),
      createTransaction({
        instrument_kind: 'SHARES',
        ticker_id: 'AAPL',
        side: 'SELL',
        qty: 100,
        price: 160.00,
        fees: 1.00,
      }),
    ];

    const portfolio = buildPortfolio(transactions);

    // Position should be closed (qty=0 but still in Map)
    const positions = Array.from(portfolio.positions.values());
    expect(positions).toHaveLength(1);
    expect(positions[0].qty).toBe(0);

    // Check realized P&L
    const realized = Array.from(portfolio.realized);
    expect(realized).toHaveLength(1);
    expect(realized[0].realizedPnL).toBeCloseTo(998, 2); // $10 profit - $2 fees

    // Check final balance
    const balances = Array.from(portfolio.balances.entries());
    expect(balances[0][1]).toBeCloseTo(998, 2); // Net profit
  });

  it('should handle partial share sale', () => {
    const transactions = [
      createTransaction({
        instrument_kind: 'SHARES',
        ticker_id: 'AAPL',
        side: 'BUY',
        qty: 100,
        price: 150.00,
        fees: 1.00,
      }),
      createTransaction({
        instrument_kind: 'SHARES',
        ticker_id: 'AAPL',
        side: 'SELL',
        qty: 50,
        price: 160.00,
        fees: 1.00,
      }),
    ];

    const portfolio = buildPortfolio(transactions);

    // Should have remaining position
    const positions = Array.from(portfolio.positions.values());
    expect(positions).toHaveLength(1);
    expect(positions[0].qty).toBe(50);
    expect(positions[0].avgPrice).toBe(150.01);

    // Should have realized P&L for partial sale
    const realized = Array.from(portfolio.realized);
    expect(realized).toHaveLength(1);
    expect(realized[0].realizedPnL).toBeCloseTo(498.5, 1); // $5 profit - $1 fees
  });
});

describe('Portfolio Calculator - Options Trading', () => {
  it('should handle covered call writing', () => {
    const transactions = [
      // Buy shares
      createTransaction({
        instrument_kind: 'SHARES',
        ticker_id: 'AAPL',
        side: 'BUY',
        qty: 100,
        price: 150.00,
        fees: 1.00,
      }),
      // Write covered call
      createTransaction({
        instrument_kind: 'CALL',
        ticker_id: 'AAPL',
        side: 'SELL',
        qty: 1,
        price: 5.00,
        strike: 160,
        expiry: '2025-03-21',
        fees: 1.00,
      }),
    ];

    const portfolio = buildPortfolio(transactions);

    // Should have both positions
    const positions = Array.from(portfolio.positions.values());
    expect(positions).toHaveLength(2);

    const sharePosition = positions.find(p => p.instrumentKind === 'SHARES');
    const callPosition = positions.find(p => p.instrumentKind === 'CALL');

    expect(sharePosition?.qty).toBe(100);
    expect(callPosition?.qty).toBe(-1); // Short position
    expect(callPosition?.strike).toBe(160);
    expect(callPosition?.coverageHint).toBe('COVERED');

    // Check cash balance
    const balances = Array.from(portfolio.balances.entries());
    expect(balances[0][1]).toBe(-15001 + 499); // -$15,001 + $499 premium
  });

  it('should correctly apply 100x multiplier for options cash deltas', () => {
    const transactions = [
      // Sell 1 AMD call for $4.50
      createTransaction({
        instrument_kind: 'CALL',
        ticker_id: 'AMD',
        side: 'SELL',
        qty: 1,
        price: 4.50,
        strike: 100,
        expiry: '2025-09-19',
        fees: 0.50,
      }),
      // Sell 2 AMD puts for $2.00 each
      createTransaction({
        instrument_kind: 'PUT',
        ticker_id: 'AMD',
        side: 'SELL',
        qty: 2,
        price: 2.00,
        strike: 90,
        expiry: '2025-09-26',
        fees: 1.00,
      }),
    ];

    const portfolio = buildPortfolio(transactions);

    // Check ledger entries for correct cash deltas
    const ledger = portfolio.ledger;
    
    // First transaction: SELL 1 call @ $4.50, fees $0.50
    // Expected: +(4.50 * 1 * 100) - 0.50 = +450 - 0.50 = +449.50
    expect(ledger[0].cashDelta).toBeCloseTo(449.50, 2);
    
    // Second transaction: SELL 2 puts @ $2.00 each, fees $1.00
    // Expected: +(2.00 * 2 * 100) - 1.00 = +400 - 1.00 = +399.00
    expect(ledger[1].cashDelta).toBeCloseTo(399.00, 2);

    // Check final balance
    const balances = Array.from(portfolio.balances.entries());
    expect(balances[0][1]).toBeCloseTo(449.50 + 399.00, 2); // 848.50
  });

  it('should handle cash-secured put writing', () => {
    const transactions = [
      // Initial cash deposit to secure the put
      createTransaction({
        instrument_kind: 'CASH',
        qty: 15000, // $15,000 to cover $14,000 strike
        fees: 0,
      }),
      // Write cash-secured put
      createTransaction({
        instrument_kind: 'PUT',
        ticker_id: 'AAPL',
        side: 'SELL',
        qty: 1,
        price: 3.00,
        strike: 140,
        expiry: '2025-03-21',
        fees: 1.00,
      }),
    ];

    const portfolio = buildPortfolio(transactions);

    const positions = Array.from(portfolio.positions.values());
    expect(positions).toHaveLength(1);

    const putPosition = positions[0];
    expect(putPosition.qty).toBe(-1); // Short position
    expect(putPosition.strike).toBe(140);
    expect(putPosition.coverageHint).toBe('CASH_SECURED');

    // Check cash balance (should have premium received)
    const balances = Array.from(portfolio.balances.entries());
    expect(balances[0][1]).toBe(15299); // $15,000 initial + $300 premium - $1 fees
  });

  it('should handle option assignment', () => {
    const transactions = [
      // Write covered call
      createTransaction({
        instrument_kind: 'CALL',
        ticker_id: 'AAPL',
        side: 'SELL',
        qty: 1,
        price: 5.00,
        strike: 160,
        expiry: '2025-03-21',
        fees: 1.00,
      }),
      // Assignment (buy back at strike price)
      createTransaction({
        instrument_kind: 'CALL',
        ticker_id: 'AAPL',
        side: 'BUY',
        qty: 1,
        price: 0, // No cost on assignment
        strike: 160,
        expiry: '2025-03-21',
        fees: 0,
        memo: 'ASSIGNED',
      }),
    ];

    const portfolio = buildPortfolio(transactions);

    // Call position should be closed (qty=0 but still in Map)
    const positions = Array.from(portfolio.positions.values());
    expect(positions).toHaveLength(1);
    expect(positions[0].qty).toBe(0);

    // Should have realized P&L
    const realized = Array.from(portfolio.realized);
    expect(realized).toHaveLength(1);
    expect(realized[0].realizedPnL).toBeCloseTo(501, 1); // Premium received
  });
});

describe('Portfolio Calculator - Complex Strategies', () => {
  it('should handle iron condor', () => {
    const transactions = [
      // Sell call spread (short 160 call, long 165 call)
      createTransaction({
        instrument_kind: 'CALL',
        ticker_id: 'SPY',
        side: 'SELL',
        qty: 1,
        price: 2.00,
        strike: 160,
        expiry: '2025-03-21',
        fees: 1.00,
      }),
      createTransaction({
        instrument_kind: 'CALL',
        ticker_id: 'SPY',
        side: 'BUY',
        qty: 1,
        price: 1.00,
        strike: 165,
        expiry: '2025-03-21',
        fees: 1.00,
      }),
      // Sell put spread (short 150 put, long 145 put)
      createTransaction({
        instrument_kind: 'PUT',
        ticker_id: 'SPY',
        side: 'SELL',
        qty: 1,
        price: 2.00,
        strike: 150,
        expiry: '2025-03-21',
        fees: 1.00,
      }),
      createTransaction({
        instrument_kind: 'PUT',
        ticker_id: 'SPY',
        side: 'BUY',
        qty: 1,
        price: 1.00,
        strike: 145,
        expiry: '2025-03-21',
        fees: 1.00,
      }),
    ];

    const portfolio = buildPortfolio(transactions);

    // Should have 4 positions
    const positions = Array.from(portfolio.positions.values());
    expect(positions).toHaveLength(4);

    // Check net cash flow
    const balances = Array.from(portfolio.balances.entries());
    expect(balances[0][1]).toBe(196); // Net premium received minus fees
  });

  it('should handle calendar spread', () => {
    const transactions = [
      // Sell short-term call
      createTransaction({
        instrument_kind: 'CALL',
        ticker_id: 'AAPL',
        side: 'SELL',
        qty: 1,
        price: 3.00,
        strike: 150,
        expiry: '2025-02-21',
        fees: 1.00,
      }),
      // Buy long-term call
      createTransaction({
        instrument_kind: 'CALL',
        ticker_id: 'AAPL',
        side: 'BUY',
        qty: 1,
        price: 5.00,
        strike: 150,
        expiry: '2025-03-21',
        fees: 1.00,
      }),
    ];

    const portfolio = buildPortfolio(transactions);

    const positions = Array.from(portfolio.positions.values());
    expect(positions).toHaveLength(2);

    // Should have net debit
    const balances = Array.from(portfolio.balances.entries());
    expect(balances[0][1]).toBeCloseTo(-202, 1); // Net debit minus fees
  });
});

describe('Portfolio Calculator - Edge Cases', () => {
  it('should handle expired options', () => {
    const transactions = [
      createTransaction({
        instrument_kind: 'CALL',
        ticker_id: 'AAPL',
        side: 'BUY',
        qty: 1,
        price: 5.00,
        strike: 150,
        expiry: '2025-01-15',
        fees: 1.00,
      }),
    ];

    const portfolio = buildPortfolio(transactions);

    // Position should still exist (expiry handling is business logic)
    const positions = Array.from(portfolio.positions.values());
    expect(positions).toHaveLength(1);
    expect(positions[0].qty).toBe(1);
  });

  it('should handle multiple accounts', () => {
    const transactions = [
      createTransaction({
        account_id: 'account-1',
        instrument_kind: 'SHARES',
        ticker_id: 'AAPL',
        side: 'BUY',
        qty: 100,
        price: 150.00,
        fees: 1.00,
      }),
      createTransaction({
        account_id: 'account-2',
        instrument_kind: 'SHARES',
        ticker_id: 'AAPL',
        side: 'BUY',
        qty: 50,
        price: 160.00,
        fees: 1.00,
      }),
    ];

    const portfolio = buildPortfolio(transactions);

    const positions = Array.from(portfolio.positions.values());
    expect(positions).toHaveLength(2);

    const balances = Array.from(portfolio.balances.entries());
    expect(balances).toHaveLength(2);
    expect(balances[0][1]).toBe(-15001);
    expect(balances[1][1]).toBe(-8001);
  });

  it('should handle zero quantity transactions', () => {
    const transactions = [
      createTransaction({
        instrument_kind: 'CASH',
        qty: 0,
        price: 0,
        fees: 0,
      }),
    ];

    const portfolio = buildPortfolio(transactions);

    const positions = Array.from(portfolio.positions.values());
    expect(positions).toHaveLength(0);
  });
});

describe('Portfolio Calculator - Helper Functions', () => {
  const mockPortfolio: PortfolioState = {
    positions: new Map([
      ['account-1|AAPL', {
        accountId: 'account-1',
        instrumentKey: 'AAPL',
        instrumentKind: 'SHARES',
        ticker: 'AAPL',
        qty: 100,
        avgPrice: 150.00,
      }],
    ]),
    balances: new Map([
      ['account-1', 1000],
    ]),
    ledger: [],
    realized: [
      {
        accountId: 'account-1',
        instrumentKey: 'AAPL',
        instrumentKind: 'SHARES',
        ticker: 'AAPL',
        closedQty: 50,
        closePrice: 160.00,
        openAvgPrice: 150.00,
        multiplier: 1,
        closeFees: 1.00,
        realizedPnL: 500,
        coverageAtOpen: undefined,
        memo: 'Test sale',
        timestamp: '2025-01-01T10:00:00Z',
      },
    ],
  };

  describe('getAccountPositions', () => {
    it('should return positions for specific account', () => {
      const positions = getAccountPositions(mockPortfolio, 'account-1');
      expect(positions).toHaveLength(1);
      expect(positions[0].ticker).toBe('AAPL');
    });

    it('should return empty array for non-existent account', () => {
      const positions = getAccountPositions(mockPortfolio, 'account-2');
      expect(positions).toHaveLength(0);
    });
  });

  describe('getAccountBalance', () => {
    it('should return balance for specific account', () => {
      const balance = getAccountBalance(mockPortfolio, 'account-1');
      expect(balance).toBe(1000);
    });

    it('should return 0 for non-existent account', () => {
      const balance = getAccountBalance(mockPortfolio, 'account-2');
      expect(balance).toBe(0);
    });
  });

  describe('getAccountRealizedPnL', () => {
    it('should return realized P&L for specific account', () => {
      const realized = getAccountRealizedPnL(mockPortfolio, 'account-1');
      expect(realized).toHaveLength(1);
      expect(realized[0].realizedPnL).toBe(500);
    });
  });

  describe('getTotalRealizedPnL', () => {
    it('should return total realized P&L', () => {
      const total = getTotalRealizedPnL(mockPortfolio, 'account-1');
      expect(total).toBe(500);
    });
  });

  describe('getUnrealizedPnL', () => {
    it('should calculate unrealized P&L correctly', () => {
      const position = mockPortfolio.positions.get('account-1|AAPL')!;
      const unrealized = getUnrealizedPnL(position, 160);
      expect(unrealized).toBe(1000); // 100 shares * ($160 - $150)
    });
  });
});

describe('Portfolio Calculator - Integration Tests', () => {
  it('should handle complete trading scenario', () => {
    const transactions = [
      // Initial cash deposit
      createTransaction({
        instrument_kind: 'CASH',
        qty: 10000,
        price: 1,
        fees: 0,
      }),
      // Buy shares
      createTransaction({
        instrument_kind: 'SHARES',
        ticker_id: 'AAPL',
        side: 'BUY',
        qty: 100,
        price: 150.00,
        fees: 1.00,
      }),
      // Write covered call
      createTransaction({
        instrument_kind: 'CALL',
        ticker_id: 'AAPL',
        side: 'SELL',
        qty: 1,
        price: 5.00,
        strike: 160,
        expiry: '2025-03-21',
        fees: 1.00,
      }),
      // Call gets assigned
      createTransaction({
        instrument_kind: 'CALL',
        ticker_id: 'AAPL',
        side: 'BUY',
        qty: 1,
        price: 0,
        strike: 160,
        expiry: '2025-03-21',
        fees: 0,
        memo: 'ASSIGNED',
      }),
      // Sell shares at assignment
      createTransaction({
        instrument_kind: 'SHARES',
        ticker_id: 'AAPL',
        side: 'SELL',
        qty: 100,
        price: 160.00,
        fees: 1.00,
      }),
    ];

    const portfolio = buildPortfolio(transactions);

    // All positions should be closed (qty=0 but still in Map)
    const positions = Array.from(portfolio.positions.values());
    expect(positions).toHaveLength(2);
    expect(positions.every(p => p.qty === 0)).toBe(true);

    // Should have realized P&L
    const realized = Array.from(portfolio.realized);
    expect(realized.length).toBeGreaterThan(0);

    // Final balance should reflect all transactions
    const balances = Array.from(portfolio.balances.entries());
    expect(balances[0][1]).toBeGreaterThan(10000); // Should be profitable
  });

  it('should handle real-world data structure with joined ticker data', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx1',
        user_id: 'user-1',
        account_id: 'account-1',
        timestamp: '2025-01-01T10:00:00Z',
        created_at: '2025-01-01T10:00:00Z',
        updated_at: '2025-01-01T10:00:00Z',
        instrument_kind: 'SHARES',
        ticker_id: '550e8400-e29b-41d4-a716-446655440000', // UUID
        side: 'BUY',
        qty: 100,
        price: 150.00,
        fees: 1.00,
        memo: 'Test purchase',
        // Joined data from PortfolioContext
        tickers: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'AAPL', // This should be used, not the UUID
          icon: 'https://example.com/aapl.png'
        },
        accounts: {
          id: 'account-1',
          name: 'Test Account',
          type: 'Individual',
          institution: 'Test Broker'
        }
      }
    ];

    const portfolio = buildPortfolio(transactions);

    // Verify that the instrumentKey uses the ticker name, not the UUID
    const positions = Array.from(portfolio.positions.values());
    expect(positions).toHaveLength(1);
    expect(positions[0].instrumentKey).toBe('AAPL'); // Should be ticker name, not UUID
    expect(positions[0].ticker).toBe('AAPL');
  });

  it('should throw error when ticker information is missing', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx1',
        user_id: 'user-1',
        account_id: 'account-1',
        timestamp: '2025-01-01T10:00:00Z',
        created_at: '2025-01-01T10:00:00Z',
        updated_at: '2025-01-01T10:00:00Z',
        instrument_kind: 'SHARES',
        // Missing both ticker_id and tickers.name
        side: 'BUY',
        qty: 100,
        price: 150.00,
        fees: 1.00,
        memo: 'Test purchase'
      }
    ];

    expect(() => buildPortfolio(transactions)).toThrow(
      'Transaction tx1 missing ticker information (neither tickers.name nor ticker_id provided)'
    );
  });

  it('should handle CASH transactions without ticker information', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx1',
        user_id: 'user-1',
        account_id: 'account-1',
        timestamp: '2025-01-01T10:00:00Z',
        created_at: '2025-01-01T10:00:00Z',
        updated_at: '2025-01-01T10:00:00Z',
        instrument_kind: 'CASH',
        qty: 1000.00, // Cash amount
        fees: 0,
        memo: 'Cash deposit'
      }
    ];

    const portfolio = buildPortfolio(transactions);

    expect(portfolio.positions.size).toBe(0); // CASH doesn't create positions
    expect(portfolio.balances.size).toBe(1);
    expect(portfolio.balances.get('account-1')).toBe(1000.00);
  });
});
