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
  console.warn("Missing Supabase env vars in public-top-votes function.");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 10), 50);
  const days = Math.min(Number(url.searchParams.get("days") ?? 30), 120);
  const challengeId = Number(url.searchParams.get("challenge_id") ?? 0);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let responseQuery = supabaseAdmin
    .from("challenge_responses")
    .select("id,challenge_id,user_id,video_url,created_at,ai_status")
    .gte("created_at", cutoff)
    .or("ai_status.is.null,ai_status.neq.rejected")
    .order("created_at", { ascending: false })
    .limit(200);

  if (challengeId) {
    responseQuery = responseQuery.eq("challenge_id", challengeId);
  }

  const { data: responses, error: respError } = await responseQuery;
  if (respError) {
    console.log("PUBLIC TOP VOTES RESPONSES ERROR", respError);
    return json({ error: "failed_to_load_responses" }, 500);
  }

  const responseIds = (responses ?? []).map((row: any) => row.id);
  const voteCounts = new Map<number, number>();

  if (responseIds.length > 0) {
    const { data: voteRows } = await supabaseAdmin
      .from("challenge_response_votes")
      .select("response_id")
      .in("response_id", responseIds);
    (voteRows ?? []).forEach((row: any) => {
      const current = voteCounts.get(row.response_id) || 0;
      voteCounts.set(row.response_id, current + 1);
    });
  }

  const challengeIds = Array.from(
    new Set((responses ?? []).map((row: any) => row.challenge_id))
  );
  const { data: challenges } = await supabaseAdmin
    .from("challenges")
    .select("id,title,sport,created_at")
    .in("id", challengeIds);

  const challengeMap = new Map<number, any>();
  (challenges ?? []).forEach((row: any) => {
    challengeMap.set(row.id, row);
  });

  const userIds = Array.from(
    new Set((responses ?? []).map((row: any) => row.user_id))
  );
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("user_id,pseudo")
    .in("user_id", userIds);
  const profileMap = new Map<string, string>();
  (profiles ?? []).forEach((row: any) => {
    profileMap.set(row.user_id, row.pseudo || "");
  });

  const sorted = (responses ?? []).sort((a: any, b: any) => {
    const av = voteCounts.get(a.id) || 0;
    const bv = voteCounts.get(b.id) || 0;
    if (bv !== av) return bv - av;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const items = sorted.slice(0, limit).map((row: any) => {
    const challenge = challengeMap.get(row.challenge_id);
    return {
      response_id: row.id,
      challenge_id: row.challenge_id,
      votes: voteCounts.get(row.id) || 0,
      video_url: row.video_url,
      created_at: row.created_at,
      responder_pseudo: profileMap.get(row.user_id) || "Joueur",
      challenge_title: challenge?.title || "Defi",
      sport: challenge?.sport || "",
    };
  });

  return json({
    items,
    cutoff,
    days,
    limit,
  });
});
