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

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'CHF' | 'CNY' | 'HKD';

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
  HKD: { code: 'HKD', symbol: 'HK$', decimals: 2, name: 'Hong Kong Dollar' },
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

  // Convenience methods for common operations
  times(quantity: number): CurrencyAmount {
    return this.multiply(quantity);
  }

  plus(other: CurrencyAmount): CurrencyAmount {
    return this.add(other);
  }

  minus(other: CurrencyAmount): CurrencyAmount {
    return this.subtract(other);
  }

  // Comparison with numbers (for sorting, etc.)
  greaterThanAmount(amount: number): boolean {
    return this._amount > amount;
  }

  lessThanAmount(amount: number): boolean {
    return this._amount < amount;
  }

  greaterThanOrEqualAmount(amount: number): boolean {
    return this._amount >= amount;
  }

  lessThanOrEqualAmount(amount: number): boolean {
    return this._amount <= amount;
  }

  equalsAmount(amount: number): boolean {
    return this._amount === amount;
  }

  // Formatting shortcuts
  formatShort(): string {
    return this.format({ showSymbol: true, showCode: false });
  }

  formatWithCode(): string {
    return this.format({ showSymbol: true, showCode: true });
  }

  formatNoSymbol(): string {
    return this.format({ showSymbol: false, showCode: false });
  }

  // Math operations that return numbers (for compatibility)
  toNumber(): number {
    return this._amount;
  }

  // Safe arithmetic that handles undefined/null
  static safeAdd(a: CurrencyAmount | undefined, b: CurrencyAmount | undefined): CurrencyAmount | undefined {
    if (!a && !b) return undefined;
    if (!a) return b;
    if (!b) return a;
    return a.add(b);
  }

  static safeSubtract(a: CurrencyAmount | undefined, b: CurrencyAmount | undefined): CurrencyAmount | undefined {
    if (!a) return b?.negate();
    if (!b) return a;
    return a.subtract(b);
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

  static multiply(scalar: number, currencyAmount: CurrencyAmount): CurrencyAmount {
    return currencyAmount.multiply(scalar);
  }

  // Additional static utility methods
  static sum(amounts: CurrencyAmount[]): CurrencyAmount | undefined {
    if (amounts.length === 0) return undefined;
    if (amounts.length === 1) return amounts[0];
    
    const firstCurrency = amounts[0].currency;
    let total = CurrencyAmount.zero(firstCurrency);
    
    for (const amount of amounts) {
      if (amount.currency !== firstCurrency) {
        throw new Error(`Cannot sum amounts with different currencies: ${firstCurrency} and ${amount.currency}`);
      }
      total = total.add(amount);
    }
    
    return total;
  }

  static average(amounts: CurrencyAmount[]): CurrencyAmount | undefined {
    if (amounts.length === 0) return undefined;
    if (amounts.length === 1) return amounts[0];
    
    const sum = CurrencyAmount.sum(amounts);
    return sum?.divide(amounts.length);
  }

  static max(amounts: CurrencyAmount[]): CurrencyAmount | undefined {
    if (amounts.length === 0) return undefined;
    if (amounts.length === 1) return amounts[0];
    
    const firstCurrency = amounts[0].currency;
    let maxAmount = amounts[0];
    
    for (const amount of amounts) {
      if (amount.currency !== firstCurrency) {
        throw new Error(`Cannot compare amounts with different currencies: ${firstCurrency} and ${amount.currency}`);
      }
      if (amount.greaterThan(maxAmount)) {
        maxAmount = amount;
      }
    }
    
    return maxAmount;
  }

  static min(amounts: CurrencyAmount[]): CurrencyAmount | undefined {
    if (amounts.length === 0) return undefined;
    if (amounts.length === 1) return amounts[0];
    
    const firstCurrency = amounts[0].currency;
    let minAmount = amounts[0];
    
    for (const amount of amounts) {
      if (amount.currency !== firstCurrency) {
        throw new Error(`Cannot compare amounts with different currencies: ${firstCurrency} and ${amount.currency}`);
      }
      if (amount.lessThan(minAmount)) {
        minAmount = amount;
      }
    }
    
    return minAmount;
  }

  // Create from number with automatic currency detection (for common cases)
  static fromNumber(amount: number, currency: CurrencyCode = 'USD'): CurrencyAmount {
    return new CurrencyAmount(amount, currency);
  }

  // Create from string with currency detection
  static fromString(value: string, currency: CurrencyCode = 'USD'): CurrencyAmount {
    const amount = parseFloat(value);
    if (isNaN(amount)) {
      throw new Error(`Cannot parse amount from: ${value}`);
    }
    return new CurrencyAmount(amount, currency);
  }

  // Private helper
  private ensureSameCurrency(other: CurrencyAmount): void {
    if (this._currency !== other._currency) {
      const errorMessage = `🚨 CURRENCY MISMATCH: Cannot perform operation on different currencies: ${this._currency} and ${other._currency}`;
      
      // Enhanced error logging for development
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.error(errorMessage);
        console.error('Stack trace:', new Error().stack);
        
        // Show a prominent error in the UI during development
        this.showCurrencyErrorInUI(errorMessage, this._currency, other._currency);
      }
      
      throw new Error(errorMessage);
    }
  }

  // Show currency error prominently in the UI during development
  private showCurrencyErrorInUI(message: string, currency1: string, currency2: string): void {
    if (typeof window === 'undefined') return;
    
    // Create or update error display
    let errorDiv = document.getElementById('currency-error-display');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.id = 'currency-error-display';
      errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc2626;
        color: white;
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        z-index: 9999;
        max-width: 400px;
        font-family: monospace;
        font-size: 14px;
        border: 2px solid #ef4444;
      `;
      document.body.appendChild(errorDiv);
    }
    
    // Update error content
    errorDiv.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 18px; margin-right: 8px;">🚨</span>
        <strong>Currency Mismatch Error</strong>
        <button onclick="this.parentElement.parentElement.remove()" 
                style="margin-left: auto; background: none; border: none; color: white; font-size: 18px; cursor: pointer;">×</button>
      </div>
      <div style="margin-bottom: 8px;">${message}</div>
      <div style="font-size: 12px; opacity: 0.9;">
        Currencies: <strong>${currency1}</strong> vs <strong>${currency2}</strong>
      </div>
      <div style="font-size: 11px; opacity: 0.7; margin-top: 4px;">
        Check the console for full stack trace
      </div>
    `;
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (errorDiv && errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 10000);
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
      const errorMessage = `🚨 CURRENCY MISMATCH: Cannot sum amounts with different currencies: ${currency} and ${amount.currency}`;
      
      // Enhanced error logging for development
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.error(errorMessage);
        console.error('Stack trace:', new Error().stack);
        
        // Show a prominent error in the UI during development
        showCurrencyErrorInUI(errorMessage, currency, amount.currency);
      }
      
      throw new Error(errorMessage);
    }
  });

  const total = amounts.reduce((sum, amount) => sum + amount.amount, 0);
  return new CurrencyAmount(total, currency);
}

