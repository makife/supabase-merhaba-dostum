export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
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
          host_id: string | null
          id: string
          max_score: number | null
          room_code: string | null
          started_at: string | null
          status: string | null
          time_limit: number | null
        }
        Insert: {
          created_at?: string | null
          current_grid?: string[] | null
          finished_at?: string | null
          game_mode: string
          host_id?: string | null
          id?: string
          max_score?: number | null
          room_code?: string | null
          started_at?: string | null
          status?: string | null
          time_limit?: number | null
        }
        Update: {
          created_at?: string | null
          current_grid?: string[] | null
          finished_at?: string | null
          game_mode?: string
          host_id?: string | null
          id?: string
          max_score?: number | null
          room_code?: string | null
          started_at?: string | null
          status?: string | null
          time_limit?: number | null
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
      profiles: {
        Row: {
          avatar_url: string | null
          bonus_credits: number | null
          created_at: string | null
          email: string
          game_credits: number | null
          hint_credits: number | null
          id: string
          last_credit_refresh: string | null
          losses: number | null
          premium_until: string | null
          total_games: number | null
          total_score: number | null
          updated_at: string | null
          username: string | null
          wins: number | null
        }
        Insert: {
          avatar_url?: string | null
          bonus_credits?: number | null
          created_at?: string | null
          email: string
          game_credits?: number | null
          hint_credits?: number | null
          id: string
          last_credit_refresh?: string | null
          losses?: number | null
          premium_until?: string | null
          total_games?: number | null
          total_score?: number | null
          updated_at?: string | null
          username?: string | null
          wins?: number | null
        }
        Update: {
          avatar_url?: string | null
          bonus_credits?: number | null
          created_at?: string | null
          email?: string
          game_credits?: number | null
          hint_credits?: number | null
          id?: string
          last_credit_refresh?: string | null
          losses?: number | null
          premium_until?: string | null
          total_games?: number | null
          total_score?: number | null
          updated_at?: string | null
          username?: string | null
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
          active_sound_pack: string | null
          active_theme: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_avatar_frame?: string | null
          active_sound_pack?: string | null
          active_theme?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_avatar_frame?: string | null
          active_sound_pack?: string | null
          active_theme?: string | null
          created_at?: string
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
      check_and_refresh_credits: {
        Args: { user_id: string }
        Returns: undefined
      }
      cleanup_expired_tournaments: {
        Args: Record<PropertyKey, never>
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
