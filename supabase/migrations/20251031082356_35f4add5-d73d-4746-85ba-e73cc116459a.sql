-- Yeni rozetler için badges tablosuna kayıtlar ekle
-- Joker kullanım rozetleri
DO $$
BEGIN
  -- Değiştir Jokeri
  INSERT INTO public.badges (name, description, icon, condition_type, condition_value) 
  VALUES ('Değişim İyidir (100)', '100 kez Değiştir jokeri kullan', '🔄', 'degistir_joker_used', 100)
  ON CONFLICT DO NOTHING;
  
  INSERT INTO public.badges (name, description, icon, condition_type, condition_value) 
  VALUES ('Değişim İyidir (1000)', '1000 kez Değiştir jokeri kullan', '🔄', 'degistir_joker_used', 1000)
  ON CONFLICT DO NOTHING;

  -- Fısılda Jokeri  
  INSERT INTO public.badges (name, description, icon, condition_type, condition_value) 
  VALUES ('Gaipten Sesler (100)', '100 kez Fısılda jokeri kullan', '👻', 'fisilida_joker_used', 100)
  ON CONFLICT DO NOTHING;
  
  INSERT INTO public.badges (name, description, icon, condition_type, condition_value) 
  VALUES ('Gaipten Sesler (1000)', '1000 kez Fısılda jokeri kullan', '👻', 'fisilida_joker_used', 1000)
  ON CONFLICT DO NOTHING;

  -- Sen Yaz Jokeri
  INSERT INTO public.badges (name, description, icon, condition_type, condition_value) 
  VALUES ('Sen Zahmet Etme (100)', '100 kez Sen Yaz jokeri kullan', '✍️', 'senyaz_joker_used', 100)
  ON CONFLICT DO NOTHING;
  
  INSERT INTO public.badges (name, description, icon, condition_type, condition_value) 
  VALUES ('Sen Zahmet Etme (1000)', '1000 kez Sen Yaz jokeri kullan', '✍️', 'senyaz_joker_used', 1000)
  ON CONFLICT DO NOTHING;

  -- Bilgisayara Karşı Mod
  INSERT INTO public.badges (name, description, icon, condition_type, condition_value) 
  VALUES ('AI Zaferi (100)', 'Bilgisayara karşı 100 oyun oyna', '🤖', 'vs_bot_games', 100)
  ON CONFLICT DO NOTHING;
  
  INSERT INTO public.badges (name, description, icon, condition_type, condition_value) 
  VALUES ('AI Zaferi (1000)', 'Bilgisayara karşı 1000 oyun oyna', '🤖', 'vs_bot_games', 1000)
  ON CONFLICT DO NOTHING;
  
  INSERT INTO public.badges (name, description, icon, condition_type, condition_value) 
  VALUES ('AI Zaferi (10000)', 'Bilgisayara karşı 10000 oyun oyna', '🤖', 'vs_bot_games', 10000)
  ON CONFLICT DO NOTHING;

  -- Özel Oda Modu
  INSERT INTO public.badges (name, description, icon, condition_type, condition_value) 
  VALUES ('Bizbize (100)', 'Özel odada 100 oyun oyna', '🔒', 'private_room_games', 100)
  ON CONFLICT DO NOTHING;
  
  INSERT INTO public.badges (name, description, icon, condition_type, condition_value) 
  VALUES ('Bizbize (1000)', 'Özel odada 1000 oyun oyna', '🔒', 'private_room_games', 1000)
  ON CONFLICT DO NOTHING;
  
  INSERT INTO public.badges (name, description, icon, condition_type, condition_value) 
  VALUES ('Bizbize (10000)', 'Özel odada 10000 oyun oyna', '🔒', 'private_room_games', 10000)
  ON CONFLICT DO NOTHING;

  -- Rastgele Eşleşme Modu
  INSERT INTO public.badges (name, description, icon, condition_type, condition_value) 
  VALUES ('Karma Ruhum (100)', 'Rastgele eşleşmede 100 oyun oyna', '🎲', 'random_match_games', 100)
  ON CONFLICT DO NOTHING;
  
  INSERT INTO public.badges (name, description, icon, condition_type, condition_value) 
  VALUES ('Karma Ruhum (1000)', 'Rastgele eşleşmede 1000 oyun oyna', '🎲', 'random_match_games', 1000)
  ON CONFLICT DO NOTHING;
  
  INSERT INTO public.badges (name, description, icon, condition_type, condition_value) 
  VALUES ('Karma Ruhum (10000)', 'Rastgele eşleşmede 10000 oyun oyna', '🎲', 'random_match_games', 10000)
  ON CONFLICT DO NOTHING;
