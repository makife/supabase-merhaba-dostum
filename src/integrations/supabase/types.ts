export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      badges: {
        Row: {
          condition_type: string
          condition_value: number
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          condition_type: string
          condition_value: number
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          condition_type?: string
          condition_value?: number
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      daily_leaderboard: {
        Row: {
          avatar_url: string | null
          best_word: string | null
          best_word_score: number | null
          created_at: string | null
          daily_score: number | null
          date: string
          games_played: number | null
          id: string
          updated_at: string | null
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          best_word?: string | null
          best_word_score?: number | null
          created_at?: string | null
          daily_score?: number | null
          date?: string
          games_played?: number | null
          id?: string
          updated_at?: string | null
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          best_word?: string | null
          best_word_score?: number | null
          created_at?: string | null
          daily_score?: number | null
          date?: string
          games_played?: number | null
          id?: string
          updated_at?: string | null
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_leaderboard_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_history: {
        Row: {
          id: string
          player_id: string | null
          room_id: string | null
          score: number
          submitted_at: string | null
          word: string
        }
        Insert: {
          id?: string
          player_id?: string | null
          room_id?: string | null
          score: number
          submitted_at?: string | null
          word: string
        }
        Update: {
          id?: string
          player_id?: string | null
          room_id?: string | null
          score?: number
          submitted_at?: string | null
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_history_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      game_participants: {
        Row: {
          id: string
          is_bot: boolean | null
          joined_at: string | null
          room_id: string | null
          score: number | null
          user_id: string | null
        }
        Insert: {
          id?: string
          is_bot?: boolean | null
          joined_at?: string | null
          room_id?: string | null
          score?: number | null
          user_id?: string | null
        }
        Update: {
          id?: string
          is_bot?: boolean | null
          joined_at?: string | null
          room_id?: string | null
          score?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rooms: {
        Row: {
          created_at: string | null
          current_grid: string[] | null
          finished_at: string | null
          game_mode: string
          game_type_new: string | null
          host_id: string | null
          id: string
          max_score: number | null
          player1_id: string | null
          player1_score: number | null
          player2_id: string | null
          player2_score: number | null
          room_code: string | null
          started_at: string | null
          status: string | null
          time_limit: number | null
          used_words: Json | null
          winner_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_grid?: string[] | null
          finished_at?: string | null
          game_mode: string
          game_type_new?: string | null
          host_id?: string | null
          id?: string
          max_score?: number | null
          player1_id?: string | null
          player1_score?: number | null
          player2_id?: string | null
          player2_score?: number | null
          room_code?: string | null
          started_at?: string | null
          status?: string | null
          time_limit?: number | null
          used_words?: Json | null
          winner_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_grid?: string[] | null
          finished_at?: string | null
          game_mode?: string
          game_type_new?: string | null
          host_id?: string | null
          id?: string
          max_score?: number | null
          player1_id?: string | null
          player1_score?: number | null
          player2_id?: string | null
          player2_score?: number | null
          room_code?: string | null
          started_at?: string | null
          status?: string | null
          time_limit?: number | null
          used_words?: Json | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_rooms_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_words: {
        Row: {
          created_at: string | null
          id: string
          player_id: string
          points: number | null
          room_id: string
          word: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          player_id: string
          points?: number | null
          room_id: string
          word: string
        }
        Update: {
          created_at?: string | null
          id?: string
          player_id?: string
          points?: number | null
          room_id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_game_words_player"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_game_words_room"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      global_chat: {
        Row: {
          created_at: string
          id: string
          message: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      matchmaking_rooms: {
        Row: {
          created_at: string
          current_players: number
          expires_at: string
          game_type: string
          id: string
          max_players: number
          room_data: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          current_players?: number
          expires_at?: string
          game_type: string
          id?: string
          max_players?: number
          room_data?: Json | null
          status?: string
        }
        Update: {
          created_at?: string
          current_players?: number
          expires_at?: string
          game_type?: string
          id?: string
          max_players?: number
          room_data?: Json | null
          status?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_message_reactions_message_id"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "global_chat"
            referencedColumns: ["id"]
          },
        ]
      }
      private_chats: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      private_messages: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "private_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          average_score: number | null
          average_word_length: number | null
          best_streak: number | null
          bonus_credits: number | null
          created_at: string | null
          daily_games: number | null
          daily_wins: number | null
          disconnect_count: number | null
          email: string
          fastest_word_time: number | null
          favorite_letter: string | null
          game_credits: number | null
          highest_word: string | null
          highest_word_score: number | null
          hint_credits: number | null
          id: string
          last_credit_refresh: string | null
          last_daily_reset: string | null
          last_disconnect: string | null
          last_win: string | null
          longest_word: string | null
          longest_word_length: number | null
          losses: number | null
          premium_until: string | null
          total_games: number | null
          total_play_time: number | null
          total_score: number | null
          total_words: number | null
          total_words_created: number | null
          updated_at: string | null
          username: string | null
          win_count: number | null
          win_streak: number | null
          wins: number | null
        }
        Insert: {
          avatar_url?: string | null
          average_score?: number | null
          average_word_length?: number | null
          best_streak?: number | null
          bonus_credits?: number | null
          created_at?: string | null
          daily_games?: number | null
          daily_wins?: number | null
          disconnect_count?: number | null
          email: string
          fastest_word_time?: number | null
          favorite_letter?: string | null
          game_credits?: number | null
          highest_word?: string | null
          highest_word_score?: number | null
          hint_credits?: number | null
          id: string
          last_credit_refresh?: string | null
          last_daily_reset?: string | null
          last_disconnect?: string | null
          last_win?: string | null
          longest_word?: string | null
          longest_word_length?: number | null
          losses?: number | null
          premium_until?: string | null
          total_games?: number | null
          total_play_time?: number | null
          total_score?: number | null
          total_words?: number | null
          total_words_created?: number | null
          updated_at?: string | null
          username?: string | null
          win_count?: number | null
          win_streak?: number | null
          wins?: number | null
        }
        Update: {
          avatar_url?: string | null
          average_score?: number | null
          average_word_length?: number | null
          best_streak?: number | null
          bonus_credits?: number | null
          created_at?: string | null
          daily_games?: number | null
          daily_wins?: number | null
          disconnect_count?: number | null
          email?: string
          fastest_word_time?: number | null
          favorite_letter?: string | null
          game_credits?: number | null
          highest_word?: string | null
          highest_word_score?: number | null
          hint_credits?: number | null
          id?: string
          last_credit_refresh?: string | null
          last_daily_reset?: string | null
          last_disconnect?: string | null
          last_win?: string | null
          longest_word?: string | null
          longest_word_length?: number | null
          losses?: number | null
          premium_until?: string | null
          total_games?: number | null
          total_play_time?: number | null
          total_score?: number | null
          total_words?: number | null
          total_words_created?: number | null
          updated_at?: string | null
          username?: string | null
          win_count?: number | null
          win_streak?: number | null
          wins?: number | null
        }
        Relationships: []
      }
      tournament_matches: {
        Row: {
          created_at: string | null
          id: string
          match_number: number
          player1_id: string | null
          player2_id: string | null
          room_id: string | null
          round: number
          status: string | null
          tournament_id: string | null
          updated_at: string | null
          winner_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          match_number: number
          player1_id?: string | null
          player2_id?: string | null
          room_id?: string | null
          round: number
          status?: string | null
          tournament_id?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          match_number?: number
          player1_id?: string | null
          player2_id?: string | null
          room_id?: string | null
          round?: number
          status?: string | null
          tournament_id?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_participants: {
        Row: {
          eliminated_at: string | null
          id: string
          is_bot: boolean | null
          joined_at: string | null
          seed: number | null
          tournament_id: string | null
          user_id: string | null
        }
        Insert: {
          eliminated_at?: string | null
          id?: string
          is_bot?: boolean | null
          joined_at?: string | null
          seed?: number | null
          tournament_id?: string | null
          user_id?: string | null
        }
        Update: {
          eliminated_at?: string | null
          id?: string
          is_bot?: boolean | null
          joined_at?: string | null
          seed?: number | null
          tournament_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string | null
          current_round: number | null
          expires_at: string | null
          finished_at: string | null
          game_type: string
          id: string
          max_participants: number | null
          name: string
          started_at: string | null
          status: string | null
          timeout_duration: number | null
        }
        Insert: {
          created_at?: string | null
          current_round?: number | null
          expires_at?: string | null
          finished_at?: string | null
          game_type?: string
          id?: string
          max_participants?: number | null
          name: string
          started_at?: string | null
          status?: string | null
          timeout_duration?: number | null
        }
        Update: {
          created_at?: string | null
          current_round?: number | null
          expires_at?: string | null
          finished_at?: string | null
          game_type?: string
          id?: string
          max_participants?: number | null
          name?: string
          started_at?: string | null
          status?: string | null
          timeout_duration?: number | null
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string | null
          earned_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          badge_id?: string | null
          earned_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          badge_id?: string | null
          earned_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_inventory: {
        Row: {
          id: string
          item_type: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          item_type: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          item_type?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_purchases: {
        Row: {
          expires_at: string | null
          id: string
          is_active: boolean
          item_id: string
          item_type: string
          purchased_at: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          id?: string
          is_active?: boolean
          item_id: string
          item_type: string
          purchased_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          id?: string
          is_active?: boolean
          item_id?: string
          item_type?: string
          purchased_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          active_avatar_frame: string | null
          active_music_pack: string | null
          active_sound_pack: string | null
          active_theme: string | null
          confetti_effect_enabled: boolean | null
          created_at: string
          effects_enabled: boolean | null
          fireworks_effect_enabled: boolean | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_avatar_frame?: string | null
          active_music_pack?: string | null
          active_sound_pack?: string | null
          active_theme?: string | null
          confetti_effect_enabled?: boolean | null
          created_at?: string
          effects_enabled?: boolean | null
          fireworks_effect_enabled?: boolean | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_avatar_frame?: string | null
          active_music_pack?: string | null
          active_sound_pack?: string | null
          active_theme?: string | null
          confetti_effect_enabled?: boolean | null
          created_at?: string
          effects_enabled?: boolean | null
          fireworks_effect_enabled?: boolean | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      words: {
        Row: {
          created_at: string | null
          difficulty: number | null
          id: string
          is_approved: boolean | null
          length: number
          word: string
        }
        Insert: {
          created_at?: string | null
          difficulty?: number | null
          id?: string
          is_approved?: boolean | null
          length: number
          word: string
        }
        Update: {
          created_at?: string | null
          difficulty?: number | null
          id?: string
          is_approved?: boolean | null
          length?: number
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_average_word_length: {
        Args: { p_user_id: string }
        Returns: number
      }
      check_and_award_badges: {
        Args: { p_user_id: string }
        Returns: {
          new_badge_icon: string
          new_badge_id: string
          new_badge_name: string
        }[]
      }
      check_and_refresh_credits: {
        Args: { user_id: string }
        Returns: undefined
      }
      check_words_per_game_badge: {
        Args: { p_user_id: string; p_words_count: number }
        Returns: {
          new_badge_icon: string
          new_badge_id: string
          new_badge_name: string
        }[]
      }
      cleanup_expired_matchmaking_rooms: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_tournaments: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      complete_tournament_match: {
        Args: {
          p_match_id: string
          p_player1_score: number
          p_player2_score: number
          p_winner_id: string
        }
        Returns: Json
      }
      create_matches_for_active_tournament: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      generate_random_grid: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_avatar_url: {
        Args: { user_id: string }
        Returns: string
      }
      get_daily_top_leaders: {
        Args: { limit_count?: number; target_date?: string }
        Returns: {
          avatar_url: string
          best_word: string
          best_word_score: number
          daily_score: number
          games_played: number
          rank: number
          user_id: string
          username: string
        }[]
      }
      get_frequent_disconnectors: {
        Args: { limit_count?: number }
        Returns: {
          disconnect_count: number
          disconnect_ratio: number
          user_id: string
          username: string
          win_count: number
        }[]
      }
      get_or_create_private_chat: {
        Args: { other_user_id: string }
        Returns: string
      }
      get_tournament_status: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      get_user_tournament_status: {
        Args: { p_tournament_id: string; p_user_id: string }
        Returns: Json
      }
      recalculate_user_stats: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      reset_daily_games: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      start_tournament_automatically: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      start_tournament_with_bracket: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      update_daily_leaderboard: {
        Args: {
          p_avatar_url: string
          p_best_word?: string
          p_best_word_score?: number
          p_game_score: number
          p_user_id: string
          p_username: string
        }
        Returns: undefined
      }
      update_game_statistics: {
        Args: {
          p_game_score: number
          p_is_winner?: boolean
          p_user_id: string
          p_words: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
