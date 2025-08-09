-- Fix the security issue with search_path
CREATE OR REPLACE FUNCTION public.get_avatar_url(user_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT avatar_url FROM public.profiles WHERE id = user_id;
$$;