/**
 * Hong Kong Dollar (HKD) Currency Tests
 * 
 * Verifies that HKD is properly supported in the CurrencyAmount class
 * with correct symbol, decimal places, and formatting.
 */

import { CurrencyAmount } from '../currency-amount';

describe('Hong Kong Dollar (HKD) Support', () => {
  describe('Basic HKD Operations', () => {
    it('should create HKD amounts correctly', () => {
      const hkdAmount = new CurrencyAmount(100.50, 'HKD');
      
      expect(hkdAmount.amount).toBe(100.50);
      expect(hkdAmount.currency).toBe('HKD');
    });

    it('should format HKD amounts with correct symbol', () => {
      const hkdAmount = new CurrencyAmount(1234.56, 'HKD');
      
      expect(hkdAmount.format()).toBe('HK$ 1234.56');
      expect(hkdAmount.format({ showSymbol: false })).toBe('1234.56');
      expect(hkdAmount.format({ showSymbol: true })).toBe('HK$ 1234.56');
    });

    it('should handle HKD decimal places correctly', () => {
      const hkdAmount = new CurrencyAmount(100.999, 'HKD');
      
      // HKD has 2 decimal places, so 100.999 should round to 101.00
      expect(hkdAmount.amount).toBe(101.00);
    });

    it('should support HKD arithmetic operations', () => {
      const hkd1 = new CurrencyAmount(100, 'HKD');
      const hkd2 = new CurrencyAmount(50.25, 'HKD');
      
      expect(hkd1.add(hkd2).amount).toBe(150.25);
      expect(hkd1.add(hkd2).currency).toBe('HKD');
      
      expect(hkd1.subtract(hkd2).amount).toBe(49.75);
      expect(hkd1.subtract(hkd2).currency).toBe('HKD');
      
      expect(hkd1.multiply(2).amount).toBe(200);
      expect(hkd1.multiply(2).currency).toBe('HKD');
      
      expect(hkd1.divide(2).amount).toBe(50);
      expect(hkd1.divide(2).currency).toBe('HKD');
    });

    it('should prevent mixing HKD with other currencies', () => {
      const hkdAmount = new CurrencyAmount(100, 'HKD');
      const usdAmount = new CurrencyAmount(100, 'USD');
      
      expect(() => hkdAmount.add(usdAmount)).toThrow('Cannot perform operation on different currencies: HKD and USD');
      expect(() => hkdAmount.subtract(usdAmount)).toThrow('Cannot perform operation on different currencies: HKD and USD');
      expect(hkdAmount.equals(usdAmount)).toBe(false); // equals returns false for different currencies
    });
  });

  describe('HKD Static Factory Methods', () => {
    it('should create HKD zero amounts', () => {
      const zeroHKD = CurrencyAmount.zero('HKD');
      
      expect(zeroHKD.amount).toBe(0);
      expect(zeroHKD.currency).toBe('HKD');
    });

    it('should parse HKD amounts from strings', () => {
      const hkdAmount = CurrencyAmount.parse('1234.56', 'HKD');
      
      expect(hkdAmount.amount).toBe(1234.56);
      expect(hkdAmount.currency).toBe('HKD');
    });

    it('should create HKD from JSON', () => {
      const hkdAmount = CurrencyAmount.fromJSON({ amount: 500.75, currency: 'HKD' });
      
      expect(hkdAmount.amount).toBe(500.75);
      expect(hkdAmount.currency).toBe('HKD');
    });
  });

  describe('HKD Formatting Options', () => {
    it('should format HKD with different options', () => {
      const hkdAmount = new CurrencyAmount(1234567.89, 'HKD');
      
      // Default formatting
      expect(hkdAmount.format()).toBe('HK$ 1234567.89');
      
      // Without symbol
      expect(hkdAmount.format({ showSymbol: false })).toBe('1234567.89');
      
      // With symbol
      expect(hkdAmount.format({ showSymbol: true })).toBe('HK$ 1234567.89');
    });

    it('should handle HKD edge cases', () => {
      const zeroHKD = new CurrencyAmount(0, 'HKD');
      const negativeHKD = new CurrencyAmount(-100.50, 'HKD');
      const smallHKD = new CurrencyAmount(0.01, 'HKD');
      
      expect(zeroHKD.format()).toBe('HK$ 0.00');
      expect(negativeHKD.format()).toBe('HK$ -100.50');
      expect(smallHKD.format()).toBe('HK$ 0.01');
    });
  });

  describe('HKD Comparison Operations', () => {
    it('should compare HKD amounts correctly', () => {
      const hkd1 = new CurrencyAmount(100, 'HKD');
      const hkd2 = new CurrencyAmount(200, 'HKD');
      const hkd3 = new CurrencyAmount(100, 'HKD');
      
      expect(hkd1.equals(hkd3)).toBe(true);
      expect(hkd1.equals(hkd2)).toBe(false);
      
      expect(hkd1.greaterThan(hkd2)).toBe(false);
      expect(hkd2.greaterThan(hkd1)).toBe(true);
      
      expect(hkd1.lessThan(hkd2)).toBe(true);
      expect(hkd2.lessThan(hkd1)).toBe(false);
    });
  });

  describe('HKD Utility Functions', () => {
    it('should work with HKD in utility functions', async () => {
      const hkdAmounts = [
        new CurrencyAmount(100, 'HKD'),
        new CurrencyAmount(200, 'HKD'),
        new CurrencyAmount(300, 'HKD')
      ];
      
      const currencyModule = await import('../currency-amount');
      const { sumAmounts, averageAmounts } = currencyModule;
      
      const sum = sumAmounts(hkdAmounts);
      expect(sum.amount).toBe(600);
      expect(sum.currency).toBe('HKD');
      
      const average = averageAmounts(hkdAmounts);
      expect(average.amount).toBe(200);
      expect(average.currency).toBe('HKD');
    });
  });
});

