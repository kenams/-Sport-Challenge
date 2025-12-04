// src/utils/playerStats.ts
import { supabase } from "../supabase";

const DEFAULT_FAIR_PLAY_SCORE = 100;

export async function ensurePlayerStats(userId: string) {
  if (!userId) return;

  const { data, error } = await supabase
    .from("players_stats")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (data || error) {
    // if row exists or error occurred, stop here
    return;
  }

  await supabase.from("players_stats").insert({
    user_id: userId,
    points: 0,
    fair_play_score: DEFAULT_FAIR_PLAY_SCORE,
  });
}
