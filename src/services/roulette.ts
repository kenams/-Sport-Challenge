// src/services/roulette.ts
import { supabase } from "../supabase";
import { RouletteDuel } from "../types";
import { fetchProfilesMap } from "./profile";

export async function fetchRouletteAssignments(userId: string) {
  if (!userId) {
    return { duels: [] as RouletteDuel[], profilesMap: new Map() };
  }
  const { data, error } = await supabase
    .from("roulette_duels")
    .select("*")
    .or(`player_a.eq.${userId},player_b.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.log("ROULETTE FETCH ERROR", error);
    return { duels: [], profilesMap: new Map() };
  }

  const duels = (data as RouletteDuel[]) || [];
  const opponentIds = Array.from(
    duels.reduce((set, duel) => {
      set.add(duel.player_a);
      set.add(duel.player_b);
      return set;
    }, new Set<string>())
  );
  const profilesMap = await fetchProfilesMap(opponentIds);
  return { duels, profilesMap };
}
