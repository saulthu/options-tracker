"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrencyAmount = void 0;
exports.sumAmounts = sumAmounts;
exports.averageAmounts = averageAmounts;
exports.isCurrencyAmount = isCurrencyAmount;
exports.isValidCurrencyCode = isValidCurrencyCode;
// Currency information lookup
const CURRENCY_INFO = {
    USD: { code: 'USD', symbol: '$', decimals: 2, name: 'US Dollar' },
    EUR: { code: 'EUR', symbol: '€', decimals: 2, name: 'Euro' },
    GBP: { code: 'GBP', symbol: '£', decimals: 2, name: 'British Pound' },
    JPY: { code: 'JPY', symbol: '¥', decimals: 0, name: 'Japanese Yen' },
    CAD: { code: 'CAD', symbol: 'C$', decimals: 2, name: 'Canadian Dollar' },
    AUD: { code: 'AUD', symbol: 'A$', decimals: 2, name: 'Australian Dollar' },
    CHF: { code: 'CHF', symbol: 'CHF', decimals: 2, name: 'Swiss Franc' },
    CNY: { code: 'CNY', symbol: '¥', decimals: 2, name: 'Chinese Yuan' },
};
class CurrencyAmount {
    constructor(amount, currency) {
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
    get amount() {
        return this._amount;
    }
    get currency() {
        return this._currency;
    }
    get currencyInfo() {
        return CURRENCY_INFO[this._currency];
    }
    // Validation
    isValidCurrency(currency) {
        return currency in CURRENCY_INFO;
    }
    roundToCurrencyPrecision(amount, currency) {
        const decimals = CURRENCY_INFO[currency].decimals;
        return Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }
    // Arithmetic operations (only allowed with same currency)
    add(other) {
        this.ensureSameCurrency(other);
        return new CurrencyAmount(this._amount + other._amount, this._currency);
    }
    subtract(other) {
        this.ensureSameCurrency(other);
        return new CurrencyAmount(this._amount - other._amount, this._currency);
    }
    multiply(scalar) {
        if (!Number.isFinite(scalar)) {
            throw new Error(`Invalid scalar: ${scalar}`);
        }
        return new CurrencyAmount(this._amount * scalar, this._currency);
    }
    divide(scalar) {
        if (!Number.isFinite(scalar) || scalar === 0) {
            throw new Error(`Invalid divisor: ${scalar}`);
        }
        return new CurrencyAmount(this._amount / scalar, this._currency);
    }
    // Comparison operations (only allowed with same currency)
    equals(other) {
        return this._currency === other._currency && this._amount === other._amount;
    }
    greaterThan(other) {
        this.ensureSameCurrency(other);
        return this._amount > other._amount;
    }
    lessThan(other) {
        this.ensureSameCurrency(other);
        return this._amount < other._amount;
    }
    greaterThanOrEqual(other) {
        this.ensureSameCurrency(other);
        return this._amount >= other._amount;
    }
    lessThanOrEqual(other) {
        this.ensureSameCurrency(other);
        return this._amount <= other._amount;
    }
    // Utility methods
    abs() {
        return new CurrencyAmount(Math.abs(this._amount), this._currency);
    }
    negate() {
        return new CurrencyAmount(-this._amount, this._currency);
    }
    isZero() {
        return this._amount === 0;
    }
    isPositive() {
        return this._amount > 0;
    }
    isNegative() {
        return this._amount < 0;
    }
    // Currency conversion (requires exchange rates)
    convertTo(targetCurrency, exchangeRate) {
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
    format(options) {
        const { showSymbol = true, showCode = false, precision = this.currencyInfo.decimals } = options || {};
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
    toJSON() {
        return {
            amount: this._amount,
            currency: this._currency
        };
    }
    // String representation
    toString() {
        return this.format();
    }
    // Static factory methods
    static fromJSON(data) {
        return new CurrencyAmount(data.amount, data.currency);
    }
    static zero(currency) {
        return new CurrencyAmount(0, currency);
    }
    static parse(value, currency) {
        const amount = parseFloat(value);
        if (isNaN(amount)) {
            throw new Error(`Cannot parse amount from: ${value}`);
        }
        return new CurrencyAmount(amount, currency);
    }
    // Private helper
    ensureSameCurrency(other) {
        if (this._currency !== other._currency) {
            throw new Error(`Cannot perform operation on different currencies: ${this._currency} and ${other._currency}`);
        }
    }
}
exports.CurrencyAmount = CurrencyAmount;
// Utility functions for common operations
function sumAmounts(amounts) {
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
function averageAmounts(amounts) {
    if (amounts.length === 0) {
        throw new Error('Cannot average empty array of amounts');
    }
    const sum = sumAmounts(amounts);
    return sum.divide(amounts.length);
}
// Type guards
function isCurrencyAmount(value) {
    return value instanceof CurrencyAmount;
}
function isValidCurrencyCode(code) {
    return code in CURRENCY_INFO;
}
