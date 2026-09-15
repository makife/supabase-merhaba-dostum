-- Schedule premium daily reminder job (runs at 06:00 UTC = 09:00 Turkey time)
SELECT cron.schedule(
  'send-premium-daily-reminder',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nnlvtqmuwmrqfinsgvwc.supabase.co/functions/v1/send-premium-daily-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
