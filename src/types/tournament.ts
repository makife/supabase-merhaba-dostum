export interface Tournament {
  id: string;
  creator_id?: string;
  name: string;
  status: "waiting" | "in_progress" | "completed" | "cancelled";
  game_type: string;
  max_participants: number;
  current_round: number;
  timeout_duration: number;
  created_at: string;
  started_at?: string;
  updated_at: string;
  expires_at?: string;
  finished_at?: string;

  next_round_starts_at?: string | null;
  is_bot_tournament?: boolean;
  is_private?: boolean;
  avatar_url?: string | null;
  // Eski isimler için alias
  max_players?: number;
  current_players?: number;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string;
  is_bot: boolean;
  joined_at: string;
  profiles?: {
    username: string;
    avatar_url: string;
  };
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string;
  player2_id: string;
  player1_score: number;
  player2_score: number;
  winner_id?: string;
  status: "pending" | "in_progress" | "completed";
  created_at: string;
  updated_at: string;
  countdown_started_at?: string;
  ends_at?: string;
  started_at?: string;
  player1?: {
    username: string;
    avatar_url: string;
    is_bot: boolean;
  };
  player2?: {
    username: string;
    avatar_url: string;
    is_bot: boolean;
  };
}
