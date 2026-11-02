// Récepteur des événements Stripe (web) : attribue ou retire les droits Pro dans la base via apply_entitlement_event.
// Sécurité : signature Stripe vérifiée (HMAC-SHA256, tolérance 5 min), idempotence par identifiant d'événement (côté base).
// Déployer : supabase functions deploy stripe-webhook --no-verify-jwt   (Stripe n'envoie pas de jeton Supabase)
// Secrets (supabase secrets set, jamais dans le dépôt) : STRIPE_WEBHOOK_SECRET (whsec_..., plusieurs séparés par une virgule pendant une rotation),
// STRIPE_ALLOW_TEST_MODE ("true" uniquement pour les essais en mode test). SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleStripeWebhook } from "../_shared/stripe.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const rawBody = await request.text(); // corps BRUT : la signature porte sur ces octets exacts

  const result = await handleStripeWebhook(rawBody, request.headers.get("stripe-signature"), {
    secrets: (Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "").split(",").map((s) => s.trim()),
    allowTestMode: Deno.env.get("STRIPE_ALLOW_TEST_MODE") === "true",
    async findUserByCustomer(customerId) {
      const { data, error } = await client
        .from("payment_events")
        .select("user_id")
        .eq("source", "stripe")
        .not("user_id", "is", null)
        .eq("payload->data->object->>customer", customerId)
        .order("received_at", { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      return (data?.[0]?.user_id as string | undefined) ?? null;
    },
    async applyEvent(update, rawEvent) {
      const { data, error } = await client.rpc("apply_entitlement_event", {
        p_event_id: update.eventId,
        p_source: update.source,
        p_user_id: update.userId,
        p_type: update.type,
        p_event_time: update.eventTime,
        p_plan: update.plan,
        p_status: update.status,
        p_product_id: update.productId,
        p_period_end: update.periodEnd,
        p_payload: rawEvent,
      });
      if (error) {
        console.error(JSON.stringify({ source: "stripe-webhook", status: "error", message: error.message }));
        throw new Error(error.message);
      }
      return data as string;
    },
  });

  if (result.status >= 400) console.error(JSON.stringify({ source: "stripe-webhook", status: result.status, body: result.body }));
  return new Response(JSON.stringify(result.body), { status: result.status, headers: { "Content-Type": "application/json" } });
});
