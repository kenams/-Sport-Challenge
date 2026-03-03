export type GenderValue = "male" | "female" | "other";

export interface Challenge {
  id: number;
  user_id: string;
  pseudo?: string | null;
  avatar_url?: string | null;
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
  ai_status?: "ok" | "flagged" | "skipped" | "error" | "validated" | "rejected" | null;
  ai_score?: number | null;
  ai_duration?: number | null;
  ai_reason?: string | null;
  ai_needs_review?: boolean | null;
  proof_hint?: string | null;
}

export interface ChallengeResponse {
  id: number;
  challenge_id: number;
  user_id: string;
  pseudo?: string | null;
  avatar_url?: string | null;
  video_url: string;
  created_at: string;
  votes?: number;
  is_winner?: boolean;
  ai_status?: "ok" | "flagged" | "skipped" | "error" | "validated" | "rejected" | null;
  ai_score?: number | null;
  ai_duration?: number | null;
  ai_reason?: string | null;
  ai_needs_review?: boolean | null;
}

export interface Wallet {
  user_id: string;
  coins: number;
}

export interface PlayerStats {
  user_id: string;
  level: number;
  points: number;
  title?: string;
  fair_play_score?: number | null;
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

export interface UserProfile {
  user_id: string;
  pseudo?: string | null;
  avatar_url?: string | null;
  gender?: GenderValue | null;
  allow_mixed?: boolean | null;
  department?: string | null;
  allow_inter_department?: boolean | null;
}