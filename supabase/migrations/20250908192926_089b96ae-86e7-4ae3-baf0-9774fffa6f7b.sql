-- System settings table for global operations
CREATE TABLE public.system_settings (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view and modify system settings
CREATE POLICY "Only admins can manage system settings" 
ON public.system_settings 
FOR ALL
USING (auth.jwt() ->> 'role' = 'admin' OR auth.uid() IS NULL);

-- Insert initial setting for localStorage clear
INSERT INTO public.system_settings (key, value, description) 
VALUES ('clear_local_storage', 'false', 'When set to true, forces all users to clear their localStorage');

-- Function to trigger localStorage clear for all users
CREATE OR REPLACE FUNCTION public.trigger_global_storage_clear()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.system_settings 
  SET value = 'true', updated_at = NOW() 
  WHERE key = 'clear_local_storage';
END;
$$;