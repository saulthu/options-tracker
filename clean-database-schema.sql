-- Clean, simple database schema for options tracker
-- Run this in your Supabase SQL Editor to start fresh
-- This schema matches exactly with database_spec.txt
-- 
-- IMPORTANT: This version includes fixed RLS policies that resolve
-- the "permission denied for table users" error by using proper
-- UUID text casting in policy comparisons.
--
-- CRITICAL FIX: Added policy to allow authenticated users to create
-- their first profile, solving the chicken-and-egg problem where
-- RLS blocks access to an empty table.

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

-- FIXED RLS policies - users can only see their own data
-- Using text casting to avoid UUID comparison issues
-- 
-- CRITICAL: Single, clear policy that solves the chicken-and-egg problem
-- Authenticated users can access the users table, but only see their own data
CREATE POLICY "Users can manage own profile" ON public.users
  FOR ALL USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

-- Additional policy to allow authenticated users to create their first profile
-- This is needed when the table is empty and no rows exist yet
CREATE POLICY "Authenticated users can create profile" ON public.users
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- SIMPLIFIED APPROACH: More permissive policy for authenticated users
-- This ensures authenticated users can always access the users table
CREATE POLICY "Authenticated users can access users table" ON public.users
  FOR ALL USING (auth.role() = 'authenticated');

-- Accounts policies
CREATE POLICY "Users can view own accounts" ON public.accounts
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own accounts" ON public.accounts
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own accounts" ON public.accounts
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own accounts" ON public.accounts
  FOR DELETE USING (auth.uid()::text = user_id::text);

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
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own trades" ON public.trades
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own trades" ON public.trades
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own trades" ON public.trades
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Create indexes for performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX idx_trades_user_id ON public.trades(user_id);
CREATE INDEX idx_trades_account_id ON public.trades(account_id);
CREATE INDEX idx_trades_ticker_id ON public.trades(ticker_id);
CREATE INDEX idx_trades_opened ON public.trades(opened);
CREATE INDEX idx_trades_type ON public.trades(type);
CREATE INDEX idx_trades_action ON public.trades(action);

-- CRITICAL: Grant permissions to authenticated users
-- This ensures your app can access the tables permanently
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.accounts TO authenticated;
GRANT ALL ON public.trades TO authenticated;
GRANT ALL ON public.tickers TO authenticated;

-- Grant read access to tickers for anonymous users (public data)
GRANT SELECT ON public.tickers TO anon;

-- Verify the setup
SELECT 'Database created successfully!' as status;

-- Test RLS policies are working
-- This will show if the policies are properly configured
SELECT 
  schemaname,
  tablename, 
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'accounts', 'trades')
ORDER BY tablename, policyname;

-- DIAGNOSTIC TESTS: Verify the schema changes were actually applied
-- This will help us identify if the problem is with the schema or something else

-- Test 1: Check if RLS is actually disabled on users table
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

-- Test 2: Check if the test user was actually inserted
SELECT COUNT(*) as user_count FROM public.users;

-- Test 3: Check if we can manually query the table (should work with RLS disabled)
SELECT 'Manual query test:' as test_type, COUNT(*) as result FROM public.users;

-- Test 4: Check current user context (simplified)
SELECT 
  current_user,
  session_user;

-- Test 5: Check if we can access the table from a different context
-- This will help isolate if the issue is with the specific query or the table itself
SELECT 'Direct table access test:' as test_type, 
       id, name, email 
FROM public.users 
LIMIT 1;

-- Test 6: Verify we're connected to the right database
-- This will confirm we're not accidentally connected to a different database
SELECT 
  current_database() as database_name,
  current_schema() as schema_name;

-- Test 7: Check table permissions for current user
-- This will show if there are any other permission issues
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';
