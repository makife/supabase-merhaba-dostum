/*
  # Turnuva Sistemi Düzeltmeleri

  1. Yeni Tablolar
    - `user_bans` - Kullanıcı yasakları için
    - `game_words` - Oyun kelimelerini takip için
    
  2. Güncellenen Tablolar
    - `tournament_matches` - player1_score, player2_score kolonları eklendi
    - `game_rooms` - winner_id, player1_id, player2_id, player1_score, player2_score eklendi
    
  3. Yeni Fonksiyonlar
    - `update_game_stats` - Oyun istatistiklerini günceller
    - `cleanup_expired_rooms` - Eski odaları temizler
    
  4. Güvenlik
    - Tüm tablolar için RLS etkin
    - Uygun politikalar eklendi
*/

-- User bans table for chat moderation
CREATE TABLE IF NOT EXISTS public.user_bans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  banned_until TIMESTAMP WITH TIME ZONE NOT NULL,
  banned_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  banned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game words table to track words used in games
CREATE TABLE IF NOT EXISTS public.game_words (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL,
  player_id UUID NOT NULL,
  word TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  position_x INTEGER,
  position_y INTEGER,
  direction TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to tournament_matches
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournament_matches' AND column_name = 'player1_score') THEN
    ALTER TABLE public.tournament_matches ADD COLUMN player1_score INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournament_matches' AND column_name = 'player2_score') THEN
    ALTER TABLE public.tournament_matches ADD COLUMN player2_score INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add missing columns to game_rooms for better game tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_rooms' AND column_name = 'winner_id') THEN
    ALTER TABLE public.game_rooms ADD COLUMN winner_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_rooms' AND column_name = 'player1_id') THEN
    ALTER TABLE public.game_rooms ADD COLUMN player1_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_rooms' AND column_name = 'player2_id') THEN
    ALTER TABLE public.game_rooms ADD COLUMN player2_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_rooms' AND column_name = 'player1_score') THEN
    ALTER TABLE public.game_rooms ADD COLUMN player1_score INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_rooms' AND column_name = 'player2_score') THEN
    ALTER TABLE public.game_rooms ADD COLUMN player2_score INTEGER DEFAULT 0;
  END IF;
END $$;

-- Enable RLS for new tables
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_words ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_bans
CREATE POLICY "Users can view their own bans" ON public.user_bans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage bans" ON public.user_bans
  FOR ALL USING (true) WITH CHECK (true);

-- RLS policies for game_words
CREATE POLICY "Game words are viewable by everyone" ON public.game_words
  FOR SELECT USING (true);

CREATE POLICY "Players can add words to games" ON public.game_words
  FOR INSERT WITH CHECK (auth.uid() = player_id);

-- Add foreign key constraints for game_words
ALTER TABLE public.game_words 
ADD CONSTRAINT fk_game_words_room FOREIGN KEY (room_id) REFERENCES public.game_rooms(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_game_words_player FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Enable realtime for new tables
ALTER TABLE public.user_bans REPLICA IDENTITY FULL;
ALTER TABLE public.game_words REPLICA IDENTITY FULL;
ALTER TABLE public.tournament_matches REPLICA IDENTITY FULL;
ALTER TABLE public.tournament_participants REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_bans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_words;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_participants;

-- Improved game statistics update function
CREATE OR REPLACE FUNCTION public.update_game_stats(
  p_user_id UUID,
  p_score INTEGER,
  p_words JSONB,
  p_game_duration INTEGER DEFAULT NULL,
  p_is_winner BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  word_obj JSONB;
  word_text TEXT;
  word_score INTEGER;
  word_length INTEGER;
  current_profile RECORD;
  new_longest_word TEXT;
  new_longest_length INTEGER;
  new_highest_word TEXT;
  new_highest_score INTEGER;
  new_total_words INTEGER;
  new_avg_length NUMERIC;
  new_win_streak INTEGER;
  new_average_score NUMERIC;
BEGIN
  -- Get current profile stats
  SELECT 
    total_score, total_games, wins, losses, win_streak,
    longest_word, longest_word_length, highest_word, highest_word_score,
    total_words_created, average_word_length, average_score
  INTO current_profile
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Initialize variables with current values
  new_longest_word := current_profile.longest_word;
  new_longest_length := COALESCE(current_profile.longest_word_length, 0);
  new_highest_word := current_profile.highest_word;
  new_highest_score := COALESCE(current_profile.highest_word_score, 0);
  new_total_words := COALESCE(current_profile.total_words_created, 0);
  new_avg_length := COALESCE(current_profile.average_word_length, 0);
  
  -- Process each word
  FOR word_obj IN SELECT * FROM jsonb_array_elements(p_words)
  LOOP
    word_text := word_obj->>'word';
    word_score := (word_obj->>'score')::INTEGER;
    word_length := LENGTH(word_text);
    
    -- Update longest word
    IF word_length > new_longest_length THEN
      new_longest_word := word_text;
      new_longest_length := word_length;
    END IF;
    
    -- Update highest scoring word
    IF word_score > new_highest_score THEN
      new_highest_word := word_text;
      new_highest_score := word_score;
    END IF;
    
    new_total_words := new_total_words + 1;
  END LOOP;
  
  -- Calculate new average word length
  IF new_total_words > 0 THEN
    SELECT AVG(LENGTH(word))::NUMERIC(4,2)
    INTO new_avg_length
    FROM public.game_history
    WHERE player_id = p_user_id;
  END IF;
  
  -- Calculate win streak
  IF p_is_winner THEN
    new_win_streak := COALESCE(current_profile.win_streak, 0) + 1;
  ELSE
    new_win_streak := 0;
  END IF;
  
  -- Calculate new average score
  new_average_score := (COALESCE(current_profile.total_score, 0) + p_score) / (COALESCE(current_profile.total_games, 0) + 1);
  
  -- Update profile with all statistics
  UPDATE public.profiles
  SET 
    total_score = COALESCE(current_profile.total_score, 0) + p_score,
    total_games = COALESCE(current_profile.total_games, 0) + 1,
    wins = CASE WHEN p_is_winner THEN COALESCE(current_profile.wins, 0) + 1 ELSE COALESCE(current_profile.wins, 0) END,
    losses = CASE WHEN NOT p_is_winner THEN COALESCE(current_profile.losses, 0) + 1 ELSE COALESCE(current_profile.losses, 0) END,
    win_streak = new_win_streak,
    longest_word = new_longest_word,
    longest_word_length = new_longest_length,
    highest_word = new_highest_word,
    highest_word_score = new_highest_score,
    total_words_created = new_total_words,
    average_word_length = new_avg_length,
    average_score = new_average_score,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Cleanup function for old rooms
CREATE OR REPLACE FUNCTION public.cleanup_expired_rooms()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Delete rooms older than 1 hour
  DELETE FROM public.game_rooms 
  WHERE created_at < NOW() - INTERVAL '1 hour'
  AND status IN ('waiting', 'finished');
  
  -- Delete orphaned participants
  DELETE FROM public.game_participants 
  WHERE room_id NOT IN (SELECT id FROM public.game_rooms);
END;
$$;

-- Improved tournament match completion function
CREATE OR REPLACE FUNCTION public.complete_tournament_match(
  p_match_id UUID,
  p_winner_id UUID,
  p_player1_score INTEGER,
  p_player2_score INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_match RECORD;
  v_tournament RECORD;
  v_loser_id UUID;
  v_current_round_matches INTEGER;
  v_completed_matches INTEGER;
  v_next_round INTEGER;
  v_winners UUID[];
BEGIN
  -- Get match and tournament info
  SELECT tm.*, t.current_round, t.status as tournament_status
  INTO v_match
  FROM tournament_matches tm
  JOIN tournaments t ON t.id = tm.tournament_id
  WHERE tm.id = p_match_id;
  
  IF v_match.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Match not found');
  END IF;
  
  -- Update match with results
  UPDATE tournament_matches 
  SET 
    status = 'completed',
    winner_id = p_winner_id,
    player1_score = p_player1_score,
    player2_score = p_player2_score,
    updated_at = NOW()
  WHERE id = p_match_id;
  
  -- Determine loser and eliminate them
  v_loser_id := CASE 
    WHEN v_match.player1_id = p_winner_id THEN v_match.player2_id 
    ELSE v_match.player1_id 
  END;
  
  IF v_loser_id IS NOT NULL THEN
    UPDATE tournament_participants 
    SET eliminated_at = NOW()
    WHERE tournament_id = v_match.tournament_id 
    AND user_id = v_loser_id;
  END IF;
  
  -- Check if current round is complete
  SELECT 
    COUNT(*) as total_matches,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_matches
  INTO v_current_round_matches, v_completed_matches
  FROM tournament_matches 
  WHERE tournament_id = v_match.tournament_id 
  AND round = v_match.round;
  
  -- If round is complete, advance to next round or finish tournament
  IF v_completed_matches = v_current_round_matches THEN
    v_next_round := v_match.round + 1;
    
    -- Check if tournament is finished (after final)
    IF v_match.round = 3 THEN
      UPDATE tournaments 
      SET 
        status = 'finished',
        finished_at = NOW()
      WHERE id = v_match.tournament_id;
      
      RETURN json_build_object(
        'success', true,
        'tournament_finished', true,
        'winner_id', p_winner_id
      );
    END IF;
    
    -- Get winners from current round
    SELECT array_agg(winner_id ORDER BY match_number)
    INTO v_winners
    FROM tournament_matches 
    WHERE tournament_id = v_match.tournament_id 
    AND round = v_match.round 
    AND status = 'completed'
    AND winner_id IS NOT NULL;
    
    -- Create next round matches
    FOR i IN 1..array_length(v_winners, 1) BY 2 LOOP
      IF i + 1 <= array_length(v_winners, 1) THEN
        INSERT INTO tournament_matches (
          tournament_id,
          round,
          match_number,
          player1_id,
          player2_id,
          status,
          created_at,
          updated_at
        ) VALUES (
          v_match.tournament_id,
          v_next_round,
          (i + 1) / 2,
          v_winners[i],
          v_winners[i + 1],
          'pending',
          NOW(),
          NOW()
        );
      END IF;
    END LOOP;
    
    -- Update tournament round
    UPDATE tournaments 
    SET current_round = v_next_round
    WHERE id = v_match.tournament_id;
    
    RETURN json_build_object(
      'success', true,
      'next_round_created', true,
      'next_round', v_next_round
    );
  END IF;
  
  RETURN json_build_object('success', true, 'match_completed', true);
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Enable RLS for new tables
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_words ENABLE ROW LEVEL SECURITY;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_round ON public.tournament_matches(tournament_id, round);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_status ON public.tournament_matches(status);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON public.tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_game_words_room_player ON public.game_words(room_id, player_id);