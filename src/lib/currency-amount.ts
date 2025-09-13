/**
 * CurrencyAmount - Type-safe currency handling class
 * 
 * This class ensures that currency amounts always know their currency
 * and prevents mixing different currencies in arithmetic operations.
 * 
 * Features:
 * - Type safety: Cannot accidentally mix different currencies
 * - Immutable: All operations return new instances
 * - Validation: Ensures valid currency codes and amounts
 * - Formatting: Proper display formatting with currency symbols
 * - Conversion: Support for currency conversion (when rates are available)
 */

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'CHF' | 'CNY';

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  decimals: number;
  name: string;
}

// Currency information lookup
const CURRENCY_INFO: Record<CurrencyCode, CurrencyInfo> = {
  USD: { code: 'USD', symbol: '$', decimals: 2, name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', decimals: 2, name: 'Euro' },
  GBP: { code: 'GBP', symbol: '£', decimals: 2, name: 'British Pound' },
  JPY: { code: 'JPY', symbol: '¥', decimals: 0, name: 'Japanese Yen' },
  CAD: { code: 'CAD', symbol: 'C$', decimals: 2, name: 'Canadian Dollar' },
  AUD: { code: 'AUD', symbol: 'A$', decimals: 2, name: 'Australian Dollar' },
  CHF: { code: 'CHF', symbol: 'CHF', decimals: 2, name: 'Swiss Franc' },
  CNY: { code: 'CNY', symbol: '¥', decimals: 2, name: 'Chinese Yuan' },
};

export class CurrencyAmount {
  private readonly _amount: number;
  private readonly _currency: CurrencyCode;

  constructor(amount: number, currency: CurrencyCode) {
    if (!this.isValidCurrency(currency)) {
      throw new Error(`Invalid currency code: ${currency}`);
    }
    if (!Number.isFinite(amount)) {
      throw new Error(`Invalid amount: ${amount}`);
    }
    
    this._amount = this.roundToCurrencyPrecision(amount, currency);
    this._currency = currency;
  }

  // Getters
  get amount(): number {
    return this._amount;
  }

  get currency(): CurrencyCode {
    return this._currency;
  }

  get currencyInfo(): CurrencyInfo {
    return CURRENCY_INFO[this._currency];
  }

  // Validation
  private isValidCurrency(currency: string): currency is CurrencyCode {
    return currency in CURRENCY_INFO;
  }

  private roundToCurrencyPrecision(amount: number, currency: CurrencyCode): number {
    const decimals = CURRENCY_INFO[currency].decimals;
    return Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  // Arithmetic operations (only allowed with same currency)
  add(other: CurrencyAmount): CurrencyAmount {
    this.ensureSameCurrency(other);
    return new CurrencyAmount(this._amount + other._amount, this._currency);
  }

  subtract(other: CurrencyAmount): CurrencyAmount {
    this.ensureSameCurrency(other);
    return new CurrencyAmount(this._amount - other._amount, this._currency);
  }

  multiply(scalar: number): CurrencyAmount {
    if (!Number.isFinite(scalar)) {
      throw new Error(`Invalid scalar: ${scalar}`);
    }
    return new CurrencyAmount(this._amount * scalar, this._currency);
  }

  divide(scalar: number): CurrencyAmount {
    if (!Number.isFinite(scalar) || scalar === 0) {
      throw new Error(`Invalid divisor: ${scalar}`);
    }
    return new CurrencyAmount(this._amount / scalar, this._currency);
  }

  // Comparison operations (only allowed with same currency)
  equals(other: CurrencyAmount): boolean {
    return this._currency === other._currency && this._amount === other._amount;
  }

  greaterThan(other: CurrencyAmount): boolean {
    this.ensureSameCurrency(other);
    return this._amount > other._amount;
  }

  lessThan(other: CurrencyAmount): boolean {
    this.ensureSameCurrency(other);
    return this._amount < other._amount;
  }

  greaterThanOrEqual(other: CurrencyAmount): boolean {
    this.ensureSameCurrency(other);
    return this._amount >= other._amount;
  }

  lessThanOrEqual(other: CurrencyAmount): boolean {
    this.ensureSameCurrency(other);
    return this._amount <= other._amount;
  }

  // Utility methods
  abs(): CurrencyAmount {
    return new CurrencyAmount(Math.abs(this._amount), this._currency);
  }

  negate(): CurrencyAmount {
    return new CurrencyAmount(-this._amount, this._currency);
  }

  isZero(): boolean {
    return this._amount === 0;
  }

  isPositive(): boolean {
    return this._amount > 0;
  }

  isNegative(): boolean {
    return this._amount < 0;
  }

  // Currency conversion (requires exchange rates)
  convertTo(targetCurrency: CurrencyCode, exchangeRate: number): CurrencyAmount {
    if (this._currency === targetCurrency) {
      return this;
    }
    
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      throw new Error(`Invalid exchange rate: ${exchangeRate}`);
    }

    const convertedAmount = this._amount * exchangeRate;
    return new CurrencyAmount(convertedAmount, targetCurrency);
  }

  // Formatting
  format(options?: {
    showSymbol?: boolean;
    showCode?: boolean;
    precision?: number;
  }): string {
    const {
      showSymbol = true,
      showCode = false,
      precision = this.currencyInfo.decimals
    } = options || {};

    const formattedAmount = this._amount.toFixed(precision);
    const parts = [formattedAmount];
    
    if (showSymbol) {
      parts.unshift(this.currencyInfo.symbol);
    }
    
    if (showCode) {
      parts.push(this.currency);
    }
    
    return parts.join(' ');
  }

  // JSON serialization
  toJSON(): { amount: number; currency: CurrencyCode } {
    return {
      amount: this._amount,
      currency: this._currency
    };
  }

  // String representation
  toString(): string {
    return this.format();
  }

  // Static factory methods
  static fromJSON(data: { amount: number; currency: CurrencyCode }): CurrencyAmount {
    return new CurrencyAmount(data.amount, data.currency);
  }

  static zero(currency: CurrencyCode): CurrencyAmount {
    return new CurrencyAmount(0, currency);
  }

  static parse(value: string, currency: CurrencyCode): CurrencyAmount {
    const amount = parseFloat(value);
    if (isNaN(amount)) {
      throw new Error(`Cannot parse amount from: ${value}`);
    }
    return new CurrencyAmount(amount, currency);
  }

  // Private helper
  private ensureSameCurrency(other: CurrencyAmount): void {
    if (this._currency !== other._currency) {
      throw new Error(
        `Cannot perform operation on different currencies: ${this._currency} and ${other._currency}`
      );
    }
  }
}

// Utility functions for common operations
export function sumAmounts(amounts: CurrencyAmount[]): CurrencyAmount {
  if (amounts.length === 0) {
    throw new Error('Cannot sum empty array of amounts');
  }

  const currency = amounts[0].currency;
  amounts.forEach(amount => {
    if (amount.currency !== currency) {
      throw new Error(`Cannot sum amounts with different currencies: ${currency} and ${amount.currency}`);
    }
  });

  const total = amounts.reduce((sum, amount) => sum + amount.amount, 0);
  return new CurrencyAmount(total, currency);
}

export function averageAmounts(amounts: CurrencyAmount[]): CurrencyAmount {
  if (amounts.length === 0) {
    throw new Error('Cannot average empty array of amounts');
  }

  const sum = sumAmounts(amounts);
  return sum.divide(amounts.length);
}

// Type guards
export function isCurrencyAmount(value: unknown): value is CurrencyAmount {
  return value instanceof CurrencyAmount;
}

export function isValidCurrencyCode(code: string): code is CurrencyCode {
  return code in CURRENCY_INFO;
}
