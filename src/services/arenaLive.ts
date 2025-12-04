// src/services/arenaLive.ts
import { supabase } from "../supabase";

const SIGNAL_BASE_URL =
  process.env.EXPO_PUBLIC_ARENA_SIGNAL_URL || "https://arena-signal.local";
export const ARENA_FAIR_PLAY_THRESHOLD = 60;

export type ArenaRoom = {
  id: string;
  challenge_id: number;
  status: "waiting" | "live" | "finished" | "canceled";
  stake: number;
  level_required: number;
  host_id: string;
  guest_id?: string | null;
};

type CreateRoomPayload = {
  challengeId: number;
  stake: number;
};

export async function createArenaRoom(payload: CreateRoomPayload) {
  await ensureFairPlayAccess();
  const token = await getAuthToken();
  const res = await fetch(`${SIGNAL_BASE_URL}/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      challenge_id: payload.challengeId,
      stake: payload.stake,
    }),
  });

  if (!res.ok) {
    throw new Error("Impossible de creer la salle live");
  }

  return (await res.json()) as ArenaRoom;
}

export async function joinArenaRoom(roomId: string) {
  await ensureFairPlayAccess();
  const token = await getAuthToken();
  const res = await fetch(`${SIGNAL_BASE_URL}/rooms/${roomId}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Impossible de rejoindre la salle");
  }

  return (await res.json()) as ArenaRoom;
}

export async function sendSignal(
  roomId: string,
  type: "offer" | "answer" | "candidate" | "data",
  payload: any
) {
  const token = await getAuthToken();
  await fetch(`${SIGNAL_BASE_URL}/rooms/${roomId}/signal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type, payload }),
  });
}

async function getAuthToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Session invalide");
  return token;
}

async function ensureFairPlayAccess() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) {
    throw new Error("Session invalide");
  }
  const { data: stats } = await supabase
    .from("players_stats")
    .select("fair_play_score")
    .eq("user_id", user.id)
    .maybeSingle();
  const score = (stats as any)?.fair_play_score ?? 100;
  if (score < ARENA_FAIR_PLAY_THRESHOLD) {
    const error = new Error("FAIR_PLAY_LOCKED");
    (error as any).code = "FAIR_PLAY_LOCKED";
    throw error;
  }
}
