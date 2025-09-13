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

-- Insert sample accounts (using the user ID we just created)
INSERT INTO public.accounts (id, user_id, name, type, institution, account_number, description, created_at) 
SELECT 
  '550e8400-e29b-41d4-a716-446655440001'::uuid as id,
  (SELECT id FROM public.users LIMIT 1) as user_id,
  'Main Trading Account' as name,
  'Individual' as type,
  'Interactive Brokers' as institution,
  'U1234567' as account_number,
  'Primary trading account' as description,
  NOW() as created_at
UNION ALL
SELECT 
  '550e8400-e29b-41d4-a716-446655440020'::uuid as id,
  (SELECT id FROM public.users LIMIT 1) as user_id,
  'Options Strategy Account' as name,
  'Individual' as type,
  'TD Ameritrade' as institution,
  'TDA7890123' as account_number,
  'Dedicated options trading account' as description,
  NOW() as created_at;

-- Debug: Check if account was inserted
SELECT 'Accounts after insert:' as debug, COUNT(*) as account_count FROM public.accounts;

-- Insert sample tickers
INSERT INTO public.tickers (id, user_id, name, icon) VALUES
('550e8400-e29b-41d4-a716-446655440002', (SELECT id FROM public.users LIMIT 1), 'AAPL', '/icons/aapl.png'),
('550e8400-e29b-41d4-a716-446655440003', (SELECT id FROM public.users LIMIT 1), 'MSFT', '/icons/msft.png'),
('550e8400-e29b-41d4-a716-446655440004', (SELECT id FROM public.users LIMIT 1), 'GOOGL', '/icons/googl.png'),
('550e8400-e29b-41d4-a716-446655440005', (SELECT id FROM public.users LIMIT 1), 'TSLA', '/icons/tsla.png'),
('550e8400-e29b-41d4-a716-446655440006', (SELECT id FROM public.users LIMIT 1), 'NVDA', '/icons/nvda.png'),
('550e8400-e29b-41d4-a716-446655440007', (SELECT id FROM public.users LIMIT 1), 'SPY', '/icons/spy.png'),
('550e8400-e29b-41d4-a716-446655440008', (SELECT id FROM public.users LIMIT 1), 'QQQ', '/icons/qqq.png'),
('550e8400-e29b-41d4-a716-446655440009', (SELECT id FROM public.users LIMIT 1), 'AMD', '/icons/amd.png');

-- Insert sample transactions for the current week (August 23-29, 2025)
-- Note: Options contracts represent 100 shares, so qty=1 means 1 contract = 100 shares
-- All transactions use the authenticated user's ID and the sample account ID

-- Initial cash deposit (USD)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440010'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-23T09:00:00Z', NOW(), NOW(), 'CASH', NULL, NULL, NULL, NULL, 10000, NULL, 0, 'USD', 'Initial USD deposit'
;

-- Buy AAPL shares (100 shares at $150)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440011'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-23T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440002'::uuid, NULL, NULL, 'BUY', 100, 150.00, 1.00, 'USD', 'Buy AAPL shares'
;

-- Buy MSFT shares (50 shares at $300)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440012'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-24T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440003'::uuid, NULL, NULL, 'BUY', 50, 300.00, 1.00, 'USD', 'Buy MSFT shares'
;

-- Sell covered call on AAPL (1 contract = 100 shares, strike $155, premium $2.50)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440013'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-25T10:00:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440002'::uuid, '2025-09-19', 155.00, 'SELL', 1, 2.50, 0.50, 'USD', 'Sell covered call on AAPL'
;

-- Sell cash-secured put on TSLA (1 contract = 100 shares, strike $200, premium $5.00)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440014'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-26T10:00:00Z', NOW(), NOW(), 'PUT', '550e8400-e29b-41d4-a716-446655440005'::uuid, '2025-09-19', 200.00, 'SELL', 1, 5.00, 0.50, 'USD', 'Sell cash-secured put on TSLA'
;

