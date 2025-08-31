-- Clean, simple database schema for options tracker
-- Run this in your Supabase SQL Editor to start fresh
-- This schema matches exactly with database_spec.txt

-- Drop everything first (since you said you have no data to lose)
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Grant necessary permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- User table (exactly as per database_spec.txt)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Account table (exactly as per database_spec.txt)
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  institution TEXT NOT NULL,
  created TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ticker table (exactly as per database_spec.txt)
CREATE TABLE public.tickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT -- Store path/URL to cached Google S2 ticker icon file
);

-- Trade table (exactly as per database_spec.txt)
CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('Cash', 'Shares', 'CSP', 'CC', 'Call', 'Put')),
  action TEXT NOT NULL CHECK (action IN ('Buy', 'Sell', 'Deposit', 'Withdraw', 'Adjustment')),
  ticker_id UUID REFERENCES public.tickers(id) ON DELETE SET NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL,
  value DECIMAL(12,2) NOT NULL,
  strike DECIMAL(10,2),
  expiry DATE,
  opened DATE NOT NULL,
  closed DATE,
  close_method TEXT CHECK (close_method IN ('Manual', 'Expired', 'Assigned')),
  created TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- RLS Policy Strategy:
-- 1. Users: Can only access their own profile (CRUD)
-- 2. Accounts: Can only access their own accounts (CRUD)  
-- 3. Tickers: Anyone can view, authenticated users can manage (CRUD)
-- 4. Trades: Can only access their own trades (CRUD)

-- Simple RLS policies - users can only see their own data
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile" ON public.users
  FOR DELETE USING (auth.uid() = id);

-- Accounts policies
CREATE POLICY "Users can view own accounts" ON public.accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON public.accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" ON public.accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" ON public.accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Tickers are public (anyone can view)
CREATE POLICY "Anyone can view tickers" ON public.tickers
  FOR SELECT USING (true);

-- Only authenticated users can insert new tickers (for now)
CREATE POLICY "Authenticated users can insert tickers" ON public.tickers
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Only authenticated users can update tickers (for now)
CREATE POLICY "Authenticated users can update tickers" ON public.tickers
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Only authenticated users can delete tickers (for now)
CREATE POLICY "Authenticated users can delete tickers" ON public.tickers
  FOR DELETE USING (auth.role() = 'authenticated');

-- Trades policies
CREATE POLICY "Users can view own trades" ON public.trades
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades" ON public.trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades" ON public.trades
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trades" ON public.trades
  FOR DELETE USING (auth.uid() = user_id);



-- Create indexes for performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX idx_trades_user_id ON public.trades(user_id);
CREATE INDEX idx_trades_account_id ON public.trades(account_id);
CREATE INDEX idx_trades_ticker_id ON public.trades(ticker_id);
CREATE INDEX idx_trades_opened ON public.trades(opened);
CREATE INDEX idx_trades_type ON public.trades(type);
CREATE INDEX idx_trades_action ON public.trades(action);

-- Verify the setup
SELECT 'Database created successfully!' as status;
