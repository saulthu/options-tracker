-- Sample data for the updated schema with User, Account, Ticker, and Transaction tables
-- Run this in your Supabase SQL Editor after running clean-database-schema.sql

-- First, clear any existing data
DELETE FROM public.transactions;
DELETE FROM public.accounts;
DELETE FROM public.tickers;
DELETE FROM public.users;

-- Insert sample user
INSERT INTO public.users (id, email, name, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'john@example.com', 'John Doe', NOW(), NOW());

-- Insert sample account
INSERT INTO public.accounts (id, user_id, name, type, institution, account_number, description, created_at) VALUES
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Main Trading Account', 'Individual', 'Interactive Brokers', 'U1234567', 'Primary trading account', NOW());

-- Insert sample tickers
INSERT INTO public.tickers (id, name, icon) VALUES
('550e8400-e29b-41d4-a716-446655440002', 'AAPL', '/icons/aapl.png'),
('550e8400-e29b-41d4-a716-446655440003', 'MSFT', '/icons/msft.png'),
('550e8400-e29b-41d4-a716-446655440004', 'GOOGL', '/icons/googl.png'),
('550e8400-e29b-41d4-a716-446655440005', 'TSLA', '/icons/tsla.png');

-- Insert sample transactions for the current week (August 23-29, 2025)
INSERT INTO public.transactions (id, user_id, account_id, timestamp, created_at, updated_at, instrument_kind, ticker_id, expiry, strike, side, qty, price, fees, memo) VALUES

-- Initial cash deposit
('550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', '2025-08-23T09:00:00Z', NOW(), NOW(), 'CASH', NULL, NULL, NULL, NULL, 10000, NULL, 0, 'Initial deposit'),

-- Buy AAPL shares
('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', '2025-08-23T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440002', NULL, NULL, 'BUY', 100, 150.00, 1.00, 'Buy AAPL shares'),

-- Buy MSFT shares
('550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', '2025-08-24T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440003', NULL, NULL, 'BUY', 50, 300.00, 1.00, 'Buy MSFT shares'),

-- Sell covered call on AAPL
('550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', '2025-08-25T10:00:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440002', '2025-09-19', 155.00, 'SELL', 1, 2.50, 0.50, 'Sell covered call on AAPL'),

-- Sell cash-secured put on TSLA
('550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', '2025-08-26T10:00:00Z', NOW(), NOW(), 'PUT', '550e8400-e29b-41d4-a716-446655440005', '2025-09-19', 200.00, 'SELL', 1, 5.00, 0.50, 'Sell cash-secured put on TSLA'),

-- Buy GOOGL shares
('550e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', '2025-08-27T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440004', NULL, NULL, 'BUY', 25, 120.00, 1.00, 'Buy GOOGL shares'),

-- Sell some AAPL shares
('550e8400-e29b-41d4-a716-446655440016', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', '2025-08-28T10:00:00Z', NOW(), NOW(), 'SHARES', '550e8400-e29b-41d4-a716-446655440002', NULL, NULL, 'SELL', 25, 155.00, 1.00, 'Sell some AAPL shares'),

-- Buy call option on MSFT
('550e8400-e29b-41d4-a716-446655440017', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', '2025-08-29T10:00:00Z', NOW(), NOW(), 'CALL', '550e8400-e29b-41d4-a716-446655440003', '2025-09-19', 320.00, 'BUY', 1, 3.00, 0.50, 'Buy call option on MSFT'),

-- Cash withdrawal
('550e8400-e29b-41d4-a716-446655440018', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', '2025-08-29T15:00:00Z', NOW(), NOW(), 'CASH', NULL, NULL, NULL, NULL, -1000, NULL, 0, 'Cash withdrawal');

-- Verify the data
SELECT 'Sample data inserted successfully!' as status;
SELECT COUNT(*) as transaction_count FROM public.transactions;
SELECT COUNT(*) as user_count FROM public.users;
SELECT COUNT(*) as account_count FROM public.accounts;
SELECT COUNT(*) as ticker_count FROM public.tickers;