// Sessions de paiement Stripe (web) : Checkout (abonnement) et portail client. Logique pure, fetch injecté, sans dépendance Deno.
// Testée par Jest (src/__tests__/billing.test.ts). La clé secrète Stripe ne sort jamais de `config` : elle n'est ni journalisée ni renvoyée.
// Les identifiants de prix viennent UNIQUEMENT de l'environnement du serveur ; le client n'envoie qu'un nom de plan (liste blanche).

export const PLANS = ["monthly", "annual"] as const;
export type Plan = (typeof PLANS)[number];

export type BillingConfig = {
  secretKey: string;
  priceMonthly: string;
  priceAnnual: string;
  webBaseUrl: string;
  /** Base de l'API Stripe ; défaut https://api.stripe.com. Injectable pour les tests locaux (faux Stripe). */
  apiBase?: string;
};

export type BillingDeps = {
  config: BillingConfig;
  fetch: typeof fetch;
  /** Journal d'erreurs sobre : ne reçoit jamais la clé ni le corps de la réponse Stripe. */
  log?: (entry: Record<string, unknown>) => void;
};

export type CheckoutDeps = BillingDeps & {
  isPro(userId: string): Promise<boolean>;
  /** Client Stripe déjà connu de ce joueur (événements Stripe reçus), sinon null. */
  findCustomerId(userId: string): Promise<string | null>;
};

export type BillingResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: "not_authenticated" | "invalid_plan" | "already_pro" | "no_customer" | "billing_unavailable" | "stripe_error" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRICE_PATTERN = /^price_[A-Za-z0-9_]+$/;
const CUSTOMER_PATTERN = /^cus_[A-Za-z0-9_]+$/;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const isPlan = (value: unknown): value is Plan => typeof value === "string" && (PLANS as readonly string[]).includes(value);

/** Origine autorisée pour les retours de paiement : https obligatoire, sauf localhost pour les essais. Sinon null. */
export function validatedOrigin(webBaseUrl: string | undefined): string | null {
  if (!webBaseUrl) return null;
  try {
    const url = new URL(webBaseUrl);
    if (url.username || url.password) return null;
    if (url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname))) return url.origin;
  } catch {
    /* URL invalide */
  }
  return null;
}

function priceFor(plan: Plan, config: BillingConfig): string | null {
  const price = plan === "monthly" ? config.priceMonthly : config.priceAnnual;
  return PRICE_PATTERN.test(price ?? "") ? price : null;
}

function safeStripeUrl(value: unknown, apiBase: string | undefined): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const local = LOCAL_HOSTS.has(url.hostname);
    if (url.protocol === "https:" || (url.protocol === "http:" && local && !!apiBase)) return url.toString();
  } catch {
    /* ignoré */
  }
  return null;
}

async function postToStripe(path: string, form: URLSearchParams, deps: BillingDeps): Promise<BillingResult> {
  const base = (deps.config.apiBase ?? "https://api.stripe.com").replace(/\/+$/, "");
  const log = deps.log ?? (() => undefined);
  let response: Response;
  try {
    response = await deps.fetch(`${base}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.config.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
  } catch {
    log({ source: "billing", path, status: "unreachable" });
    return { ok: false, status: 502, error: "stripe_error" };
  }
  let json: any = null;
  try {
    json = await response.json();
  } catch {
    /* corps non JSON */
  }
  if (!response.ok) {
    // Seuls le statut HTTP, le type et le code d'erreur Stripe sont journalisés : jamais le message libre, la clé ni la requête.
    log({ source: "billing", path, status: response.status, type: json?.error?.type ?? null, code: json?.error?.code ?? null });
    return { ok: false, status: 502, error: "stripe_error" };
  }
  const url = safeStripeUrl(json?.url, deps.config.apiBase);
  if (!url) {
    log({ source: "billing", path, status: "no_url" });
    return { ok: false, status: 502, error: "stripe_error" };
  }
  return { ok: true, url };
}

/** Crée une session Checkout en mode abonnement. `email` sert uniquement à préremplir quand aucun client Stripe n'est connu. */
export async function createCheckoutSession(input: { userId: string | null; email?: string | null; plan: unknown }, deps: CheckoutDeps): Promise<BillingResult> {
  if (!input.userId || !UUID_PATTERN.test(input.userId)) return { ok: false, status: 401, error: "not_authenticated" };
  if (!isPlan(input.plan)) return { ok: false, status: 400, error: "invalid_plan" };
  const origin = validatedOrigin(deps.config.webBaseUrl);
  const price = priceFor(input.plan, deps.config);
  if (!origin || !price || !deps.config.secretKey) {
    deps.log?.({ source: "billing", status: "misconfigured" });
    return { ok: false, status: 503, error: "billing_unavailable" };
  }
  if (await deps.isPro(input.userId)) return { ok: false, status: 409, error: "already_pro" };

  const customer = await deps.findCustomerId(input.userId);
  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("line_items[0][price]", price);
  form.set("line_items[0][quantity]", "1");
  form.set("client_reference_id", input.userId);
  form.set("subscription_data[metadata][user_id]", input.userId);
  form.set("metadata[user_id]", input.userId);
  form.set("success_url", `${origin}/Pro?checkout=success`);
  form.set("cancel_url", `${origin}/Pro?checkout=cancel`);
  form.set("locale", "fr");
  if (customer && CUSTOMER_PATTERN.test(customer)) form.set("customer", customer);
  else if (input.email) form.set("customer_email", input.email);
  return postToStripe("/v1/checkout/sessions", form, deps);
}

/** Crée une session du portail client (gérer / résilier). Réservée à un joueur dont un client Stripe est connu. */
export async function createPortalSession(input: { userId: string | null }, deps: Omit<CheckoutDeps, "isPro">): Promise<BillingResult> {
  if (!input.userId || !UUID_PATTERN.test(input.userId)) return { ok: false, status: 401, error: "not_authenticated" };
  const origin = validatedOrigin(deps.config.webBaseUrl);
  if (!origin || !deps.config.secretKey) {
    deps.log?.({ source: "billing", status: "misconfigured" });
    return { ok: false, status: 503, error: "billing_unavailable" };
  }
  const customer = await deps.findCustomerId(input.userId);
  if (!customer || !CUSTOMER_PATTERN.test(customer)) return { ok: false, status: 409, error: "no_customer" };
  const form = new URLSearchParams();
  form.set("customer", customer);
  form.set("return_url", `${origin}/Pro?portal=return`);
  return postToStripe("/v1/billing_portal/sessions", form, deps);
}
