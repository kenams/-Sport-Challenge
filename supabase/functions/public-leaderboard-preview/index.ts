import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Missing Supabase env vars in public-leaderboard-preview function.");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 5), 10);
  const daysParam = Number(url.searchParams.get("days") ?? 0);
  const days = Number.isNaN(daysParam) ? 0 : Math.max(0, Math.min(daysParam, 365));
  const cutoff = days > 0
    ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data: statsRows } = await supabaseAdmin
    .from("players_stats")
    .select("user_id,points,level,title")
    .order("points", { ascending: false })
    .limit(200);

  let activeIds: Set<string> | null = null;
  if (cutoff) {
    const { data: activityRows } = await supabaseAdmin
      .from("activities")
      .select("user_id")
      .gte("created_at", cutoff)
      .limit(800);
    activeIds = new Set((activityRows ?? []).map((row: any) => row.user_id));
  }

  let statsList = (statsRows ?? []) as any[];
  if (activeIds) {
    statsList = statsList.filter((row) => activeIds?.has(row.user_id));
  }

  const playerIds = statsList.slice(0, 100).map((row) => row.user_id);
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("user_id,pseudo,department")
    .in("user_id", playerIds);
  const profileMap = new Map<string, any>();
  (profiles ?? []).forEach((row: any) => profileMap.set(row.user_id, row));

  const players = statsList.slice(0, limit).map((row: any) => {
    const profile = profileMap.get(row.user_id);
    return {
      user_id: row.user_id,
      pseudo: profile?.pseudo || `Joueur ${row.user_id.slice(0, 6)}`,
      department: profile?.department || null,
      points: row.points ?? 0,
      level: row.level ?? 1,
      title: row.title || null,
    };
  });

  let challengesQuery = supabaseAdmin
    .from("challenges")
    .select("id,user_id,title,sport,bet_amount,created_at,ai_status")
    .or("ai_status.is.null,ai_status.neq.rejected")
    .order("created_at", { ascending: false })
    .limit(200);
  if (cutoff) {
    challengesQuery = challengesQuery.gte("created_at", cutoff);
  }
  const { data: challengeRows } = await challengesQuery;
  const challengeUserIds = Array.from(
    new Set((challengeRows ?? []).map((row: any) => row.user_id))
  );
  const { data: challengeProfiles } = await supabaseAdmin
    .from("profiles")
    .select("user_id,pseudo,department")
    .in("user_id", challengeUserIds);
  const challengeProfileMap = new Map<string, any>();
  (challengeProfiles ?? []).forEach((row: any) =>
    challengeProfileMap.set(row.user_id, row)
  );

  const territoryCount: Record<string, number> = {};
  (challengeRows ?? []).forEach((row: any) => {
    const dep = challengeProfileMap.get(row.user_id)?.department;
    if (!dep) return;
    territoryCount[dep] = (territoryCount[dep] || 0) + 1;
  });

  const leaderMap: Record<string, { user_id: string; pseudo: string; points: number }> = {};
  statsList.forEach((row: any) => {
    const dep = profileMap.get(row.user_id)?.department;
    if (!dep) return;
    const existing = leaderMap[dep];
    if (!existing || (row.points ?? 0) > existing.points) {
      leaderMap[dep] = {
        user_id: row.user_id,
        pseudo: profileMap.get(row.user_id)?.pseudo || `Joueur ${row.user_id.slice(0, 6)}`,
        points: row.points ?? 0,
      };
    }
  });

  const territories = Object.entries(territoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([code, count]) => ({
      code,
      count,
      leader: leaderMap[code] || null,
    }));

  const challenges = (challengeRows ?? []).slice(0, limit).map((row: any) => {
    const profile = challengeProfileMap.get(row.user_id);
    return {
      id: row.id,
      title: row.title,
      sport: row.sport,
      bet: row.bet_amount ?? 0,
      created_at: row.created_at,
      owner_pseudo: profile?.pseudo || `Joueur ${row.user_id.slice(0, 6)}`,
      territory: profile?.department || null,
    };
  });

  return json({
    days,
    players,
    territories,
    challenges,
  });
});