-- Buy GOOGL shares (25 shares at $180 - realistic price)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440015'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-27T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440004'::uuid, NULL, NULL, 'BUY', 25, 180.00, 1.00, 'USD', 'Buy GOOGL shares'
;

-- Sell some AAPL shares (25 shares at $155 - good profit)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440016'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-28T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440002'::uuid, NULL, NULL, 'SELL', 25, 155.00, 1.00, 'USD', 'Sell some AAPL shares'
;

-- Buy call option on MSFT (1 contract = 100 shares, strike $320, premium $3.00)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440017'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-29T10:00:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440003'::uuid, '2025-09-19', 320.00, 'BUY', 1, 3.00, 0.50, 'USD', 'Buy call option on MSFT'
;

-- Cash withdrawal
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440018'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-08-29T15:00:00Z', NOW(), NOW(), 'CASH', NULL, NULL, NULL, NULL, -1000, NULL, 0, 'USD', 'Cash withdrawal'
;

-- ===== SECOND ACCOUNT TRANSACTIONS (Options Strategy Account) =====
-- These transactions are for the second account and span different time periods

-- Initial cash deposit for options account
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440030'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-08-20T09:00:00Z', NOW(), NOW(), 'CASH', NULL, NULL, NULL, NULL, 25000, NULL, 0, 'USD', 'Initial deposit for options account'
;

-- Buy NVDA shares (50 shares at $120)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440031'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-08-20T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440006'::uuid, NULL, NULL, 'BUY', 50, 120.00, 1.00, 'USD', 'Buy NVDA shares'
;

-- Sell covered call on NVDA (1 contract, strike $130, premium $3.00)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440032'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-08-21T10:00:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440006'::uuid, '2025-09-19', 130.00, 'SELL', 1, 3.00, 0.50, 'Sell covered call on NVDA'
;

-- Buy AMD shares (100 shares at $95)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440033'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-08-22T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440009'::uuid, NULL, NULL, 'BUY', 100, 95.00, 1.00, 'Buy AMD shares'
;

-- Sell cash-secured put on SPY (2 contracts, strike $500, premium $2.50 each)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440034'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-08-23T10:00:00Z', NOW(), NOW(), 'PUT', '550e8400-e29b-41d4-a716-446655440007'::uuid, '2025-09-19', 500.00, 'SELL', 2, 2.50, 1.00, 'Sell cash-secured puts on SPY'
;

-- Buy QQQ shares (30 shares at $380)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440035'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-08-24T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440008'::uuid, NULL, NULL, 'BUY', 30, 380.00, 1.00, 'Buy QQQ shares'
;

-- Sell covered call on QQQ (1 contract, strike $390, premium $4.00)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440036'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-08-25T10:00:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440008'::uuid, '2025-09-19', 390.00, 'SELL', 1, 4.00, 0.50, 'Sell covered call on QQQ'
;

-- Buy call spread on AMD (buy $100 call, sell $105 call)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440037'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-08-26T10:00:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440009'::uuid, '2025-09-19', 100.00, 'BUY', 1, 2.50, 0.50, 'Buy AMD $100 call'
;

INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440038'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-08-26T10:01:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440009'::uuid, '2025-09-19', 105.00, 'SELL', 1, 1.00, 0.50, 'Sell AMD $105 call (spread)'
;

-- Sell some AMD shares (25 shares at $98 - small profit)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440039'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-08-27T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440009'::uuid, NULL, NULL, 'SELL', 25, 98.00, 1.00, 'Sell some AMD shares'
;

-- Cash withdrawal from options account
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440040'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-08-28T15:00:00Z', NOW(), NOW(), 'CASH', NULL, NULL, NULL, NULL, -2000, NULL, 0, 'Cash withdrawal from options account'
;

-- ===== WEEK 2 TRANSACTIONS (September 2-8, 2025) =====
-- Testing exercised options, closed positions, and new strategies

