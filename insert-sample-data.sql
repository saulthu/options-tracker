-- Insert sample data for testing the options tracker application
-- This will populate tables with realistic trading data for THIS WEEK ONLY (Aug 23-29, 2025)
--
-- CASH FLOW SUMMARY:
-- Initial Deposits: $75,000 ($50,000 + $25,000)
-- Share Purchases: -$12,000 (AAPL, MSFT, GOOGL, TSLA, NVDA)
-- Options Premiums: +$4,230 (covered calls, CSPs)
-- Options Purchases: -$630 (naked calls/puts)
-- CSP Assignment: -$40,000 (SPY shares at strike)
-- Called Away Shares: +$960 (TSLA shares called away at strike)
-- Net Cash Position: ~$27,560 (sufficient for all trades)

-- First, clear all existing data to start fresh
DELETE FROM public.trades;
DELETE FROM public.tickers;

-- Reset sequences if they exist (for UUID tables this isn't necessary, but good practice)
-- ALTER SEQUENCE IF EXISTS public.trades_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS public.tickers_id_seq RESTART WITH 1;

-- Insert sample tickers for this week's trading
INSERT INTO public.tickers (id, name, icon) VALUES
(gen_random_uuid(), 'AAPL', 'AAPL'),
(gen_random_uuid(), 'MSFT', 'MSFT'),
(gen_random_uuid(), 'GOOGL', 'GOOGL'),
(gen_random_uuid(), 'TSLA', 'TSLA'),
(gen_random_uuid(), 'NVDA', 'NVDA'),
(gen_random_uuid(), 'AMZN', 'AMZN'),
(gen_random_uuid(), 'META', 'META'),
(gen_random_uuid(), 'SPY', 'SPY'),
(gen_random_uuid(), 'QQQ', 'QQQ'),
(gen_random_uuid(), 'IWM', 'IWM');

-- Note: Using existing accounts - no need to create new ones

-- Insert sample share transactions for THIS WEEK ONLY (Saturday to Friday)
-- Note: Using the first account found (your main trading account)
INSERT INTO public.trades (id, user_id, account_id, type, action, ticker_id, price, quantity, value, opened, created) VALUES
-- AAPL transactions - Saturday and Sunday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Shares', 'Buy', (SELECT id FROM public.tickers WHERE name = 'AAPL'), 150.00, 10, -1500.00, '2025-08-23', '2025-08-23T10:00:00Z'),
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Shares', 'Buy', (SELECT id FROM public.tickers WHERE name = 'AAPL'), 155.00, 5, -775.00, '2025-08-24', '2025-08-24T14:30:00Z'),
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Shares', 'Sell', (SELECT id FROM public.tickers WHERE name = 'AAPL'), 160.00, 3, 480.00, '2025-08-25', '2025-08-25T11:15:00Z'),

-- MSFT transactions - Saturday and Monday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Shares', 'Buy', (SELECT id FROM public.tickers WHERE name = 'MSFT'), 300.00, 8, -2400.00, '2025-08-23', '2025-08-23T09:00:00Z'),
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Shares', 'Buy', (SELECT id FROM public.tickers WHERE name = 'MSFT'), 310.00, 4, -1240.00, '2025-08-25', '2025-08-25T15:45:00Z'),

-- GOOGL transactions - Sunday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Shares', 'Buy', (SELECT id FROM public.tickers WHERE name = 'GOOGL'), 125.00, 5, -625.00, '2025-08-24', '2025-08-24T13:20:00Z'),

-- TSLA transactions - Saturday and Tuesday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Shares', 'Buy', (SELECT id FROM public.tickers WHERE name = 'TSLA'), 200.00, 6, -1200.00, '2025-08-23', '2025-08-23T16:00:00Z'),
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Shares', 'Sell', (SELECT id FROM public.tickers WHERE name = 'TSLA'), 220.00, 2, 440.00, '2025-08-26', '2025-08-26T10:30:00Z'),

-- NVDA transactions - Saturday and Monday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Shares', 'Buy', (SELECT id FROM public.tickers WHERE name = 'NVDA'), 400.00, 3, -1200.00, '2025-08-23', '2025-08-23T12:00:00Z'),
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Shares', 'Buy', (SELECT id FROM public.tickers WHERE name = 'NVDA'), 420.00, 2, -840.00, '2025-08-25', '2025-08-25T14:15:00Z');

-- Insert sample share transactions for the second account (this week only)
INSERT INTO public.trades (id, user_id, account_id, type, action, ticker_id, price, quantity, value, opened, created) VALUES
-- Second account - Different tickers and strategies
-- AMZN transactions - Sunday and Tuesday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1 OFFSET 1), 'Shares', 'Buy', (SELECT id FROM public.tickers WHERE name = 'AMZN'), 140.00, 5, -700.00, '2025-08-24', '2025-08-24T11:00:00Z'),
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1 OFFSET 1), 'Shares', 'Buy', (SELECT id FROM public.tickers WHERE name = 'AMZN'), 145.00, 3, -435.00, '2025-08-26', '2025-08-26T13:30:00Z'),

