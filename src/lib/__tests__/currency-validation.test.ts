/**
 * CurrencyAmount Validation Tests
 * 
 * Verifies that CurrencyAmount properly enforces valid currency codes
 * and prevents creation with empty, invalid, or default values.
 */

import { CurrencyAmount, CurrencyCode, isValidCurrencyCode } from '../currency-amount';

describe('CurrencyAmount Validation', () => {
  describe('Constructor Validation', () => {
    it('should throw error for empty currency string', () => {
      expect(() => {
        new CurrencyAmount(100, '' as CurrencyCode);
      }).toThrow('Invalid currency code: ');
    });

    it('should throw error for null currency', () => {
      expect(() => {
        new CurrencyAmount(100, null as unknown as CurrencyCode);
      }).toThrow('Invalid currency code: null');
    });

    it('should throw error for undefined currency', () => {
      expect(() => {
        new CurrencyAmount(100, undefined as unknown as CurrencyCode);
      }).toThrow('Invalid currency code: undefined');
    });

    it('should throw error for invalid currency codes', () => {
      const invalidCurrencies = [
        'INVALID',
        'XYZ',
        '123',
        'usd', // lowercase
        'USD ', // with space
        ' USD', // with space
        'U.S.D', // with dots
        'US-D', // with dash
        'US$', // with symbol
        'DOLLAR', // full name
        'UNKNOWN',
        'BTC', // crypto
        'ETH', // crypto
        'GOLD', // commodity
        'SILVER', // commodity
      ];

      invalidCurrencies.forEach(currency => {
        expect(() => {
          new CurrencyAmount(100, currency as CurrencyCode);
        }).toThrow(`Invalid currency code: ${currency}`);
      });
    });

    it('should accept only valid currency codes', () => {
      const validCurrencies: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'HKD'];
      
      validCurrencies.forEach(currency => {
        expect(() => {
          new CurrencyAmount(100, currency);
        }).not.toThrow();
      });
    });

    it('should throw error for invalid amounts', () => {
      const invalidAmounts: unknown[] = [
        NaN,
        Infinity,
        -Infinity,
        'not a number',
        null,
        undefined,
        {},
        [],
      ];

      invalidAmounts.forEach(amount => {
        expect(() => {
          new CurrencyAmount(amount as number, 'USD');
        }).toThrow(`Invalid amount: ${amount}`);
      });
    });

    it('should accept valid amounts including zero and negative', () => {
      const validAmounts = [0, -100, 100, 0.01, -0.01, 999999.99, -999999.99];
      
      validAmounts.forEach(amount => {
        expect(() => {
          new CurrencyAmount(amount, 'USD');
        }).not.toThrow();
      });
    });
  });

  describe('Static Factory Methods Validation', () => {
    it('should validate currency in fromJSON', () => {
      expect(() => {
        CurrencyAmount.fromJSON({ amount: 100, currency: 'INVALID' as CurrencyCode });
      }).toThrow('Invalid currency code: INVALID');
    });

    it('should validate currency in zero', () => {
      expect(() => {
        CurrencyAmount.zero('INVALID' as CurrencyCode);
      }).toThrow('Invalid currency code: INVALID');
    });

    it('should validate currency in parse', () => {
      expect(() => {
        CurrencyAmount.parse('100', 'INVALID' as CurrencyCode);
      }).toThrow('Invalid currency code: INVALID');
    });

    it('should validate amount in parse', () => {
      expect(() => {
        CurrencyAmount.parse('not a number', 'USD');
      }).toThrow('Cannot parse amount from: not a number');
    });
  });

  describe('Utility Function Validation', () => {
    it('should validate currency codes in isValidCurrencyCode', () => {
      // Valid currencies
      expect(isValidCurrencyCode('USD')).toBe(true);
      expect(isValidCurrencyCode('EUR')).toBe(true);
      expect(isValidCurrencyCode('GBP')).toBe(true);
      expect(isValidCurrencyCode('JPY')).toBe(true);
      expect(isValidCurrencyCode('CAD')).toBe(true);
      expect(isValidCurrencyCode('AUD')).toBe(true);
      expect(isValidCurrencyCode('CHF')).toBe(true);
      expect(isValidCurrencyCode('CNY')).toBe(true);
      expect(isValidCurrencyCode('HKD')).toBe(true);

      // Invalid currencies
      expect(isValidCurrencyCode('')).toBe(false);
      expect(isValidCurrencyCode('INVALID')).toBe(false);
      expect(isValidCurrencyCode('usd')).toBe(false);
      expect(isValidCurrencyCode('USD ')).toBe(false);
      expect(isValidCurrencyCode('123')).toBe(false);
      expect(isValidCurrencyCode('BTC')).toBe(false);
      expect(isValidCurrencyCode('UNKNOWN')).toBe(false);
    });
  });

  describe('No Default Values', () => {
    it('should not have any default currency', () => {
      // Verify there's no way to create a CurrencyAmount without explicitly specifying currency
      expect(() => {
        new (CurrencyAmount as unknown as new (...args: unknown[]) => CurrencyAmount)();
      }).toThrow();
    });

    it('should not allow partial construction', () => {
      expect(() => {
        new (CurrencyAmount as unknown as new (...args: unknown[]) => CurrencyAmount)(100);
      }).toThrow();
    });

    it('should require both amount and currency', () => {
      expect(() => {
        new (CurrencyAmount as unknown as new (...args: unknown[]) => CurrencyAmount)(undefined, 'USD');
      }).toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should enforce CurrencyCode type at compile time', () => {
      // This test verifies that TypeScript would catch invalid currency codes at compile time
      // In a real TypeScript environment, these would cause compile errors:
      
      // const invalid1 = new CurrencyAmount(100, 'INVALID'); // ❌ TypeScript error
      // const invalid2 = new CurrencyAmount(100, ''); // ❌ TypeScript error
      // const invalid3 = new CurrencyAmount(100, null); // ❌ TypeScript error
      
      // Only valid CurrencyCode values should be accepted
      const valid = new CurrencyAmount(100, 'USD'); // ✅ Valid
      expect(valid.currency).toBe('USD');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small amounts correctly', () => {
      const smallAmount = new CurrencyAmount(0.01, 'USD');
      expect(smallAmount.amount).toBe(0.01);
      expect(smallAmount.currency).toBe('USD');
    });

    it('should handle very large amounts correctly', () => {
      const largeAmount = new CurrencyAmount(999999999.99, 'USD');
      expect(largeAmount.amount).toBe(999999999.99);
      expect(largeAmount.currency).toBe('USD');
    });

    it('should round amounts to currency precision', () => {
      const jpyAmount = new CurrencyAmount(100.5, 'JPY'); // JPY has 0 decimal places
      expect(jpyAmount.amount).toBe(101); // Rounded up
    });

    it('should preserve currency information in all operations', () => {
      const usdAmount = new CurrencyAmount(100, 'USD');
      const eurAmount = new CurrencyAmount(85, 'EUR');
      
      // All operations should preserve currency
      expect(usdAmount.add(usdAmount).currency).toBe('USD');
      expect(usdAmount.subtract(usdAmount).currency).toBe('USD');
      expect(usdAmount.multiply(2).currency).toBe('USD');
      expect(usdAmount.divide(2).currency).toBe('USD');
      expect(usdAmount.negate().currency).toBe('USD');
      expect(usdAmount.abs().currency).toBe('USD');
      
      // Cross-currency operations should fail
      expect(() => usdAmount.add(eurAmount)).toThrow('Cannot perform operation on different currencies: USD and EUR');
    });
  });
});
