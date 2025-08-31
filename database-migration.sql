-- Safe migration script to add trading accounts support
-- This script can be run multiple times safely

-- Check if trading_accounts table exists, if not create it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'trading_accounts') THEN
        -- Create trading accounts table
                 CREATE TABLE public.trading_accounts (
             id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
             user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
             name TEXT NOT NULL,
             type TEXT CHECK (type IN ('Personal', 'IRA', '401k', 'Roth IRA', 'Traditional IRA', 'Corporate', 'SMSF', 'Other')) NOT NULL,
             institution TEXT,
             account_number TEXT,
             is_active BOOLEAN DEFAULT true,
             created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
             updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
         );
        
        RAISE NOTICE 'Created trading_accounts table';
    ELSE
        RAISE NOTICE 'trading_accounts table already exists';
    END IF;
END $$;

-- Check if trading_account_id column exists in positions table, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'positions' AND column_name = 'trading_account_id') THEN
        -- Add trading_account_id column to positions table
        ALTER TABLE public.positions ADD COLUMN trading_account_id UUID;
        
        RAISE NOTICE 'Added trading_account_id column to positions table';
    ELSE
        RAISE NOTICE 'trading_account_id column already exists in positions table';
    END IF;
END $$;

-- Create default trading accounts for existing users if they don't have any
INSERT INTO public.trading_accounts (user_id, name, type, institution)
SELECT DISTINCT u.id, 'Main Account', 'Personal', 'Default'
FROM public.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.trading_accounts ta WHERE ta.user_id = u.id
);

-- Update existing positions to link to default trading accounts
UPDATE public.positions 
SET trading_account_id = (
    SELECT ta.id 
    FROM public.trading_accounts ta 
    WHERE ta.user_id = public.positions.user_id 
    LIMIT 1
)
WHERE trading_account_id IS NULL;

-- Make trading_account_id NOT NULL after populating it
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'positions' AND column_name = 'trading_account_id' AND is_nullable = 'YES') THEN
        ALTER TABLE public.positions ALTER COLUMN trading_account_id SET NOT NULL;
        RAISE NOTICE 'Made trading_account_id NOT NULL';
    END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'positions_trading_account_id_fkey'
    ) THEN
        ALTER TABLE public.positions 
        ADD CONSTRAINT positions_trading_account_id_fkey 
        FOREIGN KEY (trading_account_id) REFERENCES public.trading_accounts(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint';
    END IF;
END $$;

-- Create indexes if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_trading_accounts_user_id') THEN
        CREATE INDEX idx_trading_accounts_user_id ON public.trading_accounts(user_id);
        RAISE NOTICE 'Created index idx_trading_accounts_user_id';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_trading_accounts_type') THEN
        CREATE INDEX idx_trading_accounts_type ON public.trading_accounts(type);
        RAISE NOTICE 'Created index idx_trading_accounts_type';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_positions_trading_account_id') THEN
        CREATE INDEX idx_positions_trading_account_id ON public.positions(trading_account_id);
        RAISE NOTICE 'Created index idx_positions_trading_account_id';
    END IF;
END $$;

-- Enable RLS on trading_accounts if not already enabled
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'trading_accounts' AND rowsecurity = true) THEN
        ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Enabled RLS on trading_accounts table';
    END IF;
END $$;

-- Create RLS policies for trading accounts if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trading_accounts' AND policyname = 'Users can view own trading accounts') THEN
        CREATE POLICY "Users can view own trading accounts" ON public.trading_accounts
            FOR SELECT USING (auth.uid() = user_id);
        RAISE NOTICE 'Created policy: Users can view own trading accounts';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trading_accounts' AND policyname = 'Users can insert own trading accounts') THEN
        CREATE POLICY "Users can insert own trading accounts" ON public.trading_accounts
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        RAISE NOTICE 'Created policy: Users can insert own trading accounts';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trading_accounts' AND policyname = 'Users can update own trading accounts') THEN
        CREATE POLICY "Users can update own trading accounts" ON public.trading_accounts
            FOR UPDATE USING (auth.uid() = user_id);
        RAISE NOTICE 'Created policy: Users can update own trading accounts';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trading_accounts' AND policyname = 'Users can delete own trading accounts') THEN
        CREATE POLICY "Users can delete own trading accounts" ON public.trading_accounts
            FOR DELETE USING (auth.uid() = user_id);
        RAISE NOTICE 'Created policy: Users can delete own trading accounts';
    END IF;
END $$;

-- Create or update the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Insert user profile
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email)
    RETURNING id INTO new_user_id;
    
    -- Create default trading account
    INSERT INTO public.trading_accounts (user_id, name, type, institution)
    VALUES (new_user_id, 'Main Account', 'Personal', 'Default');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updated_at on trading_accounts if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_trading_accounts_updated_at') THEN
        CREATE TRIGGER update_trading_accounts_updated_at
            BEFORE UPDATE ON public.trading_accounts
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
        RAISE NOTICE 'Created trigger update_trading_accounts_updated_at';
    END IF;
END $$;

-- Success message
SELECT 'Migration completed successfully!' as status;
