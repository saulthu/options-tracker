-- Test Database Setup
-- Run this in Supabase SQL Editor to test if the database is properly configured

-- 1. Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'transactions');

-- 2. Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'transactions');

-- 3. Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'transactions');

-- 4. Test user creation (this should work if RLS is set up correctly)
-- Note: This will only work if you're authenticated
INSERT INTO public.users (id, email, name) 
VALUES (auth.uid(), 'test@example.com', 'Test User')
ON CONFLICT (id) DO NOTHING;

-- 5. Test transaction creation (this will only work if user exists)
-- Note: This will only work if you're authenticated and user exists
INSERT INTO public.transactions (user_id, account_id, timestamp, instrument_kind, qty, memo)
VALUES (auth.uid(), auth.uid(), NOW(), 'CASH', 1000.00, 'Test transaction')
ON CONFLICT DO NOTHING;

-- 6. Check if data was inserted
SELECT COUNT(*) as user_count FROM public.users;
SELECT COUNT(*) as transaction_count FROM public.transactions;