-- MAIN ACCOUNT - Week 2
-- AAPL covered call gets exercised (shares called away at $155)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440050'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-09-02T09:30:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440002'::uuid, NULL, NULL, 'SELL', 100, 155.00, 1.00, 'AAPL shares called away at $155'
;

-- Buy back the MSFT call option (close the position)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440051'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-09-02T10:00:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440003'::uuid, '2025-09-19', 320.00, 'BUY', 1, 0.50, 0.50, 'Buy back MSFT call (close position)'
;

-- TSLA put gets assigned (buy 100 shares at $200)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440052'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-09-03T09:30:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440005'::uuid, NULL, NULL, 'BUY', 100, 200.00, 1.00, 'TSLA shares assigned at $200'
;

-- Buy more AAPL shares (replacement after call away)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440053'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-09-03T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440002'::uuid, NULL, NULL, 'BUY', 75, 152.00, 1.00, 'Buy AAPL shares after call away'
;

-- Sell naked call on TSLA (no underlying shares)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440054'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-09-04T10:00:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440005'::uuid, '2025-09-26', 210.00, 'SELL', 1, 4.00, 0.50, 'Sell naked call on TSLA'
;

-- Buy naked put on GOOGL
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440055'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-09-05T10:00:00Z', NOW(), NOW(), 'PUT', '550e8400-e29b-41d4-a716-446655440004'::uuid, '2025-09-26', 170.00, 'BUY', 2, 3.50, 1.00, 'Buy naked puts on GOOGL'
;

-- Sell some MSFT shares (partial position)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440056'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-09-06T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440003'::uuid, NULL, NULL, 'SELL', 25, 305.00, 1.00, 'Sell some MSFT shares'
;

-- OPTIONS ACCOUNT - Week 2
-- NVDA covered call gets exercised (shares called away at $130)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440060'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-09-02T09:30:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440006'::uuid, NULL, NULL, 'SELL', 50, 130.00, 1.00, 'NVDA shares called away at $130'
;

-- SPY puts get assigned (buy 200 shares at $500)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440061'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-09-03T09:30:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440007'::uuid, NULL, NULL, 'BUY', 200, 500.00, 2.00, 'SPY shares assigned at $500'
;

-- Close AMD call spread (sell $100 call, buy back $105 call)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440062'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-09-04T10:00:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440009'::uuid, '2025-09-19', 100.00, 'SELL', 1, 4.50, 0.50, 'Sell AMD $100 call (close spread)'
;

INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440063'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-09-04T10:01:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440009'::uuid, '2025-09-19', 105.00, 'BUY', 1, 0.25, 0.50, 'Buy back AMD $105 call (close spread)'
;

-- QQQ covered call gets exercised (shares called away at $390)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440064'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-09-05T09:30:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440008'::uuid, NULL, NULL, 'SELL', 30, 390.00, 1.00, 'QQQ shares called away at $390'
;

-- Buy more NVDA shares (replacement after call away)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440065'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-09-05T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440006'::uuid, NULL, NULL, 'BUY', 60, 125.00, 1.00, 'Buy NVDA shares after call away'
;

-- Sell naked put on AMD
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440066'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-09-06T10:00:00Z', NOW(), NOW(), 'PUT', '550e8400-e29b-41d4-a716-446655440009'::uuid, '2025-09-26', 90.00, 'SELL', 2, 2.00, 1.00, 'Sell naked puts on AMD'
;

-- ===== WEEK 3 TRANSACTIONS (September 9-15, 2025) =====
-- Testing more complex strategies and position management

-- MAIN ACCOUNT - Week 3
-- TSLA naked call gets exercised (sell 100 shares at $210)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440070'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-09-09T09:30:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440005'::uuid, NULL, NULL, 'SELL', 100, 210.00, 1.00, 'TSLA shares sold short at $210 (naked call)'
;

-- Buy back the short TSLA shares (cover the short)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440071'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-09-09T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440005'::uuid, NULL, NULL, 'BUY', 100, 208.00, 1.00, 'Cover TSLA short position'
;

