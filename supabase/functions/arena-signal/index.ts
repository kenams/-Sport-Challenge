import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Missing Supabase env vars in arena-signal function.");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const FAIR_PLAY_THRESHOLD = 60;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getSegments = (url: string) => {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  const index = parts.indexOf("arena-signal");
  if (index >= 0) {
    return parts.slice(index + 1);
  }
  return parts;
};

async function getUser(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error) return null;
  return data.user;
}

async function ensureFairPlay(userId: string) {
  const { data } = await supabaseAdmin
    .from("players_stats")
    .select("fair_play_score")
    .eq("user_id", userId)
    .maybeSingle();
  const score = (data as any)?.fair_play_score ?? 100;
  return score >= FAIR_PLAY_THRESHOLD;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const segments = getSegments(req.url);
  if (segments.length === 0 || segments[0] !== "rooms") {
    return json({ error: "Not found" }, 404);
  }

  const user = await getUser(req);
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!(await ensureFairPlay(user.id))) {
    return json({ error: "FAIR_PLAY_LOCKED" }, 403);
  }

  if (segments.length === 1) {
    const payload = await req.json().catch(() => ({}));
    const challengeId = payload.challenge_id;
    const stake = Number(payload.stake ?? 0);

    if (!challengeId) {
      return json({ error: "challenge_id required" }, 400);
    }

    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("challenges")
      .select("id,min_level,level_required")
      .eq("id", challengeId)
      .maybeSingle();

    if (challengeError || !challenge) {
      return json({ error: "Challenge not found" }, 404);
    }

    const levelRequired =
      (challenge as any).min_level ??
      (challenge as any).level_required ??
      1;

    const { data: room, error } = await supabaseAdmin
      .from("arena_rooms")
      .insert({
        challenge_id: challengeId,
        host_id: user.id,
        stake,
        level_required: levelRequired,
      })
      .select("*")
      .single();

    if (error || !room) {
      return json({ error: error?.message || "Room creation failed" }, 400);
    }

    return json(room);
  }

  if (segments.length === 3 && segments[2] === "join") {
    const roomId = segments[1];
    const { data: room, error } = await supabaseAdmin
      .from("arena_rooms")
      .select("*")
      .eq("id", roomId)
      .maybeSingle();

    if (error || !room) {
      return json({ error: "Room not found" }, 404);
    }

    if ((room as any).status !== "waiting") {
      return json({ error: "Room not available" }, 409);
    }

    if ((room as any).guest_id && (room as any).guest_id !== user.id) {
      return json({ error: "Room full" }, 409);
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("arena_rooms")
      .update({
        guest_id: user.id,
        status: "live",
        started_at: new Date().toISOString(),
      })
      .eq("id", roomId)
      .select("*")
      .single();

    if (updateError || !updated) {
      return json({ error: updateError?.message || "Join failed" }, 400);
    }

    return json(updated);
  }

  if (segments.length === 3 && segments[2] === "signal") {
    const roomId = segments[1];
    const payload = await req.json().catch(() => ({}));
    const type = payload.type;
    const dataPayload = payload.payload ?? {};
    const target = dataPayload.target ?? "all";

    if (!type) {
      return json({ error: "type required" }, 400);
    }

    const { error } = await supabaseAdmin.from("arena_signals").insert({
      room_id: roomId,
      sender_id: user.id,
      target,
      type,
      payload: dataPayload,
    });

    if (error) {
      return json({ error: error.message }, 400);
    }

    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
});
