
-- Mevcut çift zamanlı cron job'u kaldır ve sadece 17:00 UTC (20:00 Türkiye) olarak yeniden oluştur
SELECT cron.unschedule('wheel-reminder-morning-evening');

SELECT cron.schedule(
  'wheel-reminder-evening',
  '0 17 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nnlvtqmuwmrqfinsgvwc.supabase.co/functions/v1/send-scheduled-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE"}'::jsonb
  );
  $$
);
