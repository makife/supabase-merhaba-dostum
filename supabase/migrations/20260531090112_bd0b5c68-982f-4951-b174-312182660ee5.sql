CREATE OR REPLACE FUNCTION public.cleanup_expired_tournaments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Süresi dolan bekleyen turnuvaları aktif listeden hemen çıkar.
  UPDATE public.tournaments
  SET status = 'cancelled',
      finished_at = COALESCE(finished_at, now())
  WHERE status = 'waiting'
    AND expires_at IS NOT NULL
    AND expires_at <= now();

  -- Eski iptal/tamamlanmış kayıtları temizle.
  DELETE FROM public.tournaments
  WHERE status IN ('completed', 'cancelled')
    AND created_at < now() - interval '48 hours';
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_tournaments() TO anon, authenticated, service_role;