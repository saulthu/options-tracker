
export interface Ticker {
  id: string
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

export interface Ticker {
  id: string
  name: string
  icon?: string
}

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
  strike?: number
  side?: 'BUY' | 'SELL'
  qty: number
  price?: number
  fees: number
  memo?: string
  // Joined data from PortfolioContext
  tickers?: {
    id: string
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

// Legacy Trade interface for backward compatibility during transition
export interface Trade {
  id: string
  account_id: string
  type: 'Cash' | 'Shares' | 'CSP' | 'CC' | 'Call' | 'Put'
  action: 'Buy' | 'Sell' | 'Deposit' | 'Withdraw' | 'Adjustment' | 'Assigned' | 'Called Away'
  ticker_id?: string
  price: number
  quantity: number
  value: number
  strike?: number
  expiry?: string
  opened: string
  closed?: string
  close_method?: 'Manual' | 'Expired' | 'Assigned' | 'Called Away'
  created: string
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
      // Legacy trades table (for backward compatibility)
      trades: {
        Row: Trade
        Insert: Omit<Trade, 'id' | 'created'>
        Update: Partial<Omit<Trade, 'id' | 'created'>>
      }
    }
  }
}
