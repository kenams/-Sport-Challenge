import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import { AccessToken } from "npm:livekit-server-sdk@2.19.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, "Content-Type": "application/json" },
});

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const liveKitUrl = Deno.env.get("LIVEKIT_URL") ?? "";
  const liveKitKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
  const liveKitSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
  if (!supabaseUrl || !anonKey || !liveKitUrl || !liveKitKey || !liveKitSecret) {
    return json({ error: "live_video_not_configured" }, 503);
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "not_authenticated" }, 401);
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return json({ error: "not_authenticated" }, 401);

  const body = await request.json().catch(() => null) as { event_id?: unknown } | null;
  const eventId = typeof body?.event_id === "string" ? body.event_id : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) {
    return json({ error: "invalid_event_id" }, 400);
  }

  const [{ data: event, error: eventError }, { data: moderator }] = await Promise.all([
    supabase.from("duel_events").select("id,status,player_a,player_b").eq("id", eventId).maybeSingle(),
    supabase.rpc("is_moderator"),
  ]);
  if (eventError || !event || !["scheduled", "live"].includes(event.status)) return json({ error: "live_event_not_found" }, 404);

  const participant = user.id === event.player_a || user.id === event.player_b;
  const isModerator = moderator === true;
  if (event.status === "scheduled" && !participant) return json({ error: "live_event_not_started" }, 409);

  const token = new AccessToken(liveKitKey, liveKitSecret, {
    identity: user.id,
    ttl: "2h",
    metadata: JSON.stringify({ event_id: eventId, role: participant ? "player" : isModerator ? "moderator" : "spectator" }),
  });
  token.addGrant({
    roomJoin: true,
    room: `immortal-duel-${eventId}`,
    canPublish: participant,
    canSubscribe: true,
    canPublishData: !isModerator,
  });

  return json({ server_url: liveKitUrl, participant_token: await token.toJwt() });
});
