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
      app_versions: {
        Row: {
          force_update: boolean
          id: string
          latest_version: string
          min_version: string
          platform: string
          release_notes: string | null
          store_url: string
          updated_at: string
        }
        Insert: {
          force_update?: boolean
          id?: string
          latest_version: string
          min_version: string
          platform: string
          release_notes?: string | null
          store_url: string
          updated_at?: string
        }
        Update: {
          force_update?: boolean
          id?: string
          latest_version?: string
          min_version?: string
          platform?: string
          release_notes?: string | null
          store_url?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      banned_users: {
        Row: {
          banned_by: string | null
          banned_until: string
          created_at: string | null
          id: string
          reason: string
          user_id: string | null
        }
        Insert: {
          banned_by?: string | null
          banned_until: string
          created_at?: string | null
          id?: string
          reason: string
          user_id?: string | null
        }
        Update: {
          banned_by?: string | null
          banned_until?: string
          created_at?: string | null
          id?: string
          reason?: string
          user_id?: string | null
        }
        Relationships: []
      }
      banned_words: {
        Row: {
          created_at: string | null
          id: number
          severity: number | null
          word: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          severity?: number | null
          word: string
        }
        Update: {
          created_at?: string | null
          id?: number
          severity?: number | null
          word?: string
        }
        Relationships: []
      }
      challenge_scores: {
        Row: {
          avatar_url: string | null
          challenge_type: string
          created_at: string
          date: string
          id: string
          moves_count: number | null
          score: number
          time_seconds: number | null
          user_id: string
          username: string
          words_found: number
        }
        Insert: {
          avatar_url?: string | null
          challenge_type: string
          created_at?: string
          date?: string
          id?: string
          moves_count?: number | null
          score?: number
          time_seconds?: number | null
          user_id: string
          username?: string
          words_found?: number
        }
        Update: {
          avatar_url?: string | null
          challenge_type?: string
          created_at?: string
          date?: string
          id?: string
          moves_count?: number | null
          score?: number
          time_seconds?: number | null
          user_id?: string
          username?: string
          words_found?: number
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
      daily_stats: {
        Row: {
          created_at: string
          date: string
          games_played: number | null
          games_won: number | null
          id: string
          play_time: number | null
          total_score: number | null
          updated_at: string
          user_id: string
          words_created: number | null
        }
        Insert: {
          created_at?: string
          date?: string
          games_played?: number | null
          games_won?: number | null
          id?: string
          play_time?: number | null
          total_score?: number | null
          updated_at?: string
          user_id: string
          words_created?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          games_played?: number | null
          games_won?: number | null
          id?: string
          play_time?: number | null
          total_score?: number | null
          updated_at?: string
          user_id?: string
          words_created?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_messages: {
        Row: {
          created_at: string | null
          email: string
          id: number
          message: string
          name: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: number
          message: string
          name?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: number
          message?: string
          name?: string | null
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          is_ready: boolean | null
          joined_at: string | null
          room_id: string | null
          score: number | null
          user_id: string | null
        }
        Insert: {
          id?: string
          is_bot?: boolean | null
          is_ready?: boolean | null
          joined_at?: string | null
          room_id?: string | null
          score?: number | null
          user_id?: string | null
        }
        Update: {
          id?: string
          is_bot?: boolean | null
          is_ready?: boolean | null
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
          countdown_started_at: string | null
          created_at: string | null
          current_grid: string[] | null
          ends_at: string | null
          finished_at: string | null
          game_duration: number | null
          game_mode: string
          game_type_new: string | null
          host_id: string | null
          id: string
          max_players: number | null
          max_score: number | null
          player1_id: string | null
          player1_score: number | null
          player2_id: string | null
          player2_score: number | null
          room_code: string | null
          started_at: string | null
          status: string | null
          time_limit: number | null
          updated_at: string | null
          used_words: Json | null
          winner_id: string | null
        }
        Insert: {
          countdown_started_at?: string | null
          created_at?: string | null
          current_grid?: string[] | null
          ends_at?: string | null
          finished_at?: string | null
          game_duration?: number | null
          game_mode: string
          game_type_new?: string | null
          host_id?: string | null
          id?: string
          max_players?: number | null
          max_score?: number | null
          player1_id?: string | null
          player1_score?: number | null
          player2_id?: string | null
          player2_score?: number | null
          room_code?: string | null
          started_at?: string | null
          status?: string | null
          time_limit?: number | null
          updated_at?: string | null
          used_words?: Json | null
          winner_id?: string | null
        }
        Update: {
          countdown_started_at?: string | null
          created_at?: string | null
          current_grid?: string[] | null
          ends_at?: string | null
          finished_at?: string | null
          game_duration?: number | null
          game_mode?: string
          game_type_new?: string | null
          host_id?: string | null
          id?: string
          max_players?: number | null
          max_score?: number | null
          player1_id?: string | null
          player1_score?: number | null
          player2_id?: string | null
          player2_score?: number | null
          room_code?: string | null
          started_at?: string | null
          status?: string | null
          time_limit?: number | null
          updated_at?: string | null
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
      game_sessions: {
        Row: {
          created_at: string
          game_duration: number
          game_mode: string
          id: string
          is_winner: boolean
          score: number
          user_id: string
          words_count: number
        }
        Insert: {
          created_at?: string
          game_duration?: number
          game_mode?: string
          id?: string
          is_winner?: boolean
          score?: number
          user_id: string
          words_count?: number
        }
        Update: {
          created_at?: string
          game_duration?: number
          game_mode?: string
          id?: string
          is_winner?: boolean
          score?: number
          user_id?: string
          words_count?: number
        }
        Relationships: []
      }
      game_words: {
        Row: {
          created_at: string | null
          direction: string | null
          id: string
          player_id: string
          points: number | null
          position_x: number | null
          position_y: number | null
          room_id: string
          word: string
        }
        Insert: {
          created_at?: string | null
          direction?: string | null
          id?: string
          player_id: string
          points?: number | null
          position_x?: number | null
          position_y?: number | null
          room_id: string
          word: string
        }
        Update: {
          created_at?: string | null
          direction?: string | null
          id?: string
          player_id?: string
          points?: number | null
          position_x?: number | null
          position_y?: number | null
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
          avatar_url: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          is_deleted: boolean | null
          is_moderated: boolean | null
          is_read: boolean | null
          message: string
          moderated_at: string | null
          moderated_reason: string | null
          user_id: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_moderated?: boolean | null
          is_read?: boolean | null
          message: string
          moderated_at?: string | null
          moderated_reason?: string | null
          user_id?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_moderated?: boolean | null
          is_read?: boolean | null
          message?: string
          moderated_at?: string | null
          moderated_reason?: string | null
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
      global_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "global_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_rooms: {
        Row: {
          created_at: string
          current_players: number
          expires_at: string
          game_grid: Json | null
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
          game_grid?: Json | null
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
          game_grid?: Json | null
          game_type?: string
          id?: string
          max_players?: number
          room_data?: Json | null
          status?: string
        }
        Relationships: []
      }
      memory_game_plays: {
        Row: {
          created_at: string | null
          id: string
          played_at: string | null
          score: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          played_at?: string | null
          score?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          played_at?: string | null
          score?: number | null
          user_id?: string | null
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
        Relationships: []
      }
      message_reports: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          message_id: string
          message_type: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_user_id: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["report_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          message_id: string
          message_type: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_user_id: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          message_id?: string
          message_type?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reported_user_id?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      monthly_stats: {
        Row: {
          avg_score: number | null
          best_game_score: number | null
          created_at: string
          games_played: number
          games_won: number
          id: string
          month_start: string
          total_score: number
          total_words: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_score?: number | null
          best_game_score?: number | null
          created_at?: string
          games_played?: number
          games_won?: number
          id?: string
          month_start: string
          total_score?: number
          total_words?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_score?: number | null
          best_game_score?: number | null
          created_at?: string
          games_played?: number
          games_won?: number
          id?: string
          month_start?: string
          total_score?: number
          total_words?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          related_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          related_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          related_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_activities: {
        Row: {
          created_at: string | null
          id: string
          last_action_time: string | null
          match_id: string | null
          player_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_action_time?: string | null
          match_id?: string | null
          player_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_action_time?: string | null
          match_id?: string | null
          player_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      premium_daily_rewards: {
        Row: {
          claimed_at: string
          degistir_given: number
          fisilida_given: number
          id: string
          reward_date: string
          senyaz_given: number
          user_id: string
        }
        Insert: {
          claimed_at?: string
          degistir_given?: number
          fisilida_given?: number
          id?: string
          reward_date?: string
          senyaz_given?: number
          user_id: string
        }
        Update: {
          claimed_at?: string
          degistir_given?: number
          fisilida_given?: number
          id?: string
          reward_date?: string
          senyaz_given?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_daily_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      private_chats: {
        Row: {
          created_at: string | null
          id: string
          updated_at: string | null
          user1_id: string | null
          user2_id: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          updated_at?: string | null
          user1_id?: string | null
          user2_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user1_id?: string | null
          user2_id?: string | null
        }
        Relationships: []
      }
      private_messages: {
        Row: {
          chat_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          recipient_id: string | null
          sender_id: string | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          recipient_id?: string | null
          sender_id?: string | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          recipient_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "private_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "private_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepts_game_invites: boolean
          active_chat_id: string | null
          avatar_url: string | null
          average_score: number | null
          average_word_length: number | null
          banned_until: string | null
          best_streak: number | null
          bonus_credits: number | null
          bonus_spins: number
          created_at: string | null
          daily_games: number | null
          daily_wins: number | null
          degistir_joker_used: number | null
          disconnect_count: number | null
          email: string
          fastest_word_time: number | null
          favorite_letter: string | null
          fisilida_joker_used: number | null
          game_credits: number | null
          highest_word: string | null
          highest_word_score: number | null
          hint_credits: number | null
          id: string
          in_game: boolean
          ink_count: number
          last_credit_refresh: string | null
          last_daily_reset: string | null
          last_disconnect: string | null
          last_seen: string | null
          last_win: string | null
          longest_word: string | null
          longest_word_length: number | null
          losses: number | null
          monthly_first_count: number
          pending_boost_minutes: number
          premium_type: string | null
          premium_until: string | null
          private_room_games: number | null
          push_token: string | null
          random_match_games: number | null
          rank_points: number
          score_boost_source: string | null
          score_boost_until: string | null
          season_first_count: number
          senyaz_joker_used: number | null
          total_games: number | null
          total_play_time: number | null
          total_score: number | null
          total_words: number | null
          total_words_created: number | null
          tournament_wins: number | null
          unlimited_lives_until: string | null
          updated_at: string | null
          username: string | null
          vs_bot_games: number | null
          weekly_first_count: number
          win_count: number | null
          win_streak: number | null
          wins: number | null
        }
        Insert: {
          accepts_game_invites?: boolean
          active_chat_id?: string | null
          avatar_url?: string | null
          average_score?: number | null
          average_word_length?: number | null
          banned_until?: string | null
          best_streak?: number | null
          bonus_credits?: number | null
          bonus_spins?: number
          created_at?: string | null
          daily_games?: number | null
          daily_wins?: number | null
          degistir_joker_used?: number | null
          disconnect_count?: number | null
          email: string
          fastest_word_time?: number | null
          favorite_letter?: string | null
          fisilida_joker_used?: number | null
          game_credits?: number | null
          highest_word?: string | null
          highest_word_score?: number | null
          hint_credits?: number | null
          id: string
          in_game?: boolean
          ink_count?: number
          last_credit_refresh?: string | null
          last_daily_reset?: string | null
          last_disconnect?: string | null
          last_seen?: string | null
          last_win?: string | null
          longest_word?: string | null
          longest_word_length?: number | null
          losses?: number | null
          monthly_first_count?: number
          pending_boost_minutes?: number
          premium_type?: string | null
          premium_until?: string | null
          private_room_games?: number | null
          push_token?: string | null
          random_match_games?: number | null
          rank_points?: number
          score_boost_source?: string | null
          score_boost_until?: string | null
          season_first_count?: number
          senyaz_joker_used?: number | null
          total_games?: number | null
          total_play_time?: number | null
          total_score?: number | null
          total_words?: number | null
          total_words_created?: number | null
          tournament_wins?: number | null
          unlimited_lives_until?: string | null
          updated_at?: string | null
          username?: string | null
          vs_bot_games?: number | null
          weekly_first_count?: number
          win_count?: number | null
          win_streak?: number | null
          wins?: number | null
        }
        Update: {
          accepts_game_invites?: boolean
          active_chat_id?: string | null
          avatar_url?: string | null
          average_score?: number | null
          average_word_length?: number | null
          banned_until?: string | null
          best_streak?: number | null
          bonus_credits?: number | null
          bonus_spins?: number
          created_at?: string | null
          daily_games?: number | null
          daily_wins?: number | null
          degistir_joker_used?: number | null
          disconnect_count?: number | null
          email?: string
          fastest_word_time?: number | null
          favorite_letter?: string | null
          fisilida_joker_used?: number | null
          game_credits?: number | null
          highest_word?: string | null
          highest_word_score?: number | null
          hint_credits?: number | null
          id?: string
          in_game?: boolean
          ink_count?: number
          last_credit_refresh?: string | null
          last_daily_reset?: string | null
          last_disconnect?: string | null
          last_seen?: string | null
          last_win?: string | null
          longest_word?: string | null
          longest_word_length?: number | null
          losses?: number | null
          monthly_first_count?: number
          pending_boost_minutes?: number
          premium_type?: string | null
          premium_until?: string | null
          private_room_games?: number | null
          push_token?: string | null
          random_match_games?: number | null
          rank_points?: number
          score_boost_source?: string | null
          score_boost_until?: string | null
          season_first_count?: number
          senyaz_joker_used?: number | null
          total_games?: number | null
          total_play_time?: number | null
          total_score?: number | null
          total_words?: number | null
          total_words_created?: number | null
          tournament_wins?: number | null
          unlimited_lives_until?: string | null
          updated_at?: string | null
          username?: string | null
          vs_bot_games?: number | null
          weekly_first_count?: number
          win_count?: number | null
          win_streak?: number | null
          wins?: number | null
        }
        Relationships: []
      }
      rematch_opt_outs: {
        Row: {
          created_at: string
          opt_out_until: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          opt_out_until: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          opt_out_until?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rematch_opt_outs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rematch_requests: {
        Row: {
          created_at: string | null
          from_user_id: string | null
          game_type: string
          id: string
          responded_at: string | null
          room_code: string
          status: string
          to_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          from_user_id?: string | null
          game_type: string
          id?: string
          responded_at?: string | null
          room_code: string
          status?: string
          to_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          from_user_id?: string | null
          game_type?: string
          id?: string
          responded_at?: string | null
          room_code?: string
          status?: string
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rematch_requests_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rematch_requests_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_invite_rejections: {
        Row: {
          created_at: string
          id: string
          rejected_by: string
          rejected_from: string
          room_code: string
        }
        Insert: {
          created_at?: string
          id?: string
          rejected_by: string
          rejected_from: string
          room_code: string
        }
        Update: {
          created_at?: string
          id?: string
          rejected_by?: string
          rejected_from?: string
          room_code?: string
        }
        Relationships: []
      }
      system_message_reads: {
        Row: {
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "system_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      system_messages: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: number
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      tournament_matches: {
        Row: {
          countdown_started_at: string | null
          created_at: string | null
          ends_at: string | null
          id: string
          match_number: number
          player1_id: string | null
          player1_score: number | null
          player2_id: string | null
          player2_score: number | null
          round: number
          started_at: string | null
          status: string | null
          tournament_id: string | null
          updated_at: string | null
          winner_id: string | null
        }
        Insert: {
          countdown_started_at?: string | null
          created_at?: string | null
          ends_at?: string | null
          id?: string
          match_number: number
          player1_id?: string | null
          player1_score?: number | null
          player2_id?: string | null
          player2_score?: number | null
          round: number
          started_at?: string | null
          status?: string | null
          tournament_id?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Update: {
          countdown_started_at?: string | null
          created_at?: string | null
          ends_at?: string | null
          id?: string
          match_number?: number
          player1_id?: string | null
          player1_score?: number | null
          player2_id?: string | null
          player2_score?: number | null
          round?: number
          started_at?: string | null
          status?: string | null
          tournament_id?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_participants: {
        Row: {
          id: string
          is_bot: boolean | null
          is_ready: boolean | null
          joined_at: string | null
          score_finalized: boolean
          seed: number | null
          tournament_id: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          is_bot?: boolean | null
          is_ready?: boolean | null
          joined_at?: string | null
          score_finalized?: boolean
          seed?: number | null
          tournament_id?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          is_bot?: boolean | null
          is_ready?: boolean | null
          joined_at?: string | null
          score_finalized?: boolean
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
        ]
      }
      tournament_win_awards: {
        Row: {
          awarded_at: string
          final_match_id: string | null
          id: string
          tournament_id: string
          winner_id: string
        }
        Insert: {
          awarded_at?: string
          final_match_id?: string | null
          id?: string
          tournament_id: string
          winner_id: string
        }
        Update: {
          awarded_at?: string
          final_match_id?: string | null
          id?: string
          tournament_id?: string
          winner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_win_awards_final_match_id_fkey"
            columns: ["final_match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_win_awards_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_win_awards_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          creator_id: string | null
          current_round: number | null
          expires_at: string | null
          finished_at: string | null
          game_type: string | null
          id: string
          is_bot_tournament: boolean
          is_private: boolean
          max_participants: number | null
          name: string | null
          next_round_starts_at: string | null
          started_at: string | null
          status: string | null
          timeout_duration: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          creator_id?: string | null
          current_round?: number | null
          expires_at?: string | null
          finished_at?: string | null
          game_type?: string | null
          id?: string
          is_bot_tournament?: boolean
          is_private?: boolean
          max_participants?: number | null
          name?: string | null
          next_round_starts_at?: string | null
          started_at?: string | null
          status?: string | null
          timeout_duration?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          creator_id?: string | null
          current_round?: number | null
          expires_at?: string | null
          finished_at?: string | null
          game_type?: string | null
          id?: string
          is_bot_tournament?: boolean
          is_private?: boolean
          max_participants?: number | null
          name?: string | null
          next_round_starts_at?: string | null
          started_at?: string | null
          status?: string | null
          timeout_duration?: number | null
          updated_at?: string | null
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
      user_bans: {
        Row: {
          banned_at: string | null
          banned_by: string | null
          banned_until: string
          created_at: string | null
          id: string
          is_active: boolean | null
          reason: string
          user_id: string | null
        }
        Insert: {
          banned_at?: string | null
          banned_by?: string | null
          banned_until: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          reason: string
          user_id?: string | null
        }
        Update: {
          banned_at?: string | null
          banned_by?: string | null
          banned_until?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
          id: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
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
      user_presence: {
        Row: {
          is_online: boolean | null
          last_online_notified_at: string | null
          last_seen: string | null
          user_id: string
        }
        Insert: {
          is_online?: boolean | null
          last_online_notified_at?: string | null
          last_seen?: string | null
          user_id: string
        }
        Update: {
          is_online?: boolean | null
          last_online_notified_at?: string | null
          last_seen?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
          friend_online_notify: boolean
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
          friend_online_notify?: boolean
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
          friend_online_notify?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_stats: {
        Row: {
          avg_score: number | null
          best_game_score: number | null
          created_at: string
          games_played: number
          games_won: number
          id: string
          total_score: number
          total_words: number
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          avg_score?: number | null
          best_game_score?: number | null
          created_at?: string
          games_played?: number
          games_won?: number
          id?: string
          total_score?: number
          total_words?: number
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          avg_score?: number | null
          best_game_score?: number | null
          created_at?: string
          games_played?: number
          games_won?: number
          id?: string
          total_score?: number
          total_words?: number
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      wheel_spins: {
        Row: {
          created_at: string
          date: string
          id: string
          reward_item: string | null
          reward_type: string
          reward_value: number
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          reward_item?: string | null
          reward_type: string
          reward_value?: number
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          reward_item?: string | null
          reward_type?: string
          reward_value?: number
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
      add_random_match_bot: { Args: { p_room_id: string }; Returns: string }
      admin_add_joker: {
        Args: { p_joker_type: string; p_quantity?: number; p_username: string }
        Returns: Json
      }
      advance_tournament_round:
        | { Args: { p_tournament_id: string }; Returns: Json }
        | {
            Args: { p_current_round: number; p_tournament_id: string }
            Returns: Json
          }
      apply_disconnect_penalty: {
        Args: { p_offender_id: string; p_room_id: string }
        Returns: {
          new_disconnect_count: number
          new_score: number
          penalty: number
          success: boolean
        }[]
      }
      apply_moderator_ban: {
        Args: {
          p_description: string
          p_duration_hours: number
          p_moderator_id: string
          p_reason: string
          p_user_id: string
        }
        Returns: Json
      }
      auto_set_users_offline: { Args: never; Returns: undefined }
      auto_start_countdown_finished_games: { Args: never; Returns: undefined }
      award_badge_with_notification: {
        Args: { p_badge_id: string; p_badge_name: string; p_user_id: string }
        Returns: undefined
      }
      award_disconnect_bonus: {
        Args: { p_bonus_points: number; p_user_id: string }
        Returns: undefined
      }
      award_kelime_avi_boost: { Args: never; Returns: Json }
      award_kelimele_badge: { Args: { p_user_id: string }; Returns: boolean }
      award_tournament_win_if_final: {
        Args: {
          p_final_match_id?: string
          p_tournament_id: string
          p_winner_id: string
        }
        Returns: boolean
      }
      ban_user_for_inappropriate_content: {
        Args: {
          p_ban_duration_hours?: number
          p_reason?: string
          p_user_id: string
        }
        Returns: undefined
      }
      calculate_average_word_length: {
        Args: { p_user_id: string }
        Returns: number
      }
      calculate_profile_stats: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      check_and_advance_tournament_round: {
        Args: { p_current_round: number; p_tournament_id: string }
        Returns: undefined
      }
      check_and_award_badges: { Args: { p_user_id: string }; Returns: Json[] }
      check_and_award_badges_simple: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      check_and_finish_expired_games: { Args: never; Returns: undefined }
      check_and_refresh_credits:
        | { Args: never; Returns: undefined }
        | { Args: { user_id: string }; Returns: undefined }
      check_memory_game_cooldown: {
        Args: { p_hours_ago: number; p_user_id: string }
        Returns: number
      }
      check_report_rate_limit: { Args: { p_user_id: string }; Returns: boolean }
      check_round_completion: {
        Args: { p_round: number; p_tournament_id: string }
        Returns: Json
      }
      check_tournament_progress: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      check_tournament_progress_v2: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      check_user_ban_status: {
        Args: { p_user_id: string }
        Returns: {
          ban_reason: string
          banned_until: string
          is_banned: boolean
          remaining_hours: number
        }[]
      }
      check_username_available: {
        Args: { p_username: string }
        Returns: string
      }
      check_words_per_game_badge: {
        Args: { p_user_id: string; p_words_count: number }
        Returns: Json[]
      }
      claim_premium_daily_jokers: { Args: { p_user_id: string }; Returns: Json }
      claim_score_boost: { Args: never; Returns: Json }
      cleanup_expired_bans: { Args: never; Returns: undefined }
      cleanup_expired_matchmaking_rooms: { Args: never; Returns: undefined }
      cleanup_expired_rematch_requests: { Args: never; Returns: undefined }
      cleanup_expired_rooms: { Args: never; Returns: undefined }
      cleanup_expired_tournaments: { Args: never; Returns: undefined }
      cleanup_old_messages: { Args: never; Returns: undefined }
      complete_tournament_match: {
        Args: {
          p_match_id: string
          p_player1_score: number
          p_player2_score: number
          p_winner_id: string
        }
        Returns: Json
      }
      complete_tournament_match_with_advance:
        | {
            Args: {
              p_match_id: string
              p_player1_score: number
              p_player2_score: number
              p_winner_id: string
            }
            Returns: Json
          }
        | {
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
        Returns: undefined
      }
      create_notification: {
        Args: {
          p_message: string
          p_related_id?: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      create_tournament_matches: {
        Args: { p_round: number; p_tournament_id: string }
        Returns: undefined
      }
      deduct_tournament_credits: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      delete_tournament_participant: {
        Args: { p_tournament_id: string; p_user_id: string }
        Returns: boolean
      }
      delete_user_account: { Args: never; Returns: undefined }
      determine_tournament_winner_with_tiebreaker: {
        Args: {
          p_match_id: string
          p_player1_id: string
          p_player1_score: number
          p_player2_id: string
          p_player2_score: number
        }
        Returns: string
      }
      ensure_bot_tournament_pool: { Args: never; Returns: Json }
      expire_stale_waiting_rooms: { Args: never; Returns: undefined }
      export_user_data: { Args: never; Returns: Json }
      finalize_tournament_score: {
        Args: { p_tournament_id: string; p_user_id: string }
        Returns: Json
      }
      find_or_create_random_room: {
        Args: { p_exclude?: string[]; p_game_type: string; p_grid: string[] }
        Returns: {
          current_grid: string[]
          host_id: string
          joined: boolean
          room_id: string
        }[]
      }
      generate_random_grid: { Args: never; Returns: Json }
      get_avatar_url: { Args: { user_id: string }; Returns: string }
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
      get_message_report_count: {
        Args: { p_message_id: string; p_message_type: string }
        Returns: number
      }
      get_monthly_leaderboard: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          games_played: number
          games_won: number
          monthly_score: number
          rank_change: number
          rank_position: number
          user_id: string
          username: string
        }[]
      }
      get_or_create_private_chat: {
        Args: { other_user_id: string }
        Returns: string
      }
      get_room_participants: {
        Args: { room_id: string }
        Returns: {
          created_at: string
          is_bot: boolean
          score: number
          user_id: string
        }[]
      }
      get_room_participants_with_profiles: {
        Args: { room_id: string }
        Returns: Json
      }
      get_season_leaderboard: {
        Args: { limit_count?: number; season_start_date?: string }
        Returns: {
          avatar_url: string
          games_played: number
          games_won: number
          rank_position: number
          season_score: number
          user_id: string
          username: string
        }[]
      }
      get_server_time: { Args: never; Returns: string }
      get_tournament_status: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      get_user_tournament_status: {
        Args: { p_tournament_id: string; p_user_id: string }
        Returns: Json
      }
      get_weekly_leaderboard: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          games_played: number
          games_won: number
          rank_change: number
          rank_position: number
          user_id: string
          username: string
          weekly_score: number
        }[]
      }
      give_tournament_champion_reward: {
        Args: { p_reward_amount?: number; p_user_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_monthly_score: {
        Args: { p_amount: number; p_month_start: string; p_user_id: string }
        Returns: undefined
      }
      increment_profile_score: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      increment_tournament_participants: {
        Args: { tournament_id: string }
        Returns: undefined
      }
      increment_tournament_players: {
        Args: { tournament_id: string }
        Returns: undefined
      }
      increment_weekly_score:
        | {
            Args: { p_amount: number; p_user_id: string; p_week_start: string }
            Returns: undefined
          }
        | {
            Args: { p_amount: number; p_user_id: string; p_week_start: string }
            Returns: undefined
          }
      join_tournament_replacing_bot: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      leave_tournament_with_transfer: {
        Args: { p_tournament_id: string; p_user_id: string }
        Returns: Json
      }
      moderate_and_insert_message: {
        Args: {
          p_avatar_url?: string
          p_message: string
          p_user_id: string
          p_username: string
        }
        Returns: Json
      }
      moderate_message_advanced: {
        Args: { p_message: string; p_user_id: string }
        Returns: {
          is_appropriate: boolean
          reason: string
          should_ban: boolean
        }[]
      }
      moderate_message_simple: {
        Args: { p_message: string; p_user_id: string }
        Returns: {
          is_appropriate: boolean
          reason: string
        }[]
      }
      notify_tournament_end: {
        Args: {
          p_tournament_id: string
          p_winner_id: string
          p_winner_name: string
        }
        Returns: undefined
      }
      recalculate_user_stats: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      remove_moderator_ban: {
        Args: { p_ban_id: string; p_moderator_id: string }
        Returns: Json
      }
      reset_daily_games: { Args: never; Returns: undefined }
      save_memory_game_play: {
        Args: { p_joker_given: string; p_moves: number; p_user_id: string }
        Returns: boolean
      }
      send_game_invite_notification: {
        Args: {
          p_receiver_id: string
          p_room_code: string
          p_sender_username: string
        }
        Returns: boolean
      }
      send_mention_notification:
        | {
            Args: {
              p_message: string
              p_message_id?: string
              p_receiver_id: string
              p_sender_username: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_message: string
              p_sender_username: string
              p_user_id: string
            }
            Returns: boolean
          }
      send_private_message_notification:
        | {
            Args: {
              p_chat_id: string
              p_recipient_id: string
              p_sender_username: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_chat_id: string
              p_sender_username: string
              p_user_id: string
            }
            Returns: boolean
          }
      start_game_countdown: { Args: { p_room_id: string }; Returns: string }
      start_tournament_automatically: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      start_tournament_countdown: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      start_tournament_structure: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      start_tournament_with_bots: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      start_tournament_with_bots_v2: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      start_tournament_with_bracket: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      submit_room_score: {
        Args: { p_room_id: string; p_score: number }
        Returns: {
          countdown_started_at: string | null
          created_at: string | null
          current_grid: string[] | null
          ends_at: string | null
          finished_at: string | null
          game_duration: number | null
          game_mode: string
          game_type_new: string | null
          host_id: string | null
          id: string
          max_players: number | null
          max_score: number | null
          player1_id: string | null
          player1_score: number | null
          player2_id: string | null
          player2_score: number | null
          room_code: string | null
          started_at: string | null
          status: string | null
          time_limit: number | null
          updated_at: string | null
          used_words: Json | null
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "game_rooms"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      test_game_completion: { Args: { p_user_id: string }; Returns: undefined }
      trigger_global_storage_clear: { Args: never; Returns: undefined }
      update_daily_leaderboard:
        | {
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
        | {
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
      update_daily_stats: {
        Args: {
          p_game_won?: boolean
          p_play_time?: number
          p_score?: number
          p_user_id: string
          p_words_count?: number
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
      update_game_stats: {
        Args: {
          p_first_word_time?: number
          p_game_duration?: number
          p_game_mode?: string
          p_is_winner: boolean
          p_play_time?: number
          p_score: number
          p_user_id: string
          p_words: Json
        }
        Returns: undefined
      }
      update_game_stats_vs_bot: {
        Args: {
          p_first_word_time?: number
          p_game_duration?: number
          p_is_winner: boolean
          p_score: number
          p_user_id: string
          p_words: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      report_reason:
        | "spam"
        | "harassment"
        | "inappropriate_content"
        | "hate_speech"
        | "violence"
        | "other"
      report_status: "pending" | "reviewed" | "resolved" | "dismissed"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
      report_reason: [
        "spam",
        "harassment",
        "inappropriate_content",
        "hate_speech",
        "violence",
        "other",
      ],
      report_status: ["pending", "reviewed", "resolved", "dismissed"],
    },
  },
} as const