// Helper function to show currency error in UI (used by utility functions)
function showCurrencyErrorInUI(message: string, currency1: string, currency2: string): void {
  if (typeof window === 'undefined') return;
  
  // Create or update error display
  let errorDiv = document.getElementById('currency-error-display');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.id = 'currency-error-display';
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc2626;
      color: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      z-index: 9999;
      max-width: 400px;
      font-family: monospace;
      font-size: 14px;
      border: 2px solid #ef4444;
    `;
    document.body.appendChild(errorDiv);
  }
  
  // Update error content
  errorDiv.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 8px;">
      <span style="font-size: 18px; margin-right: 8px;">🚨</span>
      <strong>Currency Mismatch Error</strong>
      <button onclick="this.parentElement.parentElement.remove()" 
              style="margin-left: auto; background: none; border: none; color: white; font-size: 18px; cursor: pointer;">×</button>
    </div>
    <div style="margin-bottom: 8px;">${message}</div>
    <div style="font-size: 12px; opacity: 0.9;">
      Currencies: <strong>${currency1}</strong> vs <strong>${currency2}</strong>
    </div>
    <div style="font-size: 11px; opacity: 0.7; margin-top: 4px;">
      Check the console for full stack trace
    </div>
  `;
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (errorDiv && errorDiv.parentNode) {
      errorDiv.parentNode.removeChild(errorDiv);
    }
  }, 10000);
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
