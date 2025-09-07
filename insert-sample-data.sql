-- Sample data for the updated schema with User, Account, Ticker, and Transaction tables
-- Run this in your Supabase SQL Editor after running clean-database-schema.sql

-- First, clear any existing data
DELETE FROM public.transactions;
DELETE FROM public.accounts;
DELETE FROM public.tickers;
-- Note: We don't delete users - we use the existing authenticated user

-- Check if we have any users in public.users
SELECT 'Users count:' as debug, COUNT(*) as user_count FROM public.users;

-- Get the first user ID
SELECT 'First user ID:' as debug, id as first_user_id FROM public.users LIMIT 1;

-- Insert sample account (using the user ID we just created)
INSERT INTO public.accounts (id, user_id, name, type, institution, account_number, description, created_at) 
SELECT 
  '550e8400-e29b-41d4-a716-446655440001'::uuid as id,
  (SELECT id FROM public.users LIMIT 1) as user_id,
  'Main Trading Account' as name,
  'Individual' as type,
  'Interactive Brokers' as institution,
  'U1234567' as account_number,
  'Primary trading account' as description,
  NOW() as created_at;

-- Debug: Check if account was inserted
SELECT 'Accounts after insert:' as debug, COUNT(*) as account_count FROM public.accounts;

-- Insert sample tickers
INSERT INTO public.tickers (id, name, icon) VALUES
('550e8400-e29b-41d4-a716-446655440002', 'AAPL', '/icons/aapl.png'),
('550e8400-e29b-41d4-a716-446655440003', 'MSFT', '/icons/msft.png'),
('550e8400-e29b-41d4-a716-446655440004', 'GOOGL', '/icons/googl.png'),
('550e8400-e29b-41d4-a716-446655440005', 'TSLA', '/icons/tsla.png');

-- Insert sample transactions for the current week (August 23-29, 2025)
-- Note: Options contracts represent 100 shares, so qty=1 means 1 contract = 100 shares
-- All transactions use the authenticated user's ID and the sample account ID

-- Initial cash deposit
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, memo)
SELECT '550e8400-e29b-41d4-a716-446655440010'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-23T09:00:00Z', NOW(), NOW(), 'CASH', NULL, NULL, NULL, NULL, 10000, NULL, 0, 'Initial deposit'
;

-- Buy AAPL shares (100 shares at $150)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, memo)
SELECT '550e8400-e29b-41d4-a716-446655440011'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-23T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440002'::uuid, NULL, NULL, 'BUY', 100, 150.00, 1.00, 'Buy AAPL shares'
;

-- Buy MSFT shares (50 shares at $300)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, memo)
SELECT '550e8400-e29b-41d4-a716-446655440012'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-24T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440003'::uuid, NULL, NULL, 'BUY', 50, 300.00, 1.00, 'Buy MSFT shares'
;

-- Sell covered call on AAPL (1 contract = 100 shares, strike $155, premium $2.50)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, memo)
SELECT '550e8400-e29b-41d4-a716-446655440013'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-25T10:00:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440002'::uuid, '2025-09-19', 155.00, 'SELL', 1, 2.50, 0.50, 'Sell covered call on AAPL'
;

-- Sell cash-secured put on TSLA (1 contract = 100 shares, strike $200, premium $5.00)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, memo)
SELECT '550e8400-e29b-41d4-a716-446655440014'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-26T10:00:00Z', NOW(), NOW(), 'PUT', '550e8400-e29b-41d4-a716-446655440005'::uuid, '2025-09-19', 200.00, 'SELL', 1, 5.00, 0.50, 'Sell cash-secured put on TSLA'
;

-- Buy GOOGL shares (25 shares at $180 - realistic price)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, memo)
SELECT '550e8400-e29b-41d4-a716-446655440015'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-27T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440004'::uuid, NULL, NULL, 'BUY', 25, 180.00, 1.00, 'Buy GOOGL shares'
;

-- Sell some AAPL shares (25 shares at $155 - good profit)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, memo)
SELECT '550e8400-e29b-41d4-a716-446655440016'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-28T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440002'::uuid, NULL, NULL, 'SELL', 25, 155.00, 1.00, 'Sell some AAPL shares'
;

-- Buy call option on MSFT (1 contract = 100 shares, strike $320, premium $3.00)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, memo)
SELECT '550e8400-e29b-41d4-a716-446655440017'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-29T10:00:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440003'::uuid, '2025-09-19', 320.00, 'BUY', 1, 3.00, 0.50, 'Buy call option on MSFT'
;

-- Cash withdrawal
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, memo)
SELECT '550e8400-e29b-41d4-a716-446655440018'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-29T15:00:00Z', NOW(), NOW(), 'CASH', NULL, NULL, NULL, NULL, -1000, NULL, 0, 'Cash withdrawal'
;

-- Debug: Check final counts
SELECT 'Final verification:' as debug;
SELECT COUNT(*) as transaction_count FROM public.transactions;
SELECT COUNT(*) as user_count FROM public.users;
SELECT COUNT(*) as account_count FROM public.accounts;
SELECT COUNT(*) as ticker_count FROM public.tickers;

-- Show sample data
SELECT 'Sample transactions:' as debug;
SELECT id, instrument_kind, side, qty, price, memo FROM public.transactions LIMIT 5;