// TypeScript interfaces for the new episode-based portfolio calculation system
// Based on updated_portfolio_calc.md specification

import { CurrencyAmount } from '../lib/currency-amount';

export type InstrumentKind = 'CASH' | 'SHARES' | 'CALL' | 'PUT';
export type KindGroup = 'CASH' | 'SHARES' | 'OPTION';

/**
 * LedgerRow — statement+validation+running balances
 * Each transaction becomes a ledger row with validation and cash effects
 */
export interface LedgerRow {
  txnId: string;
  userId: string;
  accountId: string;
  timestamp: string; // ISO8601 datetime
  instrumentKind: InstrumentKind;
  ticker?: string; // resolved from ticker_id
  expiry?: string; // YYYY-MM-DD for options
  strike?: number; // per share for options
  side?: 'BUY' | 'SELL'; // ignored for CASH
  qty: number;
  price?: number; // per share/contract (not used for CASH)
  fees: number;
  memo?: string;

  // Calculated fields
  cashDelta: number; // +/- cash effect of this txn
  balanceAfter: number; // account running balance after txn
  accepted: boolean; // false if rejected by rules
  error?: string; // rejection reason
}

/**
 * EpisodeTxn — individual transaction within an episode
 * Contains the same data as LedgerRow but with episode-specific fields
 */
export interface EpisodeTxn {
  txnId: string;
  timestamp: string;
  instrumentKind: InstrumentKind;
  ticker?: string;
  expiry?: string;
  strike?: number;
  side?: 'BUY' | 'SELL';
  qty: number;
  price?: number;
  fees: number;
  cashDelta: number;
  realizedPnLDelta: number; // P&L realized in this specific transaction
  note?: string; // "ROLL-CLOSE", "ROLL-OPEN", etc.
  
  // Options trading terminology
  actionTerm?: 'BTO' | 'STO' | 'BTC' | 'STC' | 'BUY' | 'SELL'; // BTO/STO/BTC/STC for options, BUY/SELL for others
}

/**
 * PositionEpisode — human-friendly holdings (with cash episodes)
 * Groups related transactions into logical episodes
 */
export interface PositionEpisode {
  episodeId: string;
  userId: string;
  accountId: string;
  episodeKey: string; // CASH | <TICKER> | <TICKER>|CALL | <TICKER>|PUT
  kindGroup: KindGroup;

  // Current leg snapshot (for quick display)
  currentInstrumentKey?: string; // e.g. "TSLA|2025-12-19|200|PUT"
  currentRight?: 'CALL' | 'PUT';
  currentExpiry?: string;
  currentStrike?: number;
  
  // Options directionality
  optionDirection?: 'CSP' | 'CC' | 'CALL' | 'PUT'; // Logical position meaning for options

  // Lifecycle
  openTimestamp: string;
  closeTimestamp?: string; // set when qty=0 (cash episodes close immediately)
  rolled: boolean; // true if roll happened within this episode

  // Evolving economics
  qty: number; // SHARES ≥ 0; OPTIONS may be ±; 0 at closed
  avgPrice: number; // per-unit entry average (fee-inclusive on opens/adds)
  totalFees: number;
  cashTotal: number; // sum of cashDelta across episode (or cash value for cash episode)
  realizedPnLTotal: number;

  // All transactions in this episode
  txns: EpisodeTxn[];
}

/**
 * Portfolio calculation result
 * Contains all derived data from raw transactions
 */
export interface PortfolioResult {
  ledger: LedgerRow[];
  balances: Map<string, number>; // accountId -> cash balance
  episodes: PositionEpisode[];
}

/**
 * Raw transaction from database (before processing)
 */
export interface RawTransaction {
  id: string;
  user_id: string;
  account_id: string;
  timestamp: string;
  created_at: string;
  updated_at: string;
  instrument_kind: InstrumentKind;
  ticker_id?: string;
  expiry?: string;
  strike?: number;
  side?: 'BUY' | 'SELL';
  qty: number;
  price?: number;
  fees: number;
  currency: string; // 3-letter currency code (ISO 4217) - kept for database compatibility
  memo?: string;
  // Joined data from PortfolioContext
  tickers?: {
    id: string;
    user_id: string;
    name: string;
    icon?: string;
  };
  accounts?: {
    id: string;
    name: string;
    type: string;
    institution: string;
  };
}

/**
 * Processed transaction with CurrencyAmount for business logic
 */
export interface ProcessedTransaction {
  id: string;
  user_id: string;
  account_id: string;
  timestamp: string;
  created_at: string;
  updated_at: string;
  instrument_kind: InstrumentKind;
  ticker_id?: string;
  expiry?: string;
  strike?: number;
  side?: 'BUY' | 'SELL';
  qty: number;
  price?: CurrencyAmount;
  fees: CurrencyAmount;
  totalValue: CurrencyAmount; // qty * price + fees (for shares/options) or qty (for cash)
  memo?: string;
  // Joined data from PortfolioContext
  tickers?: {
    id: string;
    user_id: string;
    name: string;
    icon?: string;
  };
  accounts?: {
    id: string;
    name: string;
    type: string;
    institution: string;
  };
}

/**
 * Ticker lookup map for resolving ticker_id to ticker name
 */
export type TickerLookup = Map<string, string>;

/**
 * Opening balances map for accounts
 */
export type OpeningBalances = Map<string, number>;
