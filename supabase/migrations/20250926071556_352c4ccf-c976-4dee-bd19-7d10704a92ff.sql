-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job to reset daily stats every day at midnight UTC
SELECT cron.schedule(
  'reset-daily-stats',
  '0 0 * * *', -- Run at 00:00 UTC every day
  $$
  select
    net.http_post(
        url:='https://nnlvtqmuwmrqfinsgvwc.supabase.co/functions/v1/reset-daily-stats',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE"}'::jsonb,
        body:='{"timestamp": "' || extract(epoch from now()) || '"}'::jsonb
    ) as request_id;
  $$
);