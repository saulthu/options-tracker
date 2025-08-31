-- Safe migration script for new database schema
-- This script can be run multiple times safely
-- Based on new specification in docs/database_spec.txt

-- Drop existing tables if they exist (since we're starting fresh)
DO $$ 
BEGIN
    -- Drop tables in reverse dependency order
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'trades') THEN
        DROP TABLE public.trades CASCADE;
        RAISE NOTICE 'Dropped trades table';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tickers') THEN
        DROP TABLE public.tickers CASCADE;
        RAISE NOTICE 'Dropped tickers table';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'accounts') THEN
        DROP TABLE public.accounts CASCADE;
        RAISE NOTICE 'Dropped accounts table';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        DROP TABLE public.users CASCADE;
        RAISE NOTICE 'Dropped users table';
    END IF;
    
    -- Drop old tables that are no longer needed
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'positions') THEN
        DROP TABLE public.positions CASCADE;
        RAISE NOTICE 'Dropped positions table';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'trading_accounts') THEN
        DROP TABLE public.trading_accounts CASCADE;
        RAISE NOTICE 'Dropped trading_accounts table';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pnl_history') THEN
        DROP TABLE public.pnl_history CASCADE;
        RAISE NOTICE 'Dropped pnl_history table';
    END IF;
END $$;

-- Create users table
CREATE TABLE public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create accounts table
CREATE TABLE public.accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  institution TEXT,
  created TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tickers table
CREATE TABLE public.tickers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT
);

-- Create trades table
CREATE TABLE public.trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('Cash', 'Shares', 'CSP', 'CC', 'Call', 'Put')) NOT NULL,
  action TEXT CHECK (action IN ('Buy', 'Sell', 'Deposit', 'Withdraw', 'Adjustment')) NOT NULL,
  ticker_id UUID REFERENCES public.tickers(id) ON DELETE SET NULL,
  price DECIMAL(10,4) NOT NULL,
  value DECIMAL(12,2) NOT NULL,
  quantity INTEGER NOT NULL,
  strike DECIMAL(10,2),
  expiry DATE,
  opened DATE NOT NULL,
  closed DATE,
  close_method TEXT CHECK (close_method IN ('Manual', 'Expired', 'Assigned')),
  created TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX idx_accounts_type ON public.accounts(type);
CREATE INDEX idx_trades_account_id ON public.trades(account_id);
CREATE INDEX idx_trades_type ON public.trades(type);
CREATE INDEX idx_trades_ticker_id ON public.trades(ticker_id);
CREATE INDEX idx_trades_opened ON public.trades(opened);
CREATE INDEX idx_trades_closed ON public.trades(closed);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Allow the trigger function to insert new user profiles
CREATE POLICY "Allow trigger function to insert user profiles" ON public.users
  FOR INSERT WITH CHECK (true);

-- Accounts policies
CREATE POLICY "Users can view own accounts" ON public.accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" ON public.accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow the trigger function to insert default accounts
CREATE POLICY "Allow trigger function to insert default accounts" ON public.accounts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own accounts" ON public.accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" ON public.accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Tickers policies (public read, authenticated insert/update)
CREATE POLICY "Anyone can view tickers" ON public.tickers
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert tickers" ON public.tickers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update tickers" ON public.tickers
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Trades policies
CREATE POLICY "Users can view own trades" ON public.trades
  FOR SELECT USING (auth.uid() = account_id);

CREATE POLICY "Users can insert own trades" ON public.trades
  FOR INSERT WITH CHECK (auth.uid() = account_id);

CREATE POLICY "Users can update own trades" ON public.trades
  FOR UPDATE USING (auth.uid() = account_id);

CREATE POLICY "Users can delete own trades" ON public.trades
  FOR DELETE USING (auth.uid() = account_id);

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_name TEXT;
  default_account_id UUID;
BEGIN
  -- Extract first part of email (before @) for default name
  default_name := split_part(NEW.email, '@', 1);
  
  -- Insert user profile with default name
  INSERT INTO public.users (id, name, email)
  VALUES (NEW.id, default_name, NEW.email);
  
  -- Create a default trading account for the user
  INSERT INTO public.accounts (id, user_id, name, type, institution)
  VALUES (gen_random_uuid(), NEW.id, 'Main Trading Account', 'Individual', 'TD Ameritrade')
  RETURNING id INTO default_account_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call the function if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        CREATE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
        RAISE NOTICE 'Created trigger on_auth_user_created';
    ELSE
        RAISE NOTICE 'Trigger on_auth_user_created already exists';
    END IF;
END $$;

-- Success message
SELECT 'New database schema migration completed successfully!' as status;
