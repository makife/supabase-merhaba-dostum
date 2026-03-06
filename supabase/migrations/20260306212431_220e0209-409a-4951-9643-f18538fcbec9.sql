-- Eski vault-based cron job'ı sil ve düzgün çalışan bir tane oluştur
SELECT cron.unschedule('award-challenge-prizes-daily');

SELECT cron.schedule(
  'award-challenge-prizes-daily',
  '5 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nnlvtqmuwmrqfinsgvwc.supabase.co/functions/v1/award-challenge-prizes',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);