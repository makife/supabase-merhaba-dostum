-- Clear any APNs tokens (64-char hex) that were saved by older code
UPDATE public.profiles
SET push_token = NULL
WHERE push_token ~ '^[A-F0-9]{64}$';
