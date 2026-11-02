// Ouvre le portail client Stripe (gérer le moyen de paiement, résilier) pour le joueur connecté dont un client Stripe est connu.
// Déployer : supabase functions deploy customer-portal   (JWT vérifié par la plateforme ; on revérifie ici)
// Secrets : STRIPE_SECRET_KEY, WEB_BASE_URL (https://...). Le portail doit être activé dans le dashboard Stripe (voir docs/PRO_SETUP.md).
// STRIPE_API_BASE : réservé aux essais locaux (faux Stripe).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPortalSession } from "../_shared/billing.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "not_authenticated" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: who, error: whoError } = await asUser.auth.getUser();
  if (whoError || !who.user) return json({ error: "not_authenticated" }, 401);
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const result = await createPortalSession(
    { userId: who.user.id },
    {
      config: {
        secretKey: Deno.env.get("STRIPE_SECRET_KEY") ?? "",
        priceMonthly: "",
        priceAnnual: "",
        webBaseUrl: Deno.env.get("WEB_BASE_URL") ?? "",
        apiBase: Deno.env.get("STRIPE_API_BASE") || undefined,
      },
      fetch: (input, init) => fetch(input, init),
      log: (entry) => console.error(JSON.stringify({ ...entry, fn: "customer-portal" })),
      async findCustomerId(userId) {
        const { data, error } = await service
          .from("payment_events")
          .select("payload")
          .eq("source", "stripe")
          .eq("user_id", userId)
          .order("received_at", { ascending: false })
          .limit(5);
        if (error) throw new Error(error.message);
        for (const row of data ?? []) {
          const customer = (row.payload as any)?.data?.object?.customer;
          if (typeof customer === "string") return customer;
        }
        return null;
      },
    }
  ).catch((error: Error) => {
    console.error(JSON.stringify({ fn: "customer-portal", status: "exception", message: error.message }));
    return { ok: false as const, status: 500, error: "stripe_error" as const };
  });

  return result.ok ? json({ url: result.url }) : json({ error: result.error }, result.status);
});
