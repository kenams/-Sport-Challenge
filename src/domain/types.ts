// Types du domaine IMMORTAL (pompes et tractions). Les données viennent du serveur : le client n'invente rien.

export type DisciplineKey = "pushups" | "pullups";
export type FormatKey = "pushups_60s" | "pullups_max";

export type AttemptStatus = "pending" | "validated" | "rejected" | "withdrawn";
export type AttemptKind = "challenge" | "response" | "solo";

export interface ChallengeFormat {
  key: FormatKey;
  discipline: DisciplineKey;
  label_fr: string;
  description_fr: string;
  duration_seconds: number | null;
  rules_version: number;
  rules_fr: string;
  framing_fr: string;
  success_fr: string;
  max_score: number;
  max_video_seconds: number;
}

export interface Attempt {
  id: string;
  user_id: string;
  kind: AttemptKind;
  challenge_id: string | null;
  recipient_user_id: string | null;
  title: string | null;
  format_key: FormatKey;
  discipline: DisciplineKey;
  rules_version: number;
  declared_score: number;
  video_path: string;
  video_duration_seconds: number | null;
  video_removed: boolean;
  status: AttemptStatus;
  decided_score: number | null;
  decision_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  city_declared: string | null;
  region_declared: string | null;
  country_declared: string | null;
  report_count: number;
  created_at: string;
  pseudo?: string | null;
  avatar_url?: string | null;
}

export type TerritoryScope = "world" | "country" | "region" | "city";

export interface LeaderboardRow {
  rank: number;
  user_id: string;
  pseudo: string | null;
  best_score: number;
  attempt_id: string;
  achieved_at: string;
  city: string | null;
  region: string | null;
  country: string | null;
}

export interface MyProfile {
  user_id: string;
  pseudo: string | null;
  avatar_url: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  locale: string | null;
  card_theme: string | null;
}

export interface MyStats {
  points: number;
  level: number;
  validated_count: number;
}

/** Données de santé et de démographie privées : jamais incluses dans les vues publiques. */
export interface MyPrivateProfile {
  birth_date: string | null;
  gender: "male" | "female" | "other" | "prefer_not_to_say" | null;
  height_cm: number | null;
  weight_kg: number | null;
}

export type EventStatus = "proposed" | "accepted" | "scheduled" | "live" | "finished" | "cancelled" | "expired";

export interface DuelEvent {
  id: string;
  slug: string;
  format_key: FormatKey;
  discipline: DisciplineKey;
  player_a: string;
  player_b: string;
  scheduled_at: string | null;
  timezone: string;
  status: EventStatus;
  accepted_by_a: boolean;
  accepted_by_b: boolean;
  proposal_expires_at?: string | null;
  proposed_slots?: string[];
  is_matchmade?: boolean;
  created_at: string;
}

export interface PublicEvent {
  slug: string;
  status: EventStatus;
  scheduled_at: string | null;
  timezone: string;
  discipline: string;
  format: string;
  player_a: { id: string; pseudo: string | null; city: string | null; region: string | null; country: string | null };
  player_b: { id: string; pseudo: string | null; city: string | null; region: string | null; country: string | null };
  supporters_a: number;
  supporters_b: number;
  result: { score_a: number; score_b: number } | null;
}

export interface Entitlement {
  plan: "free" | "pro";
  status: "none" | "active" | "billing_issue" | "cancelled_pending" | "expired" | "refunded";
  current_period_end: string | null;
  source: string | null;
}

export interface ModerationQueueItem extends Attempt {
  open_reports: number;
}
