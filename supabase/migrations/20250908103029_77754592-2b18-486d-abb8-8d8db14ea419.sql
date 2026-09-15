-- Add wheel_spins table for daily wheel functionality
CREATE TABLE public.wheel_spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  reward_type TEXT NOT NULL,
  reward_value INTEGER NOT NULL DEFAULT 0,
  reward_item TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.wheel_spins ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own wheel spins" ON public.wheel_spins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wheel spins" ON public.wheel_spins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add joker inventory columns to user_inventory if they don't exist
-- We'll track jokers in user_inventory table using item_type