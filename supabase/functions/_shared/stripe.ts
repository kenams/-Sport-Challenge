// Récepteur Stripe (web) : vérification de signature, correspondance des événements, orchestration. Logique pure, sans dépendance Deno,
// testée par Jest (src/__tests__/stripeWebhook.test.ts). RIEN n'est vendable tant que le parcours n'a pas été testé avec le mode test de Stripe.
// ATTENTION : correspondance à valider contre la documentation Stripe de la version d'API utilisée et un paiement de test réel.

export type EntitlementUpdate = {
  eventId: string;
  userId: string;
  type: string;
  eventTime: string;
  plan: "free" | "pro";
  status: "active" | "billing_issue" | "cancelled_pending" | "expired" | "refunded";
  source: "stripe";
  productId: string | null;
  periodEnd: string | null;
};

export type StripeEvent = {
  id: string;
  type: string;
  created: number; // secondes
  livemode?: boolean;
  data?: { object?: Record<string, any> };
};

export type MappingResult = { kind: "apply"; update: EntitlementUpdate } | { kind: "ignore"; reason: string };

export const SIGNATURE_TOLERANCE_SECONDS = 300;
/** Quand Stripe signale un échec de paiement sans date de fin de période, l'accès est maintenu 7 jours au plus. */
export const BILLING_GRACE_SECONDS = 7 * 24 * 3600;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------- Signature ----------

