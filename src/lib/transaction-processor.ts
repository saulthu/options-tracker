/**
 * Transaction Processor
 * 
 * Converts raw database transactions to processed transactions with CurrencyAmount
 * for type-safe currency handling in business logic.
 */

import { CurrencyAmount, CurrencyCode, isValidCurrencyCode } from './currency-amount';
import { RawTransaction, ProcessedTransaction } from '../types/episodes';

/**
 * Convert a raw transaction from the database to a processed transaction with CurrencyAmount
 * Since RawTransaction now has CurrencyAmount fields, this mainly handles cash transaction logic
 */
export function processTransaction(rawTxn: RawTransaction): ProcessedTransaction {
  // Validate currency code
  if (!isValidCurrencyCode(rawTxn.currency)) {
    throw new Error(`Invalid currency code in transaction ${rawTxn.id}: ${rawTxn.currency}`);
  }

  const currency = rawTxn.currency as CurrencyCode;

  // For cash transactions, ensure price is 1.0 with correct currency
  let price: CurrencyAmount | undefined;
  if (rawTxn.instrument_kind === 'CASH') {
    price = new CurrencyAmount(1.0, currency);
  } else {
    price = rawTxn.price; // Already a CurrencyAmount
  }

  // Fees are already CurrencyAmount
  const fees = rawTxn.fees;

  // Calculate total value based on instrument kind
  const totalValue = calculateTotalValue(rawTxn, currency, fees, price);

  return {
    ...rawTxn,
    price,
    fees,
    totalValue
  };
}

/**
 * Calculate the total value of a transaction based on its instrument kind
 */
function calculateTotalValue(
  rawTxn: RawTransaction,
  currency: CurrencyCode,
  fees: CurrencyAmount,
  price?: CurrencyAmount
): CurrencyAmount {
  switch (rawTxn.instrument_kind) {
    case 'CASH':
      // For cash transactions: qty * price (where price = 1.0 with correct currency)
      // This ensures the total value includes the currency information
      if (!price) {
        throw new Error('Price should be set to 1.0 for cash transactions');
      }
      return price.multiply(rawTxn.qty);

    case 'SHARES':
    case 'CALL':
    case 'PUT':
      if (!price) {
        throw new Error(`Price is required for ${rawTxn.instrument_kind} transactions`);
      }
      
      // For shares and options: (qty * price) + fees
      // Note: For options, qty represents contracts, and we need to multiply by 100
      const multiplier = (rawTxn.instrument_kind === 'CALL' || rawTxn.instrument_kind === 'PUT') ? 100 : 1;
      const grossValue = price.multiply(rawTxn.qty * multiplier);
      
      // Apply side (BUY = negative, SELL = positive)
      const sideMultiplier = rawTxn.side === 'BUY' ? -1 : 1;
      const netValue = grossValue.multiply(sideMultiplier);
      
      return netValue.add(fees.multiply(sideMultiplier));

    default:
      throw new Error(`Unknown instrument kind: ${rawTxn.instrument_kind}`);
  }
}

/**
 * Convert multiple raw transactions to processed transactions
 */
export function processTransactions(rawTxns: RawTransaction[]): ProcessedTransaction[] {
  return rawTxns.map(processTransaction);
}

/**
 * Group processed transactions by currency for separate processing
 */
export function groupByCurrency(processedTxns: ProcessedTransaction[]): Map<CurrencyCode, ProcessedTransaction[]> {
  const groups = new Map<CurrencyCode, ProcessedTransaction[]>();
  
  for (const txn of processedTxns) {
    const currency = txn.fees.currency; // All amounts in a transaction have the same currency
    if (!groups.has(currency)) {
      groups.set(currency, []);
    }
    groups.get(currency)!.push(txn);
  }
  
  return groups;
}

/**
 * Calculate total value across all transactions of the same currency
 */
export function calculateTotalValueByCurrency(processedTxns: ProcessedTransaction[]): Map<CurrencyCode, CurrencyAmount> {
  const totals = new Map<CurrencyCode, CurrencyAmount>();
  
  for (const txn of processedTxns) {
    const currency = txn.fees.currency;
    const currentTotal = totals.get(currency) || CurrencyAmount.zero(currency);
    totals.set(currency, currentTotal.add(txn.totalValue));
  }
  
  return totals;
}

/**
 * Validate that all transactions in a group have the same currency
 */
export function validateSameCurrency(processedTxns: ProcessedTransaction[]): void {
  if (processedTxns.length === 0) return;
  
  const firstCurrency = processedTxns[0].fees.currency;
  
  for (const txn of processedTxns) {
    if (txn.fees.currency !== firstCurrency) {
      throw new Error(
        `Currency mismatch: expected ${firstCurrency}, found ${txn.fees.currency} in transaction ${txn.id}`
      );
    }
  }
}

/**
 * Convert processed transaction back to raw format (for database storage)
 */
export function unprocessTransaction(processedTxn: ProcessedTransaction): RawTransaction {
  return {
    ...processedTxn,
    price: processedTxn.price,
    fees: processedTxn.fees,
    currency: processedTxn.fees.currency
  };
}

/**
 * Convert multiple processed transactions back to raw format
 */
export function unprocessTransactions(processedTxns: ProcessedTransaction[]): RawTransaction[] {
  return processedTxns.map(unprocessTransaction);
}