-- GOOGL puts expire worthless (keep premium)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440072'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-09-10T16:00:00Z', NOW(), NOW(), 'PUT', '550e8400-e29b-41d4-a716-446655440004'::uuid, '2025-09-26', 170.00, 'SELL', 2, 0.00, 0.00, 'GOOGL puts expire worthless'
;

-- Buy iron condor on MSFT (complex multi-leg strategy)
-- Sell $300 put
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440073'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-09-11T10:00:00Z', NOW(), NOW(), 'PUT', '550e8400-e29b-41d4-a716-446655440003'::uuid, '2025-10-17', 300.00, 'SELL', 1, 2.00, 0.50, 'Sell MSFT $300 put (iron condor)'
;

-- Buy $295 put
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440074'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-09-11T10:01:00Z', NOW(), NOW(), 'PUT', '550e8400-e29b-41d4-a716-446655440003'::uuid, '2025-10-17', 295.00, 'BUY', 1, 1.00, 0.50, 'Buy MSFT $295 put (iron condor)'
;

-- Sell $320 call
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440075'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-09-11T10:02:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440003'::uuid, '2025-10-17', 320.00, 'SELL', 1, 1.50, 0.50, 'Sell MSFT $320 call (iron condor)'
;

-- Buy $325 call
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440076'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-09-11T10:03:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440003'::uuid, '2025-10-17', 325.00, 'BUY', 1, 0.50, 0.50, 'Buy MSFT $325 call (iron condor)'
;

-- OPTIONS ACCOUNT - Week 3
-- AMD naked puts get assigned (buy 200 shares at $90)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440080'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-09-09T09:30:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440009'::uuid, NULL, NULL, 'BUY', 200, 90.00, 2.00, 'AMD shares assigned at $90'
;

-- Sell some SPY shares (partial position)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440081'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-09-10T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440007'::uuid, NULL, NULL, 'SELL', 100, 505.00, 1.00, 'Sell some SPY shares'
;

-- Buy calendar spread on NVDA (sell near-term, buy longer-term)
-- Sell $130 call (near-term)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440082'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-09-11T10:00:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440006'::uuid, '2025-10-03', 130.00, 'SELL', 1, 3.00, 0.50, 'Sell NVDA $130 call (calendar)'
;

-- Buy $130 call (longer-term)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440083'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-09-11T10:01:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440006'::uuid, '2025-10-17', 130.00, 'BUY', 1, 4.50, 0.50, 'Buy NVDA $130 call (calendar)'
;

-- Buy butterfly spread on QQQ
-- Sell 2x $390 calls
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440084'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-09-12T10:00:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440008'::uuid, '2025-10-17', 390.00, 'SELL', 2, 2.00, 1.00, 'Sell QQQ $390 calls (butterfly)'
;

-- Buy $385 call
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440085'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-09-12T10:01:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440008'::uuid, '2025-10-17', 385.00, 'BUY', 1, 3.50, 0.50, 'Buy QQQ $385 call (butterfly)'
;

-- Buy $395 call
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440086'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-09-12T10:02:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440008'::uuid, '2025-10-17', 395.00, 'BUY', 1, 1.00, 0.50, 'Buy QQQ $395 call (butterfly)'
;

-- Cash deposit to both accounts
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440090'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440001'::uuid, '2025-09-13T09:00:00Z', NOW(), NOW(), 'CASH', NULL, NULL, NULL, NULL, 5000, NULL, 0, 'Additional deposit to main account'
;

INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, currency, memo)
SELECT '550e8400-e29b-41d4-a716-446655440091'::uuid, (SELECT id FROM public.users LIMIT 1), '550e8400-e29b-41d4-a716-446655440020'::uuid, '2025-09-13T09:00:00Z', NOW(), NOW(), 'CASH', NULL, NULL, NULL, NULL, 10000, NULL, 0, 'Additional deposit to options account'
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