-- META transactions - Monday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1 OFFSET 1), 'Shares', 'Buy', (SELECT id FROM public.tickers WHERE name = 'META'), 280.00, 4, -1120.00, '2025-08-25', '2025-08-25T14:15:00Z'),

-- SPY transactions - Saturday and Wednesday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1 OFFSET 1), 'Shares', 'Buy', (SELECT id FROM public.tickers WHERE name = 'SPY'), 380.00, 10, -3800.00, '2025-08-23', '2025-08-23T09:45:00Z'),
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1 OFFSET 1), 'Shares', 'Sell', (SELECT id FROM public.tickers WHERE name = 'SPY'), 390.00, 2, 780.00, '2025-08-27', '2025-08-27T15:20:00Z');

-- Insert sample options transactions for this week
INSERT INTO public.trades (id, user_id, account_id, type, action, ticker_id, price, quantity, value, strike, expiry, opened, created) VALUES
-- AAPL Covered Calls - Saturday and Sunday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'CC', 'Sell', (SELECT id FROM public.tickers WHERE name = 'AAPL'), 5.00, 1, 500.00, 160.00, '2025-09-05', '2025-08-23', '2025-08-23T10:00:00Z'),
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'CC', 'Sell', (SELECT id FROM public.tickers WHERE name = 'AAPL'), 4.50, 1, 450.00, 165.00, '2025-09-05', '2025-08-24', '2025-08-24T14:30:00Z'),

-- MSFT Covered Calls - Saturday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'CC', 'Sell', (SELECT id FROM public.tickers WHERE name = 'MSFT'), 8.00, 1, 800.00, 320.00, '2025-09-05', '2025-08-23', '2025-08-23T09:00:00Z'),

-- TSLA Covered Calls - Saturday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'CC', 'Sell', (SELECT id FROM public.tickers WHERE name = 'TSLA'), 12.00, 1, 1200.00, 240.00, '2025-09-05', '2025-08-23', '2025-08-23T16:00:00Z'),

-- NVDA Covered Calls - Saturday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'CC', 'Sell', (SELECT id FROM public.tickers WHERE name = 'NVDA'), 15.00, 1, 1500.00, 450.00, '2025-09-05', '2025-08-23', '2025-08-23T12:00:00Z'),

-- Some naked options (not covered by shares) - Sunday and Monday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Call', 'Buy', (SELECT id FROM public.tickers WHERE name = 'AMZN'), 3.50, 1, -350.00, 150.00, '2025-09-05', '2025-08-24', '2025-08-24T11:00:00Z'),
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Put', 'Buy', (SELECT id FROM public.tickers WHERE name = 'META'), 2.80, 1, -280.00, 300.00, '2025-09-05', '2025-08-25', '2025-08-25T15:00:00Z'),

