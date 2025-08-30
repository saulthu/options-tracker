-- Create users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create positions table
CREATE TABLE public.positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  type TEXT CHECK (type IN ('Call', 'Put')) NOT NULL,
  strike DECIMAL(10,2) NOT NULL,
  expiration DATE NOT NULL,
  quantity INTEGER NOT NULL,
  entry_price DECIMAL(10,4) NOT NULL,
  current_price DECIMAL(10,4) NOT NULL,
  pnl DECIMAL(10,2) NOT NULL,
  status TEXT CHECK (status IN ('Open', 'Closed', 'Assigned')) DEFAULT 'Open',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create PnL history table
CREATE TABLE public.pnl_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  total_pnl DECIMAL(10,2) NOT NULL,
  open_positions INTEGER NOT NULL,
  portfolio_value DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create indexes for better performance
CREATE INDEX idx_positions_user_id ON public.positions(user_id);
CREATE INDEX idx_positions_symbol ON public.positions(symbol);
CREATE INDEX idx_positions_status ON public.positions(status);
CREATE INDEX idx_pnl_history_user_id ON public.pnl_history(user_id);
CREATE INDEX idx_pnl_history_date ON public.pnl_history(date);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pnl_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Positions policies
CREATE POLICY "Users can view own positions" ON public.positions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own positions" ON public.positions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own positions" ON public.positions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own positions" ON public.positions
  FOR DELETE USING (auth.uid() = user_id);

-- PnL history policies
CREATE POLICY "Users can view own PnL history" ON public.pnl_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own PnL history" ON public.pnl_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own PnL history" ON public.pnl_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own PnL history" ON public.pnl_history
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call the function
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_positions_updated_at
  BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
