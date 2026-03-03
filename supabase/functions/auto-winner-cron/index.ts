import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Missing Supabase env vars in auto-winner-cron function.");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type WinnerResult = {
  challenge_id: number;
  ok: boolean;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (CRON_SECRET) {
    const secret = req.headers.get("x-cron-secret") || "";
    if (secret !== CRON_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }
  }

  const body = await req.json().catch(() => ({}));
  const hours = Number(body.hours ?? 24);
  const maxChallenges = Number(body.max_challenges ?? 30);

  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const results: WinnerResult[] = [];
  let scanned = 0;

  const { data: challenges, error: chError } = await supabaseAdmin
    .from("challenges")
    .select("id,created_at")
    .lte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(maxChallenges);

  if (chError) {
    console.log("AUTO WINNER CHALLENGES ERROR", chError);
    return json({ error: "failed_to_load_challenges" }, 500);
  }

  for (const challenge of challenges ?? []) {
    scanned += 1;
    const { error: finalizeError } = await supabaseAdmin.rpc(
      "finalize_challenge_votes",
      { p_challenge_id: challenge.id }
    );

    if (finalizeError) {
      console.log("AUTO WINNER FINALIZE ERROR", finalizeError);
      results.push({ challenge_id: challenge.id, ok: false });
      continue;
    }

    results.push({ challenge_id: challenge.id, ok: true });
  }

  return json({
    ok: true,
    cutoff,
    scanned,
    winners: results,
  });
});
