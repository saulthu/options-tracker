
import { CurrencyAmount } from '@/lib/currency-amount';

export interface Ticker {
  id: string
  user_id: string
  name: string
  icon?: string // Path/URL to cached Google S2 ticker icon file
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
  memo?: string
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
