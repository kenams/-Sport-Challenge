// src/types.ts
export interface Challenge {
  id: number;
  user_id: string;
  title: string;
  description: string;
  sport: string;
  target_value: number;
  unit: string;
  video_url: string;
  created_at: string;
  bet_enabled?: boolean;
  bet_amount?: number;
  min_level?: number;
  level_required?: number;
  ranked?: boolean;
}

export interface ChallengeResponse {
  id: number;
  challenge_id: number;
  user_id: string;
  video_url: string;
  created_at: string;
  votes?: number;
  is_winner?: boolean;
}

export interface Wallet {
  user_id: string;
  coins: number;
}

export interface PlayerStats {
  user_id: string;
  level: number;
  points: number;
  title?: string; // < 🔥 ajouté ici
}

export interface Battle {
  id: number;
  challenge_id: number;
  player1_id: string;
  player2_id: string;
  amount: number;
  commission: number;
  winner_id?: string;
  loser_id?: string;
  completed?: boolean;
  created_at?: string;
}
