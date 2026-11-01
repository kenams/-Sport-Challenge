// Correspondance entre les événements RevenueCat et les droits Pro de la base (fonction apply_entitlement_event).
// ATTENTION : à valider contre la documentation RevenueCat et un achat de test réel avant d'activer les ventes.
// Cette logique est pure (sans dépendance Deno) pour être testée par Jest.

export type RevenueCatEvent = {
  id: string;
  type: string;
  app_user_id: string;
  event_timestamp_ms: number;
  product_id?: string | null;
  expiration_at_ms?: number | null;
  store?: string | null;
  cancel_reason?: string | null;
  environment?: string | null;
};

export type EntitlementUpdate = {
  eventId: string;
  userId: string;
  type: string;
  eventTime: string;
  plan: "free" | "pro";
  status: "active" | "billing_issue" | "cancelled_pending" | "expired" | "refunded";
  source: "apple" | "google" | "stripe" | "manual";
  productId: string | null;
  periodEnd: string | null;
};

export type MappingResult = { kind: "apply"; update: EntitlementUpdate } | { kind: "ignore"; reason: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sourceFromStore(store: string | null | undefined): EntitlementUpdate["source"] {
  switch ((store ?? "").toUpperCase()) {
    case "APP_STORE":
    case "MAC_APP_STORE":
      return "apple";
    case "PLAY_STORE":
      return "google";
    case "STRIPE":
      return "stripe";
    default:
      return "manual";
  }
}

/**
 * @param allowSandbox accepte les événements de l'environnement SANDBOX (tests d'achat) ; faux en production.
 */
export function mapRevenueCatEvent(event: RevenueCatEvent, allowSandbox = false): MappingResult {
  if (!event || typeof event.id !== "string" || typeof event.type !== "string") {
    return { kind: "ignore", reason: "malformed_event" };
  }
  if (!UUID_PATTERN.test(event.app_user_id ?? "")) {
    return { kind: "ignore", reason: "app_user_id_is_not_a_player_id" };
  }
  if ((event.environment ?? "PRODUCTION").toUpperCase() === "SANDBOX" && !allowSandbox) {
    return { kind: "ignore", reason: "sandbox_event_not_allowed" };
  }
  if (!Number.isFinite(event.event_timestamp_ms)) {
    return { kind: "ignore", reason: "missing_timestamp" };
  }

  const base = {
    eventId: event.id,
    userId: event.app_user_id,
    type: event.type,
    eventTime: new Date(event.event_timestamp_ms).toISOString(),
    source: sourceFromStore(event.store),
    productId: event.product_id ?? null,
    periodEnd: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
  };

  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE":
    case "UNCANCELLATION":
    case "SUBSCRIPTION_EXTENDED":
      return { kind: "apply", update: { ...base, plan: "pro", status: "active" } };
    case "CANCELLATION":
      // Un remboursement arrive comme une annulation « CUSTOMER_SUPPORT » : accès retiré tout de suite.
      if ((event.cancel_reason ?? "").toUpperCase() === "CUSTOMER_SUPPORT") {
        return { kind: "apply", update: { ...base, plan: "free", status: "refunded", periodEnd: null } };
      }
      return { kind: "apply", update: { ...base, plan: "pro", status: "cancelled_pending" } };
    case "BILLING_ISSUE":
      return { kind: "apply", update: { ...base, plan: "pro", status: "billing_issue" } };
    case "EXPIRATION":
    case "SUBSCRIPTION_PAUSED":
      return { kind: "apply", update: { ...base, plan: "free", status: "expired", periodEnd: null } };
    default:
      return { kind: "ignore", reason: `unhandled_event_type_${event.type}` };
  }
}
