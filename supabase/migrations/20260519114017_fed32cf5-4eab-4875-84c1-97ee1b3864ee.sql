ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS premium_type text;

UPDATE public.profiles p
SET premium_type = sub.item_id
FROM (
  SELECT up.user_id, up.item_id
  FROM public.user_purchases up
  WHERE up.item_type = 'subscription'
    AND up.item_id IN ('premium_monthly', 'premium_yearly')
    AND up.id = (
      SELECT up2.id FROM public.user_purchases up2
      WHERE up2.user_id = up.user_id
        AND up2.item_type = 'subscription'
        AND up2.item_id IN ('premium_monthly', 'premium_yearly')
      ORDER BY up2.purchased_at DESC NULLS LAST
      LIMIT 1
    )
) sub
WHERE p.id = sub.user_id
  AND p.premium_until IS NOT NULL
  AND p.premium_until > now()
  AND p.premium_type IS NULL;

UPDATE public.profiles
SET premium_type = CASE
  WHEN (premium_until - now()) > INTERVAL '60 days' THEN 'premium_yearly'
  ELSE 'premium_monthly'
END
WHERE premium_until IS NOT NULL
  AND premium_until > now()
  AND premium_type IS NULL;