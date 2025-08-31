export interface User {
  id: string
  email: string
  created_at: string
  updated_at: string
}

export interface Position {
  id: string
  user_id: string
  trading_account_id: string
  symbol: string
  type: 'Call' | 'Put'
  strike: number
  expiration: string
  quantity: number
  entry_price: number
  current_price: number
  pnl: number
  status: 'Open' | 'Closed' | 'Assigned'
  notes?: string
  created_at: string
  updated_at: string
}

export interface TradingAccount {
  id: string
  user_id: string
  name: string
  type: 'Personal' | 'IRA' | '401k' | 'Roth IRA' | 'Traditional IRA' | 'Corporate' | 'SMSF' | 'Other'
  institution?: string
  account_number?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PnLHistory {
  id: string
  user_id: string
  date: string
  total_pnl: number
  open_positions: number
  portfolio_value: number
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
      }
      positions: {
        Row: Position
        Insert: Omit<Position, 'id' | 'user_id' | 'trading_account_id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Position, 'id' | 'user_id' | 'trading_account_id' | 'created_at' | 'updated_at'>>
      }
      trading_accounts: {
        Row: TradingAccount
        Insert: Omit<TradingAccount, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TradingAccount, 'id' | 'created_at' | 'updated_at'>>
      }
      pnl_history: {
        Row: PnLHistory
        Insert: Omit<PnLHistory, 'id' | 'user_id' | 'created_at'>
        Update: Partial<Omit<PnLHistory, 'id' | 'user_id' | 'created_at'>>
      }
    }
  }
}
