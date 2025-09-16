-- Clean database schema for options tracker
-- Run this in your Supabase SQL Editor to start fresh
-- This schema implements the episode-based portfolio calculation system

-- Drop everything first (since you said you have no data to lose)
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Grant necessary permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- 1) User table (authentication and account management)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Account table (user's trading accounts)
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  institution TEXT NOT NULL,
  account_number TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure account names are unique per user
  UNIQUE(user_id, name)
);

-- 3) Ticker table (financial instruments)
CREATE TABLE public.tickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT, -- path/URL to cached icon file
  market_data JSONB, -- cached market data (candles, options, etc.)
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure ticker names are unique per user
  UNIQUE(user_id, name)
);

-- 4) Transaction table (immutable source of truth)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL, -- broker event time (ISO8601)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Instrument identity
  instrument_kind TEXT NOT NULL CHECK (instrument_kind IN ('CASH', 'SHARES', 'CALL', 'PUT')),
  ticker_id UUID REFERENCES public.tickers(id) ON DELETE SET NULL,
  expiry DATE, -- CALL/PUT only (YYYY-MM-DD)
  strike DECIMAL(10,2), -- CALL/PUT only
  
  -- Trade / cash
  side TEXT CHECK (side IN ('BUY', 'SELL')), -- SHARES/CALL/PUT; ignored for CASH
  qty DECIMAL(15,6) NOT NULL, -- CASH: signed cash movement; others: shares/contracts
  price DECIMAL(10,2), -- per share/contract; not used for CASH
  fees DECIMAL(10,2) DEFAULT 0, -- ≥ 0, all-in for the txn (commission + exchange)
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (LENGTH(currency) = 3), -- 3-letter currency code (ISO 4217)
  memo TEXT -- free text notes
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for accounts table
CREATE POLICY "Users can view own accounts" ON public.accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" ON public.accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON public.accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" ON public.accounts
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for tickers table (user-specific)
CREATE POLICY "Users can view own tickers" ON public.tickers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tickers" ON public.tickers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tickers" ON public.tickers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tickers" ON public.tickers
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for transactions table
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX idx_tickers_user_id ON public.tickers(user_id);
CREATE INDEX idx_tickers_name ON public.tickers(name);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX idx_transactions_ticker_id ON public.transactions(ticker_id);
CREATE INDEX idx_transactions_timestamp ON public.transactions(timestamp);
CREATE INDEX idx_transactions_instrument_kind ON public.transactions(instrument_kind);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to authenticated users
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.accounts TO authenticated;
GRANT ALL ON public.tickers TO authenticated;
GRANT ALL ON public.transactions TO authenticated;

-- Note: Tickers are now user-specific, so no anonymous access

-- Verify the setup
SELECT 'Database created successfully!' as status;