export type SignatureResult = { ok: true } | { ok: false; reason: "missing_header" | "malformed_header" | "timestamp_out_of_tolerance" | "signature_mismatch" };

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** HMAC-SHA256 hexadécimal de `${timestamp}.${payload}` avec le secret du webhook (schéma v1 de Stripe). */
export async function computeStripeSignature(payload: string, timestamp: number, secret: string, subtle: SubtleCrypto = globalThis.crypto.subtle): Promise<string> {
  const encoder = new TextEncoder();
  const key = await subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`)));
}

/**
 * Vérifie l'en-tête `Stripe-Signature` (t=…,v1=…). `secrets` peut en contenir plusieurs (rotation de secret).
 * Le corps doit être le texte BRUT reçu, avant tout JSON.parse.
 */
export async function verifyStripeSignature(
  payload: string,
  header: string | null | undefined,
  secrets: string | string[],
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds: number = SIGNATURE_TOLERANCE_SECONDS,
  subtle: SubtleCrypto = globalThis.crypto.subtle
): Promise<SignatureResult> {
  if (!header) return { ok: false, reason: "missing_header" };
  let timestamp = NaN;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name === "t") timestamp = Number(value);
    else if (name === "v1" && value) signatures.push(value.toLowerCase());
  }
  if (!Number.isFinite(timestamp) || signatures.length === 0) return { ok: false, reason: "malformed_header" };
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return { ok: false, reason: "timestamp_out_of_tolerance" };
  const candidates = (Array.isArray(secrets) ? secrets : [secrets]).filter((s) => s.length > 0);
  for (const secret of candidates) {
    const expected = await computeStripeSignature(payload, timestamp, secret, subtle);
    if (signatures.some((signature) => timingSafeEqual(signature, expected))) return { ok: true };
  }
  return { ok: false, reason: "signature_mismatch" };
}

// ---------- Correspondance des événements ----------

const iso = (seconds: number) => new Date(seconds * 1000).toISOString();

/** Identifiant joueur posé par IMMORTAL à la création de l'abonnement (metadata.user_id) ; sinon l'identifiant client Stripe sert à le retrouver. */
export function extractUserHint(event: StripeEvent): { userId: string | null; customerId: string | null } {
  const object = event.data?.object ?? {};
  const candidates = [
    object.metadata?.user_id,
    object.client_reference_id,
    object.subscription_details?.metadata?.user_id,
    object.parent?.subscription_details?.metadata?.user_id,
    object.lines?.data?.[0]?.metadata?.user_id,
  ];
  const userId = candidates.find((c) => typeof c === "string" && UUID_PATTERN.test(c)) ?? null;
  const customerId = typeof object.customer === "string" ? object.customer : null;
  return { userId, customerId };
}

function subscriptionPeriodEnd(subscription: Record<string, any>): number | null {
  const direct = subscription.current_period_end;
  const item = subscription.items?.data?.[0]?.current_period_end;
  const value = typeof direct === "number" ? direct : typeof item === "number" ? item : null;
  return value;
}

function productOf(object: Record<string, any>): string | null {
  const price = object.items?.data?.[0]?.price ?? object.lines?.data?.[0]?.price ?? object.lines?.data?.[0]?.pricing?.price_details;
  const product = price?.product ?? price?.id ?? null;
  return typeof product === "string" ? product : null;
}

/**
 * @param userId joueur identifié (metadata ou retrouvé par l'identifiant client).
 * @param allowTestMode accepte les événements du mode test de Stripe (livemode=false) ; faux en production.
 */
export function mapStripeEvent(event: StripeEvent, userId: string | null, allowTestMode = false): MappingResult {
  if (!event || typeof event.id !== "string" || typeof event.type !== "string") return { kind: "ignore", reason: "malformed_event" };
  if (!Number.isFinite(event.created)) return { kind: "ignore", reason: "missing_timestamp" };
  if (event.livemode === false && !allowTestMode) return { kind: "ignore", reason: "test_mode_event_not_allowed" };
  const object = event.data?.object;
  if (!object) return { kind: "ignore", reason: "missing_object" };

  const relevant = [
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_failed",
    "invoice.paid",
    "charge.refunded",
  ];
  if (!relevant.includes(event.type)) return { kind: "ignore", reason: `unhandled_event_type_${event.type}` };
  if (!userId || !UUID_PATTERN.test(userId)) return { kind: "ignore", reason: "no_player_for_event" };

  const base = { eventId: event.id, userId, type: event.type, eventTime: iso(event.created), source: "stripe" as const, productId: productOf(object) };

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const periodEnd = subscriptionPeriodEnd(object);
      switch (object.status) {
        case "active":
        case "trialing":
          if (periodEnd === null) return { kind: "ignore", reason: "missing_period_end" };
          return {
            kind: "apply",
            update: { ...base, plan: "pro", status: object.cancel_at_period_end ? "cancelled_pending" : "active", periodEnd: iso(periodEnd) },
          };
        case "past_due":
        case "unpaid": {
          const end = periodEnd !== null ? Math.min(periodEnd, event.created + BILLING_GRACE_SECONDS) : event.created + BILLING_GRACE_SECONDS;
          return { kind: "apply", update: { ...base, plan: "pro", status: "billing_issue", periodEnd: iso(Math.max(end, event.created)) } };
        }
        case "canceled":
        case "incomplete_expired":
        case "paused":
          return { kind: "apply", update: { ...base, plan: "free", status: "expired", periodEnd: null } };
        default:
          return { kind: "ignore", reason: `subscription_status_${object.status}` };
      }
    }
    case "customer.subscription.deleted":
      return { kind: "apply", update: { ...base, plan: "free", status: "expired", periodEnd: null } };
    case "invoice.paid": {
      const end = object.lines?.data?.[0]?.period?.end;
      if (typeof end !== "number") return { kind: "ignore", reason: "missing_period_end" };
      if (typeof object.amount_paid === "number" && object.amount_paid <= 0) return { kind: "ignore", reason: "zero_amount_invoice" };
      return { kind: "apply", update: { ...base, plan: "pro", status: "active", periodEnd: iso(end) } };
    }
    case "invoice.payment_failed": {
      const lineEnd = object.lines?.data?.[0]?.period?.end;
      const end = typeof lineEnd === "number" ? Math.min(lineEnd, event.created + BILLING_GRACE_SECONDS) : event.created + BILLING_GRACE_SECONDS;
      return { kind: "apply", update: { ...base, plan: "pro", status: "billing_issue", periodEnd: iso(Math.max(end, event.created)) } };
    }
    case "charge.refunded":
      // Remboursement partiel : l'abonnement continue. Remboursement total : accès retiré tout de suite.
      if (object.refunded !== true) return { kind: "ignore", reason: "partial_refund" };
      return { kind: "apply", update: { ...base, plan: "free", status: "refunded", periodEnd: null } };
    default:
      return { kind: "ignore", reason: "unreachable" };
  }
}

// ---------- Orchestration ----------

export interface WebhookDeps {
  secrets: string[];
  allowTestMode: boolean;
  nowSeconds?: number;
  subtle?: SubtleCrypto;
  /** Retrouve le joueur d'après l'identifiant client Stripe (événements sans metadata, ex. remboursement). */
  findUserByCustomer(customerId: string): Promise<string | null>;
  /** Appelle apply_entitlement_event ; renvoie 'applied' | 'duplicate' | 'stale'. Lève une exception en cas d'erreur (Stripe réessaiera). */
  applyEvent(update: EntitlementUpdate, rawEvent: unknown): Promise<string>;
}

export type WebhookResponse = { status: number; body: Record<string, unknown> };

export async function handleStripeWebhook(rawBody: string, signatureHeader: string | null, deps: WebhookDeps): Promise<WebhookResponse> {
  if (deps.secrets.filter(Boolean).length === 0) return { status: 503, body: { error: "webhook_not_configured" } };
  const signature = await verifyStripeSignature(rawBody, signatureHeader, deps.secrets, deps.nowSeconds, SIGNATURE_TOLERANCE_SECONDS, deps.subtle);
  if (!signature.ok) return { status: 400, body: { error: signature.reason } };

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: "invalid_json" } };
  }

  const hint = extractUserHint(event);
  let userId = hint.userId;
  try {
    if (!userId && hint.customerId) userId = await deps.findUserByCustomer(hint.customerId);
  } catch {
    return { status: 500, body: { error: "lookup_failed" } };
  }

  const mapped = mapStripeEvent(event, userId, deps.allowTestMode);
  // 200 pour un événement volontairement ignoré : Stripe ne doit pas le renvoyer.
  if (mapped.kind === "ignore") return { status: 200, body: { ok: true, ignored: mapped.reason } };

  try {
    const outcome = await deps.applyEvent(mapped.update, event);
    return { status: 200, body: { ok: true, outcome } };
  } catch {
    return { status: 500, body: { error: "processing_failed" } };
  }
}
