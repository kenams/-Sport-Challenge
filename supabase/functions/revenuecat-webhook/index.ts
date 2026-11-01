// Récepteur des événements RevenueCat : attribue ou retire les droits Pro dans la base.
// Sécurité : secret partagé obligatoire (REVENUECAT_WEBHOOK_AUTH). Idempotent et tolérant au désordre (voir apply_entitlement_event).
// À déployer avec : supabase functions deploy revenuecat-webhook --no-verify-jwt
// Variables : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (fournies par Supabase), REVENUECAT_WEBHOOK_AUTH, REVENUECAT_ALLOW_SANDBOX ("true" pour les tests d'achat).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mapRevenueCatEvent } from "../_shared/revenuecat.ts";

function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const expected = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
  if (!expected) return new Response("Webhook non configuré", { status: 503 });
  const provided = request.headers.get("authorization") ?? "";
  if (!safeEqual(provided, expected) && !safeEqual(provided, `Bearer ${expected}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: { event?: unknown };
  try {
    payload = await request.json();
  } catch {
    return new Response("Corps invalide", { status: 400 });
  }

  const result = mapRevenueCatEvent(payload.event as never, Deno.env.get("REVENUECAT_ALLOW_SANDBOX") === "true");
  if (result.kind === "ignore") {
    // 200 : RevenueCat ne doit pas relancer un événement volontairement ignoré.
    return Response.json({ ok: true, ignored: result.reason });
  }

  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const u = result.update;
  const { data, error } = await client.rpc("apply_entitlement_event", {
    p_event_id: u.eventId,
    p_source: u.source,
    p_user_id: u.userId,
    p_type: u.type,
    p_event_time: u.eventTime,
    p_plan: u.plan,
    p_status: u.status,
    p_product_id: u.productId,
    p_period_end: u.periodEnd,
    p_payload: payload,
  });

  if (error) {
    console.error(JSON.stringify({ source: "revenuecat-webhook", status: "error", message: error.message }));
    return new Response("Erreur de traitement", { status: 500 }); // RevenueCat réessaie
  }
  return Response.json({ ok: true, outcome: data });
});
