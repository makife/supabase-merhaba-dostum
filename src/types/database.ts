// src/types/database.ts
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          game_credits: number;
          bonus_credits: number;
          premium_until: string | null;
          hint_credits: number;
          last_credit_refresh: string | null;
          total_score: number;
          created_at: string;
          banned_until: string | null;
          // Diğer alanlar
          daily_games?: number;
          win_streak?: number;
          daily_wins?: number;
          best_streak?: number;
          average_score?: number;
          total_words?: number;
          favorite_letter?: string;
          total_play_time?: number;
          last_daily_reset?: string;
          total_games?: number;
          wins?: number;
          losses?: number;
          longest_word?: string;
          fastest_word_time?: number;
          disconnect_count?: number;
          win_count?: number;
          last_disconnect?: string;
          last_win?: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          game_credits?: number;
          bonus_credits?: number;
          premium_until?: string | null;
          hint_credits?: number;
          last_credit_refresh?: string | null;
          total_score?: number;
          created_at?: string;
          banned_until?: string | null;
          // Diğer alanlar
          daily_games?: number;
          win_streak?: number;
          daily_wins?: number;
          best_streak?: number;
          average_score?: number;
          total_words?: number;
          favorite_letter?: string;
          total_play_time?: number;
          last_daily_reset?: string;
          total_games?: number;
          wins?: number;
          losses?: number;
          longest_word?: string;
          fastest_word_time?: number;
          disconnect_count?: number;
          win_count?: number;
          last_disconnect?: string;
          last_win?: string;
        };
        Update: {
          username?: string | null;
          avatar_url?: string | null;
          game_credits?: number;
          bonus_credits?: number;
          premium_until?: string | null;
          hint_credits?: number;
          last_credit_refresh?: string | null;
          total_score?: number;
          banned_until?: string | null;
          // Diğer alanlar
          daily_games?: number;
          win_streak?: number;
          daily_wins?: number;
          best_streak?: number;
          average_score?: number;
          total_words?: number;
          favorite_letter?: string;
          total_play_time?: number;
          last_daily_reset?: string;
          total_games?: number;
          wins?: number;
          losses?: number;
          longest_word?: string;
          fastest_word_time?: number;
          disconnect_count?: number;
          win_count?: number;
          last_disconnect?: string;
          last_win?: string;
        };
      };
      global_chat: {
        Row: {
          id: string;
          user_id: string;
          username: string;
          message: string;
          created_at: string;
          avatar_url?: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          username: string;
          message: string;
          created_at?: string;
          avatar_url?: string | null;
        };
        Update: {
          user_id?: string;
          username?: string;
          message?: string;
          created_at?: string;
          avatar_url?: string | null;
        };
      };
      message_reactions: {
        Row: {
          id: string;
          message_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          user_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: {
          message_id?: string;
          user_id?: string;
          emoji?: string;
          created_at?: string;
        };
      };
      banned_words: {
        Row: {
          id: number;
          word: string;
          severity: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          word: string;
          severity?: number;
          created_at?: string;
        };
        Update: {
          word?: string;
          severity?: number;
          created_at?: string;
        };
      };
      private_chats: {
        Row: {
          id: string;
          user1_id: string;
          user2_id: string;
          created_at: string;
        };
        Insert: {
          id: string;
          user1_id: string;
          user2_id: string;
          created_at?: string;
        };
        Update: {
          user1_id?: string;
          user2_id?: string;
          created_at?: string;
        };
      };
      private_messages: {
        Row: {
          id: string;
          chat_id: string;
          sender_id: string;
          message: string;
          created_at: string;
          is_read: boolean;
        };
        Insert: {
          id?: string;
          chat_id: string;
          sender_id: string;
          message: string;
          created_at?: string;
          is_read?: boolean;
        };
        Update: {
          chat_id?: string;
          sender_id?: string;
          message?: string;
          created_at?: string;
          is_read?: boolean;
        };
      };
      user_presence: {
        Row: {
          user_id: string;
          is_online: boolean;
          last_seen: string;
        };
        Insert: {
          user_id: string;
          is_online?: boolean;
          last_seen?: string;
        };
        Update: {
          is_online?: boolean;
          last_seen?: string;
        };
      };
    };
    Functions: {
      moderate_and_insert_message: {
        Args: {
          p_user_id: string;
          p_username: string;
          p_message: string;
          p_avatar_url: string;
        };
        Returns: Json;
      };
      check_and_refresh_credits: {
        Args: {
          user_id: string;
        };
        Returns: Json;
      };
    };
  };
}
