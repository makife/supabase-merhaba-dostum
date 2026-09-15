-- Fix duplicate rewards from multiple triggers
UPDATE user_inventory SET quantity = 2, updated_at = now() WHERE user_id = '55a8ad0a-a397-44b8-b9c4-50f7a3a72a91' AND item_type = 'fisilida';

-- Fix makif: was ink_count 489577 + 3*4=12 extra, game_credits was 5+3*4=12 extra, bonus_spins was 0+1*4=4 extra
UPDATE profiles SET ink_count = 489580, game_credits = 8, bonus_spins = 1 WHERE id = 'd8db37ac-f594-45a5-b499-5028322f9bf3';

-- Fix tosbiko: bonus_spins was 0+1*4=4, should be 1
UPDATE profiles SET bonus_spins = 1 WHERE id = '7fe7b3a0-eea7-4379-8011-ae7409008664';

-- Fix ramazanhaberr: check and fix bonus_spins
UPDATE profiles SET bonus_spins = GREATEST(bonus_spins - 3, 0) WHERE id = '60b69777-7630-49ab-850f-cceedb9462b3';

-- Remove duplicate notifications
DELETE FROM notifications WHERE type = 'challenge_prize' AND created_at < '2026-03-08T21:05:40Z';