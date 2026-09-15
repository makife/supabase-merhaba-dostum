-- Mevcut kullanıcıların premium paketlerini kaldır
UPDATE profiles 
SET premium_until = NULL 
WHERE premium_until IS NOT NULL AND premium_until > NOW();