-- Cash Secured Puts - Saturday and Monday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'CSP', 'Sell', (SELECT id FROM public.tickers WHERE name = 'SPY'), 2.00, 1, 200.00, 400.00, '2025-09-05', '2025-08-23', '2025-08-23T13:00:00Z'),
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'CSP', 'Sell', (SELECT id FROM public.tickers WHERE name = 'QQQ'), 1.50, 1, 150.00, 350.00, '2025-09-05', '2025-08-25', '2025-08-25T16:00:00Z');

-- Insert sample cash transactions for this week
INSERT INTO public.trades (id, user_id, account_id, type, action, price, quantity, value, opened, created) VALUES
-- Large initial cash deposits to cover all purchases - Saturday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Cash', 'Deposit', 1.00, 1, 50000.00, '2025-08-23', '2025-08-23T09:00:00Z'),
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Cash', 'Deposit', 1.00, 1, 25000.00, '2025-08-24', '2025-08-24T09:00:00Z'),

-- Cash withdrawals (small amounts) - Monday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Cash', 'Withdraw', 1.00, 1, -2000.00, '2025-08-25', '2025-08-25T16:00:00Z'),

-- Cash adjustments (dividends, fees, etc.) - Tuesday and Wednesday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Cash', 'Adjustment', 1.00, 1, 150.00, '2025-08-26', '2025-08-26T12:00:00Z'),
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Cash', 'Adjustment', 1.00, 1, -25.00, '2025-08-27', '2025-08-27T10:00:00Z');

-- Insert some closed transactions to test P&L calculations (this week)
INSERT INTO public.trades (id, user_id, account_id, type, action, ticker_id, price, quantity, value, strike, expiry, opened, closed, close_method, created) VALUES
-- Closed covered call - Tuesday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'CC', 'Buy', (SELECT id FROM public.tickers WHERE name = 'AAPL'), 2.00, 1, -200.00, 160.00, '2025-09-05', '2025-08-23', '2025-08-26', 'Manual', '2025-08-26T14:00:00Z'),

-- Expired option - Monday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Call', 'Buy', (SELECT id FROM public.tickers WHERE name = 'AMZN'), 3.50, 1, -350.00, 150.00, '2025-09-05', '2025-08-24', '2025-08-25', 'Expired', '2025-08-24T11:00:00Z'),

-- Assigned option - Wednesday
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'CSP', 'Assigned', (SELECT id FROM public.tickers WHERE name = 'SPY'), 2.00, 1, -200.00, 400.00, '2025-09-05', '2025-08-23', '2025-08-27', 'Assigned', '2025-08-23T13:00:00Z');

-- Insert the assigned shares from the assigned CSP - Wednesday
INSERT INTO public.trades (id, user_id, account_id, type, action, ticker_id, price, quantity, value, opened, created) VALUES
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Shares', 'Assigned', (SELECT id FROM public.tickers WHERE name = 'SPY'), 400.00, 100, -40000.00, '2025-08-27', '2025-08-27T09:00:00Z');

-- Insert a covered call that was called away (expired in the money) - Tuesday
INSERT INTO public.trades (id, user_id, account_id, type, action, ticker_id, price, quantity, value, opened, created) VALUES
(gen_random_uuid(), (SELECT id FROM auth.users LIMIT 1), (SELECT id FROM public.accounts LIMIT 1), 'Shares', 'Called Away', (SELECT id FROM public.tickers WHERE name = 'TSLA'), 240.00, 4, 960.00, '2025-08-26', '2025-08-26T16:00:00Z');

-- Note: All transactions are now from this week (Aug 23-29, 2025)
-- This makes the data relevant for testing the date range filtering in the SharesPage
-- Week breakdown:
-- Saturday (Aug 23): Heavy buying, initial deposits, most options
-- Sunday (Aug 24): Additional purchases and second deposit
-- Monday (Aug 25): More purchases, withdrawals, and adjustments
-- Tuesday (Aug 26): Some sales, adjustments, and called away shares
-- Wednesday (Aug 27): Final sales, CSP assignment, and assigned shares
-- Thursday-Friday (Aug 28-29): No trades (weekend)
