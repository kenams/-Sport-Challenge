import { supabase } from "../../supabase";
import type { DuelEvent } from "../../domain/types";

export type PlayerInfo = { id: string; pseudo: string | null; city: string | null; region?: string | null; country?: string | null };

/** Lecture des profils (pseudo + ville déclarés) des joueurs. Échec silencieux : on affiche "Joueur". */
export async function loadPlayers(events: Pick<DuelEvent, "player_a" | "player_b">[]): Promise<Record<string, PlayerInfo>> {
  const ids = Array.from(new Set(events.flatMap((e) => [e.player_a, e.player_b])));
  if (ids.length === 0) return {};
  try {
    const { data } = await supabase.from("profiles").select("user_id,pseudo,city,region,country").in("user_id", ids);
    const map: Record<string, PlayerInfo> = {};
    for (const row of (data ?? []) as Array<{ user_id: string; pseudo: string | null; city: string | null; region: string | null; country: string | null }>) {
      map[row.user_id] = { id: row.user_id, pseudo: row.pseudo, city: row.city, region: row.region, country: row.country };
    }
    return map;
  } catch {
    return {};
  }
}

export function playerName(p: { pseudo: string | null } | undefined): string {
  return p?.pseudo?.trim() || "Joueur";
}

export function playerTerritory(p: { city: string | null; country?: string | null } | undefined): string {
  return p?.city?.trim() || p?.country?.trim() || "";
}
