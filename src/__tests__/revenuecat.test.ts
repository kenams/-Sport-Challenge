import { mapRevenueCatEvent, type RevenueCatEvent } from "../../supabase/functions/_shared/revenuecat";

const USER = "123e4567-e89b-42d3-a456-426614174000";
const base: RevenueCatEvent = {
  id: "evt_1",
  type: "INITIAL_PURCHASE",
  app_user_id: USER,
  event_timestamp_ms: 1_800_000_000_000,
  product_id: "immortal_pro_monthly",
  expiration_at_ms: 1_802_592_000_000,
  store: "APP_STORE",
  environment: "PRODUCTION",
};

describe("mapRevenueCatEvent", () => {
  it("achat, renouvellement et reprise donnent le Pro actif avec la fin de période", () => {
    for (const type of ["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION", "SUBSCRIPTION_EXTENDED"]) {
      const result = mapRevenueCatEvent({ ...base, type });
      expect(result.kind).toBe("apply");
      if (result.kind === "apply") {
        expect(result.update.plan).toBe("pro");
        expect(result.update.status).toBe("active");
        expect(result.update.periodEnd).toBe(new Date(1_802_592_000_000).toISOString());
        expect(result.update.source).toBe("apple");
        expect(result.update.userId).toBe(USER);
      }
    }
  });

  it("l'annulation simple garde le Pro jusqu'à la fin de période", () => {
    const result = mapRevenueCatEvent({ ...base, type: "CANCELLATION", cancel_reason: "UNSUBSCRIBE" });
    expect(result.kind === "apply" && result.update.status).toBe("cancelled_pending");
    expect(result.kind === "apply" && result.update.plan).toBe("pro");
  });

  it("un remboursement retire l'accès immédiatement", () => {
    const result = mapRevenueCatEvent({ ...base, type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT" });
    expect(result.kind === "apply" && result.update.status).toBe("refunded");
    expect(result.kind === "apply" && result.update.plan).toBe("free");
    expect(result.kind === "apply" && result.update.periodEnd).toBeNull();
  });

  it("l'expiration et la pause retournent à l'offre gratuite", () => {
    for (const type of ["EXPIRATION", "SUBSCRIPTION_PAUSED"]) {
      const result = mapRevenueCatEvent({ ...base, type });
      expect(result.kind === "apply" && result.update.plan).toBe("free");
      expect(result.kind === "apply" && result.update.status).toBe("expired");
    }
  });

  it("un problème de facturation garde le Pro (période de grâce) avec un statut dédié", () => {
    const result = mapRevenueCatEvent({ ...base, type: "BILLING_ISSUE" });
    expect(result.kind === "apply" && result.update.status).toBe("billing_issue");
  });

  it("ignore les identifiants anonymes, les événements de test et les types inconnus", () => {
    expect(mapRevenueCatEvent({ ...base, app_user_id: "$RCAnonymousID:abc" }).kind).toBe("ignore");
    expect(mapRevenueCatEvent({ ...base, type: "TEST" }).kind).toBe("ignore");
    expect(mapRevenueCatEvent({ ...base, type: "TRANSFER" }).kind).toBe("ignore");
  });

  it("refuse les événements du bac à sable en production, les accepte en test", () => {
    const sandbox = { ...base, environment: "SANDBOX" };
    expect(mapRevenueCatEvent(sandbox).kind).toBe("ignore");
    expect(mapRevenueCatEvent(sandbox, true).kind).toBe("apply");
  });

  it("rejette un événement mal formé", () => {
    expect(mapRevenueCatEvent({} as RevenueCatEvent).kind).toBe("ignore");
    expect(mapRevenueCatEvent({ ...base, event_timestamp_ms: Number.NaN }).kind).toBe("ignore");
  });

  it("reconnaît les magasins", () => {
    const google = mapRevenueCatEvent({ ...base, store: "PLAY_STORE" });
    const stripe = mapRevenueCatEvent({ ...base, store: "STRIPE" });
    expect(google.kind === "apply" && google.update.source).toBe("google");
    expect(stripe.kind === "apply" && stripe.update.source).toBe("stripe");
  });
});
