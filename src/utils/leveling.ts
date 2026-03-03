// src/utils/leveling.ts
import { supabase } from "../supabase";

export const LEVEL_THRESHOLDS = [0, 200, 500, 1000, 1800, 3000, 4500, 6500, 9000, 12000];

export function getLevel(points: number): number {
  let lvl = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (points >= LEVEL_THRESHOLDS[i]) {
      lvl = i + 1;
    }
  }
  return lvl;
}

export function getTitle(level: number): string {
  if (level <= 2) return "Rookie 🟢";
  if (level <= 4) return "Challenger 🔥";
  if (level <= 7) return "Warrior 🐯";
  if (level <= 9) return "Master 💎";
  return "Immortal 👑";
}

export async function addPoints(userId: string, gain: number) {
  const { data, error } = await supabase
    .from("players_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  let points = data?.points || 0;
  points += gain;
  const level = getLevel(points);
  const title = getTitle(level);

  await supabase.from("players_stats").upsert({
    user_id: userId,
    points,
    level,
    title, // 🔥 on met à jour automatiquement
  });

  return { points, level, title };
}