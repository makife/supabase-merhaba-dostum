-- Fix extra awards from testing (2 extra triggers)
UPDATE user_inventory SET quantity = quantity - 6 WHERE user_id = 'd8db37ac-f594-45a5-b499-5028322f9bf3' AND item_type = 'joker_degistir';
UPDATE user_inventory SET quantity = quantity - 6 WHERE user_id = 'd8db37ac-f594-45a5-b499-5028322f9bf3' AND item_type = 'joker_fisilida';
UPDATE user_inventory SET quantity = quantity - 6 WHERE user_id = 'd8db37ac-f594-45a5-b499-5028322f9bf3' AND item_type = 'joker_senyaz';
UPDATE profiles SET weekly_first_count = 2, bonus_credits = bonus_credits - 6 WHERE id = 'd8db37ac-f594-45a5-b499-5028322f9bf3';