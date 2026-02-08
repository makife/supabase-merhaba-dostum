
-- Eski 5 ve 6 parametreli update_game_stats fonksiyonlarını sil
-- Sadece 7 parametreli (p_game_mode içeren) versiyon kalmalı

-- 6 parametreli versiyonu sil (p_user_id, p_score, p_words, p_game_duration, p_is_winner, p_first_word_time)
DROP FUNCTION IF EXISTS public.update_game_stats(uuid, integer, jsonb, integer, boolean, integer);

-- 5 parametreli versiyonu sil (p_user_id, p_score, p_words, p_is_winner, p_game_duration)
DROP FUNCTION IF EXISTS public.update_game_stats(uuid, integer, jsonb, boolean, integer);

-- Doğrulama: Artık sadece 7 parametreli versiyon kalmalı
