export interface Tournament {
  id: string;
  creator_id: string;
  status: 'waiting' | 'in_progress' | 'completed' | 'cancelled';
  max_players: number;
  current_players: number;
  winner_id?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
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
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
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
