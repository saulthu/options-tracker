
import { CurrencyAmount } from '@/lib/currency-amount';
import { ParsedMemo } from '@/lib/memo-parser';

export interface Ticker {
  id: string
  user_id: string
  name: string
  icon?: string // Path/URL to cached Google S2 ticker icon file
  market_data?: Record<string, unknown> // JSONB market data blob
  updated_at?: string
}

// New schema: User and Transaction tables
export interface User {
  id: string
  email: string
  name?: string
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: string
  institution: string
  account_number?: string
  description?: string
  created_at: string
}

export type AccountFormData = Omit<Account, 'id' | 'user_id' | 'created_at'>;


export interface Transaction {
  id: string
  user_id: string
  account_id: string
  timestamp: string // ISO8601 broker event time
  created_at: string
  updated_at: string
  instrument_kind: 'CASH' | 'SHARES' | 'CALL' | 'PUT'
  ticker_id?: string
  expiry?: string // YYYY-MM-DD
  strike?: CurrencyAmount
  side?: 'BUY' | 'SELL'
  qty: number
  price?: CurrencyAmount
  fees: CurrencyAmount
  currency: string // 3-letter currency code (ISO 4217) - kept for database compatibility
  memo?: string // Multi-line text field:
  // - First line: Free text description of the transaction
  // - Subsequent lines: One hashtag per line in format "#tagname"
  // - Example: "Bought AAPL shares\n#tech\n#long-term\n#dividend"
  // Parsed memo data (computed from memo field)
  parsedMemo?: ParsedMemo
  // Joined data from PortfolioContext
  tickers?: {
    id: string
    user_id: string
    name: string
    icon?: string
  }
  accounts?: {
    id: string
    name: string
    type: string
    institution: string
  }
}


export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
      }
      accounts: {
        Row: Account
        Insert: Omit<Account, 'id' | 'created'>
        Update: Partial<Omit<Account, 'id' | 'created'>>
      }
      tickers: {
        Row: Ticker
        Insert: Omit<Ticker, 'id'>
        Update: Partial<Omit<Ticker, 'id'>>
      }
      transactions: {
        Row: Transaction
        Insert: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Transaction, 'id' | 'created_at' | 'updated_at'>>
      }
    }
  }
}
