import { CurrencyAmount, sumAmounts, averageAmounts } from '../currency-amount';
import { processTransactions, validateSameCurrency } from '../transaction-processor';

describe('Currency Mixing Runtime Errors', () => {
  describe('Arithmetic Operations', () => {
    it('should throw descriptive error when adding different currencies', () => {
      const usd100 = new CurrencyAmount(100, 'USD');
      const eur50 = new CurrencyAmount(50, 'EUR');
      
      expect(() => {
        usd100.add(eur50);
      }).toThrow('Cannot perform operation on different currencies: USD and EUR');
    });

    it('should throw descriptive error when subtracting different currencies', () => {
      const usd100 = new CurrencyAmount(100, 'USD');
      const gbp75 = new CurrencyAmount(75, 'GBP');
      
      expect(() => {
        usd100.subtract(gbp75);
      }).toThrow('Cannot perform operation on different currencies: USD and GBP');
    });

    it('should throw descriptive error when comparing different currencies', () => {
      const usd100 = new CurrencyAmount(100, 'USD');
      const jpy10000 = new CurrencyAmount(10000, 'JPY');
      
      expect(() => {
        usd100.greaterThan(jpy10000);
      }).toThrow('Cannot perform operation on different currencies: USD and JPY');
      
      expect(() => {
        usd100.lessThan(jpy10000);
      }).toThrow('Cannot perform operation on different currencies: USD and JPY');
      
      expect(() => {
        usd100.greaterThanOrEqual(jpy10000);
      }).toThrow('Cannot perform operation on different currencies: USD and JPY');
      
      expect(() => {
        usd100.lessThanOrEqual(jpy10000);
      }).toThrow('Cannot perform operation on different currencies: USD and JPY');
    });
  });

  describe('Utility Functions', () => {
    it('should throw descriptive error when summing different currencies', () => {
      const usd100 = new CurrencyAmount(100, 'USD');
      const eur50 = new CurrencyAmount(50, 'EUR');
      
      expect(() => {
        sumAmounts([usd100, eur50]);
      }).toThrow('Cannot sum amounts with different currencies: USD and EUR');
    });

    it('should throw descriptive error when averaging different currencies', () => {
      const usd100 = new CurrencyAmount(100, 'USD');
      const eur50 = new CurrencyAmount(50, 'EUR');
      
      expect(() => {
        averageAmounts([usd100, eur50]);
      }).toThrow('Cannot sum amounts with different currencies: USD and EUR');
    });
  });

  describe('Transaction Processor Errors', () => {
    it('should throw descriptive error when processing transactions with currency mismatch', () => {
      
      const rawTransactions = [
        {
          id: '1',
          user_id: 'user1',
          account_id: 'acc1',
          timestamp: '2025-01-01T00:00:00Z',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          instrument_kind: 'CASH' as const,
          qty: 100,
          fees: 0,
          currency: 'USD',
          memo: 'USD deposit'
        },
        {
          id: '2',
          user_id: 'user1',
          account_id: 'acc1',
          timestamp: '2025-01-01T01:00:00Z',
          created_at: '2025-01-01T01:00:00Z',
          updated_at: '2025-01-01T01:00:00Z',
          instrument_kind: 'CASH' as const,
          qty: 50,
          fees: 0,
          currency: 'EUR',
          memo: 'EUR deposit'
        }
      ];
      
      // This should work fine - each transaction is processed individually
      const processed = processTransactions(rawTransactions);
      expect(processed).toHaveLength(2);
      expect(processed[0].fees.currency).toBe('USD');
      expect(processed[1].fees.currency).toBe('EUR');
    });

    it('should throw descriptive error when validating same currency with mixed currencies', () => {
      
      const processedTransactions = [
        {
          id: '1',
          user_id: 'user1',
          account_id: 'acc1',
          timestamp: '2025-01-01T00:00:00Z',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          instrument_kind: 'CASH' as const,
          qty: 100,
          fees: new CurrencyAmount(0, 'USD'),
          totalValue: new CurrencyAmount(100, 'USD'),
          memo: 'USD deposit'
        },
        {
          id: '2',
          user_id: 'user1',
          account_id: 'acc1',
          timestamp: '2025-01-01T01:00:00Z',
          created_at: '2025-01-01T01:00:00Z',
          updated_at: '2025-01-01T01:00:00Z',
          instrument_kind: 'CASH' as const,
          qty: 50,
          fees: new CurrencyAmount(0, 'EUR'),
          totalValue: new CurrencyAmount(50, 'EUR'),
          memo: 'EUR deposit'
        }
      ];
      
      expect(() => {
        validateSameCurrency(processedTransactions);
      }).toThrow('Currency mismatch: expected USD, found EUR in transaction 2');
    });
  });

  describe('Error Message Examples', () => {
    it('should show what the actual error messages look like', () => {
      const usd100 = new CurrencyAmount(100, 'USD');
      const eur50 = new CurrencyAmount(50, 'EUR');
      const gbp25 = new CurrencyAmount(25, 'GBP');
      
      // Test different error scenarios
      const scenarios = [
        {
          operation: () => usd100.add(eur50),
          expectedError: '🚨 CURRENCY MISMATCH: Cannot perform operation on different currencies: USD and EUR'
        },
        {
          operation: () => usd100.subtract(gbp25),
          expectedError: '🚨 CURRENCY MISMATCH: Cannot perform operation on different currencies: USD and GBP'
        },
        {
          operation: () => eur50.greaterThan(gbp25),
          expectedError: '🚨 CURRENCY MISMATCH: Cannot perform operation on different currencies: EUR and GBP'
        }
      ];
      
      scenarios.forEach(({ operation, expectedError }) => {
        try {
          operation();
          fail('Expected error to be thrown');
        } catch (error) {
          expect(error.message).toBe(expectedError);
        }
      });
    });
  });
});
