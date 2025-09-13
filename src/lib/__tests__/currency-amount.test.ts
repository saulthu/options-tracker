import { CurrencyAmount, CurrencyCode, sumAmounts, averageAmounts, isCurrencyAmount, isValidCurrencyCode } from '../currency-amount';

describe('CurrencyAmount', () => {
  describe('Constructor and Getters', () => {
    it('should create a valid CurrencyAmount instance', () => {
      const amount = new CurrencyAmount(100.50, 'USD');
      expect(amount.amount).toBe(100.50);
      expect(amount.currency).toBe('USD');
      expect(amount.currencyInfo.code).toBe('USD');
      expect(amount.currencyInfo.symbol).toBe('$');
      expect(amount.currencyInfo.decimals).toBe(2);
    });

    it('should round amounts to currency precision', () => {
      const usdAmount = new CurrencyAmount(100.123456, 'USD');
      expect(usdAmount.amount).toBe(100.12); // 2 decimal places

      const jpyAmount = new CurrencyAmount(100.7, 'JPY');
      expect(jpyAmount.amount).toBe(101); // 0 decimal places

      const hkdAmount = new CurrencyAmount(100.999, 'HKD');
      expect(hkdAmount.amount).toBe(101.00); // 2 decimal places
    });

    it('should throw error for invalid currency', () => {
      expect(() => new CurrencyAmount(100, 'INVALID' as CurrencyCode)).toThrow('Invalid currency code: INVALID');
    });

    it('should throw error for invalid amount', () => {
      expect(() => new CurrencyAmount(NaN, 'USD')).toThrow('Invalid amount: NaN');
      expect(() => new CurrencyAmount(Infinity, 'USD')).toThrow('Invalid amount: Infinity');
    });

    it('should create HKD amounts correctly', () => {
      const hkdAmount = new CurrencyAmount(100.50, 'HKD');
      
      expect(hkdAmount.amount).toBe(100.50);
      expect(hkdAmount.currency).toBe('HKD');
      expect(hkdAmount.currencyInfo.code).toBe('HKD');
      expect(hkdAmount.currencyInfo.symbol).toBe('HK$');
      expect(hkdAmount.currencyInfo.decimals).toBe(2);
    });
  });

  describe('Arithmetic Operations', () => {
    const usd100 = new CurrencyAmount(100, 'USD');
    const usd50 = new CurrencyAmount(50, 'USD');
    const eur100 = new CurrencyAmount(100, 'EUR');

    it('should add amounts of same currency', () => {
      const result = usd100.add(usd50);
      expect(result.amount).toBe(150);
      expect(result.currency).toBe('USD');
    });

    it('should subtract amounts of same currency', () => {
      const result = usd100.subtract(usd50);
      expect(result.amount).toBe(50);
      expect(result.currency).toBe('USD');
    });

    it('should multiply by scalar', () => {
      const result = usd100.multiply(2.5);
      expect(result.amount).toBe(250);
      expect(result.currency).toBe('USD');
    });

    it('should divide by scalar', () => {
      const result = usd100.divide(4);
      expect(result.amount).toBe(25);
      expect(result.currency).toBe('USD');
    });

    it('should throw error when adding different currencies', () => {
      expect(() => usd100.add(eur100)).toThrow('Cannot perform operation on different currencies: USD and EUR');
    });

    it('should throw error when subtracting different currencies', () => {
      expect(() => usd100.subtract(eur100)).toThrow('Cannot perform operation on different currencies: USD and EUR');
    });

    it('should throw error for invalid scalar in multiply', () => {
      expect(() => usd100.multiply(NaN)).toThrow('Invalid scalar: NaN');
    });

    it('should throw error for invalid divisor in divide', () => {
      expect(() => usd100.divide(0)).toThrow('Invalid divisor: 0');
      expect(() => usd100.divide(NaN)).toThrow('Invalid divisor: NaN');
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

  describe('Comparison Operations', () => {
    const usd100 = new CurrencyAmount(100, 'USD');
    const usd50 = new CurrencyAmount(50, 'USD');
    const usd100_2 = new CurrencyAmount(100, 'USD');
    const eur100 = new CurrencyAmount(100, 'EUR');

    it('should compare amounts correctly', () => {
      expect(usd100.equals(usd100_2)).toBe(true);
      expect(usd100.equals(usd50)).toBe(false);
      expect(usd100.greaterThan(usd50)).toBe(true);
      expect(usd50.lessThan(usd100)).toBe(true);
      expect(usd100.greaterThanOrEqual(usd100_2)).toBe(true);
      expect(usd50.lessThanOrEqual(usd100)).toBe(true);
    });

    it('should throw error when comparing different currencies', () => {
      expect(() => usd100.greaterThan(eur100)).toThrow('Cannot perform operation on different currencies: USD and EUR');
      expect(() => usd100.lessThan(eur100)).toThrow('Cannot perform operation on different currencies: USD and EUR');
    });

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

  describe('Utility Methods', () => {
    const usd100 = new CurrencyAmount(100, 'USD');
    const usdNeg50 = new CurrencyAmount(-50, 'USD');
    const usdZero = new CurrencyAmount(0, 'USD');

    it('should return absolute value', () => {
      expect(usdNeg50.abs().amount).toBe(50);
      expect(usd100.abs().amount).toBe(100);
    });

    it('should negate amount', () => {
      expect(usd100.negate().amount).toBe(-100);
      expect(usdNeg50.negate().amount).toBe(50);
    });

    it('should check zero, positive, negative', () => {
      expect(usdZero.isZero()).toBe(true);
      expect(usd100.isZero()).toBe(false);
      expect(usd100.isPositive()).toBe(true);
      expect(usdNeg50.isPositive()).toBe(false);
      expect(usdNeg50.isNegative()).toBe(true);
      expect(usd100.isNegative()).toBe(false);
    });
  });

  describe('Currency Conversion', () => {
    const usd100 = new CurrencyAmount(100, 'USD');

    it('should convert to different currency', () => {
      const eurAmount = usd100.convertTo('EUR', 0.85);
      expect(eurAmount.amount).toBe(85);
      expect(eurAmount.currency).toBe('EUR');
    });

    it('should return same amount for same currency', () => {
      const result = usd100.convertTo('USD', 1.0);
      expect(result.amount).toBe(100);
      expect(result.currency).toBe('USD');
    });

    it('should throw error for invalid exchange rate', () => {
      expect(() => usd100.convertTo('EUR', 0)).toThrow('Invalid exchange rate: 0');
      expect(() => usd100.convertTo('EUR', -1)).toThrow('Invalid exchange rate: -1');
      expect(() => usd100.convertTo('EUR', NaN)).toThrow('Invalid exchange rate: NaN');
    });
  });

  describe('Formatting', () => {
    const usd100 = new CurrencyAmount(100.50, 'USD');
    const jpy1000 = new CurrencyAmount(1000, 'JPY');

    it('should format with default options', () => {
      expect(usd100.format()).toBe('$ 100.50');
      expect(jpy1000.format()).toBe('¥ 1000');
    });

    it('should format with custom options', () => {
      expect(usd100.format({ showSymbol: false })).toBe('100.50');
      expect(usd100.format({ showCode: true })).toBe('$ 100.50 USD');
      expect(usd100.format({ showSymbol: false, showCode: true })).toBe('100.50 USD');
      expect(usd100.format({ precision: 1 })).toBe('$ 100.5');
    });

    it('should convert to string', () => {
      expect(usd100.toString()).toBe('$ 100.50');
    });

    it('should format HKD amounts with correct symbol', () => {
      const hkdAmount = new CurrencyAmount(1234.56, 'HKD');
      
      expect(hkdAmount.format()).toBe('HK$ 1234.56');
      expect(hkdAmount.format({ showSymbol: false })).toBe('1234.56');
      expect(hkdAmount.format({ showSymbol: true })).toBe('HK$ 1234.56');
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

  describe('JSON Serialization', () => {
    const usd100 = new CurrencyAmount(100.50, 'USD');

    it('should serialize to JSON', () => {
      const json = usd100.toJSON();
      expect(json).toEqual({ amount: 100.50, currency: 'USD' });
    });

    it('should create from JSON', () => {
      const json = { amount: 100.50, currency: 'USD' as CurrencyCode };
      const amount = CurrencyAmount.fromJSON(json);
      expect(amount.amount).toBe(100.50);
      expect(amount.currency).toBe('USD');
    });
  });

  describe('Static Factory Methods', () => {
    it('should create zero amount', () => {
      const zero = CurrencyAmount.zero('USD');
      expect(zero.amount).toBe(0);
      expect(zero.currency).toBe('USD');
    });

    it('should parse from string', () => {
      const amount = CurrencyAmount.parse('100.50', 'USD');
      expect(amount.amount).toBe(100.50);
      expect(amount.currency).toBe('USD');
    });

    it('should throw error for invalid string', () => {
      expect(() => CurrencyAmount.parse('invalid', 'USD')).toThrow('Cannot parse amount from: invalid');
    });

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

  describe('Utility Functions', () => {
    const usd100 = new CurrencyAmount(100, 'USD');
    const usd50 = new CurrencyAmount(50, 'USD');
    const usd25 = new CurrencyAmount(25, 'USD');
    const eur100 = new CurrencyAmount(100, 'EUR');

    it('should sum amounts of same currency', () => {
      const result = sumAmounts([usd100, usd50, usd25]);
      expect(result.amount).toBe(175);
      expect(result.currency).toBe('USD');
    });

    it('should throw error when summing different currencies', () => {
      expect(() => sumAmounts([usd100, eur100])).toThrow('Cannot sum amounts with different currencies: USD and EUR');
    });

    it('should throw error when summing empty array', () => {
      expect(() => sumAmounts([])).toThrow('Cannot sum empty array of amounts');
    });

    it('should average amounts', () => {
      const result = averageAmounts([usd100, usd50, usd25]);
      expect(result.amount).toBeCloseTo(58.33, 2);
      expect(result.currency).toBe('USD');
    });

    it('should throw error when averaging empty array', () => {
      expect(() => averageAmounts([])).toThrow('Cannot average empty array of amounts');
    });

    it('should work with HKD in utility functions', () => {
      const hkdAmounts = [
        new CurrencyAmount(100, 'HKD'),
        new CurrencyAmount(200, 'HKD'),
        new CurrencyAmount(300, 'HKD')
      ];
      
      const sum = sumAmounts(hkdAmounts);
      expect(sum.amount).toBe(600);
      expect(sum.currency).toBe('HKD');
      
      const average = averageAmounts(hkdAmounts);
      expect(average.amount).toBe(200);
      expect(average.currency).toBe('HKD');
    });
  });

  describe('Type Guards', () => {
    it('should identify CurrencyAmount instances', () => {
      const amount = new CurrencyAmount(100, 'USD');
      expect(isCurrencyAmount(amount)).toBe(true);
      expect(isCurrencyAmount({})).toBe(false);
      expect(isCurrencyAmount(null)).toBe(false);
    });

    it('should validate currency codes', () => {
      expect(isValidCurrencyCode('USD')).toBe(true);
      expect(isValidCurrencyCode('EUR')).toBe(true);
      expect(isValidCurrencyCode('INVALID')).toBe(false);
      expect(isValidCurrencyCode('')).toBe(false);
    });
  });

  describe('Immutability', () => {
    it('should not mutate original instances', () => {
      const original = new CurrencyAmount(100, 'USD');
      const result = original.add(new CurrencyAmount(50, 'USD'));
      
      expect(original.amount).toBe(100);
      expect(result.amount).toBe(150);
      expect(original).not.toBe(result);
    });
  });
});
