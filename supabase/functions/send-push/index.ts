import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const payload = await req.json().catch(() => ({}));
  const { user_id, title, body, data } = payload;

  if (!user_id || !title || !body) {
    return json({ error: "user_id, title et body sont requis" }, 400);
  }

  const { data: tokenRow } = await admin
    .from("push_tokens")
    .select("token")
    .eq("user_id", user_id)
    .maybeSingle();

  if (!tokenRow?.token) {
    return json({ ok: false, reason: "no_token" });
  }

  const message = {
    to: tokenRow.token,
    sound: "default",
    title,
    body,
    data: data ?? {},
  };

  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(message),
  });

  const result = await res.json();
  return json({ ok: true, expo: result });
});
