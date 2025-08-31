export interface User {
  id: string
  name: string
  email: string
  created: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: string
  institution?: string
  created: string
}

export interface Ticker {
  id: string
  name: string
  icon?: string // Path/URL to cached Google S2 ticker icon file
}

export interface Trade {
  id: string
  account_id: string
  type: 'Cash' | 'Shares' | 'CSP' | 'CC' | 'Call' | 'Put'
  action: 'Buy' | 'Sell' | 'Deposit' | 'Withdraw' | 'Adjustment'
  ticker_id?: string
  price: number
  quantity: number
  value: number
  strike?: number
  expiry?: string
  opened: string
  closed?: string
  close_method?: 'Manual' | 'Expired' | 'Assigned'
  created: string
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'id' | 'created'>
        Update: Partial<Omit<User, 'id' | 'created'>>
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
      trades: {
        Row: Trade
        Insert: Omit<Trade, 'id' | 'created'>
        Update: Partial<Omit<Trade, 'id' | 'created'>>
      }
    }
  }
}