END $$;

-- Profiles tablosuna joker kullanım sayaçları ekle
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS degistir_joker_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS fisilida_joker_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS senyaz_joker_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS vs_bot_games INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS private_room_games INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS random_match_games INTEGER DEFAULT 0;

-- Rozet kontrolü yapan fonksiyonu güncelle (joker ve oyun modu rozetleri için)
CREATE OR REPLACE FUNCTION public.check_and_award_badges_simple(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_stats RECORD;
  badge_record RECORD;
  newly_earned_badges TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Kullanıcı istatistiklerini al
  SELECT 
    COALESCE(total_games, 0) as total_games,
    COALESCE(total_score, 0) as total_score,
    COALESCE(win_streak, 0) as win_streak,
    COALESCE(total_words_created, 0) as total_words_created,
    COALESCE(longest_word_length, 0) as longest_word_length,
    COALESCE(tournament_wins, 0) as tournament_wins,
    COALESCE(degistir_joker_used, 0) as degistir_joker_used,
    COALESCE(fisilida_joker_used, 0) as fisilida_joker_used,
    COALESCE(senyaz_joker_used, 0) as senyaz_joker_used,
    COALESCE(vs_bot_games, 0) as vs_bot_games,
    COALESCE(private_room_games, 0) as private_room_games,
    COALESCE(random_match_games, 0) as random_match_games
  INTO user_stats
  FROM profiles 
  WHERE id = p_user_id;
  
  -- Her badge'i kontrol et
  FOR badge_record IN 
    SELECT b.id, b.name, b.condition_type, b.condition_value
    FROM badges b
    WHERE b.id NOT IN (
      SELECT ub.badge_id 
      FROM user_badges ub 
      WHERE ub.user_id = p_user_id
    )
  LOOP
    -- Badge koşulunu kontrol et ve ver
    IF (badge_record.condition_type = 'total_games' AND user_stats.total_games >= badge_record.condition_value) OR
       (badge_record.condition_type = 'total_score' AND user_stats.total_score >= badge_record.condition_value) OR
       (badge_record.condition_type = 'win_streak' AND user_stats.win_streak >= badge_record.condition_value) OR
       (badge_record.condition_type = 'total_words' AND user_stats.total_words_created >= badge_record.condition_value) OR
       (badge_record.condition_type = 'longest_word' AND user_stats.longest_word_length >= badge_record.condition_value) OR
       (badge_record.condition_type = 'tournament_wins' AND user_stats.tournament_wins >= badge_record.condition_value) OR
       (badge_record.condition_type = 'tournaments_won' AND user_stats.tournament_wins >= badge_record.condition_value) OR
       (badge_record.condition_type = 'degistir_joker_used' AND user_stats.degistir_joker_used >= badge_record.condition_value) OR
       (badge_record.condition_type = 'fisilida_joker_used' AND user_stats.fisilida_joker_used >= badge_record.condition_value) OR
       (badge_record.condition_type = 'senyaz_joker_used' AND user_stats.senyaz_joker_used >= badge_record.condition_value) OR
       (badge_record.condition_type = 'vs_bot_games' AND user_stats.vs_bot_games >= badge_record.condition_value) OR
       (badge_record.condition_type = 'private_room_games' AND user_stats.private_room_games >= badge_record.condition_value) OR
       (badge_record.condition_type = 'random_match_games' AND user_stats.random_match_games >= badge_record.condition_value) THEN
       
      -- Badge'i ver
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (p_user_id, badge_record.id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
      
      -- Yeni kazanılan rozeti listeye ekle
      newly_earned_badges := array_append(newly_earned_badges, badge_record.name);
    END IF;
  END LOOP;
  
  -- Eğer yeni rozet kazanıldıysa bildirim gönder
  IF array_length(newly_earned_badges, 1) > 0 THEN
    FOR i IN 1..array_length(newly_earned_badges, 1) LOOP
      PERFORM create_notification(
        p_user_id,
        'badge_earned',
        'Yeni rozet kazandınız: ' || newly_earned_badges[i],
        NULL
      );
    END LOOP;
  END IF;
END;
$function$;