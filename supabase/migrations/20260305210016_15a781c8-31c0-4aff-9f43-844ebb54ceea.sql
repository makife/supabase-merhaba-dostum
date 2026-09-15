-- Günlük challenge birincilerine çark hakkı veren cron job
-- Her gün Türkiye saatiyle 00:05'te çalışır (UTC 21:05)
SELECT cron.schedule(
  'award-challenge-prizes-daily',
  '5 21 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/award-challenge-prizes',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
