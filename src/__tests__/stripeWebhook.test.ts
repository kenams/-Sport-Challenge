import { webcrypto } from "crypto";
import {
  BILLING_GRACE_SECONDS,
  computeStripeSignature,
  handleStripeWebhook,
  mapStripeEvent,
  verifyStripeSignature,
  type EntitlementUpdate,
  type StripeEvent,
  type WebhookDeps,
} from "../../supabase/functions/_shared/stripe";

const subtle = webcrypto.subtle as unknown as SubtleCrypto;
const SECRET = "whsec_test_secret";
const USER = "123e4567-e89b-42d3-a456-426614174000";
const NOW = 1_800_000_000;
const MONTH = 30 * 24 * 3600;

const subscription = (over: Record<string, unknown> = {}) => ({
  id: "sub_1",
  customer: "cus_1",
  status: "active",
  cancel_at_period_end: false,
  current_period_end: NOW + MONTH,
  metadata: { user_id: USER },
  items: { data: [{ price: { id: "price_monthly", product: "prod_pro" } }] },
  ...over,
});
const event = (id: string, type: string, object: Record<string, unknown>, created = NOW, livemode = true): StripeEvent => ({ id, type, created, livemode, data: { object } });

async function signed(ev: StripeEvent, timestamp = NOW, secret = SECRET) {
  const body = JSON.stringify(ev);
  const signature = await computeStripeSignature(body, timestamp, secret, subtle);
  return { body, header: `t=${timestamp},v1=${signature}` };
}

/** Réplique en mémoire des règles de apply_entitlement_event (doublon, plus ancien ignoré), testées en SQL dans test-server-rules.mjs. */
function makeLedger() {
  const seen = new Set<string>();
  let last: number | null = null;
  const state: { plan: string; status: string; periodEnd: string | null } = { plan: "free", status: "none", periodEnd: null };
  const applied: string[] = [];
  const applyEvent: WebhookDeps["applyEvent"] = async (u: EntitlementUpdate) => {
    if (seen.has(u.eventId)) return "duplicate";
    seen.add(u.eventId);
    const time = Date.parse(u.eventTime);
    if (last !== null && time <= last) return "stale";
    last = time;
    Object.assign(state, { plan: u.plan, status: u.status, periodEnd: u.periodEnd });
    applied.push(u.type);
    return "applied";
  };
  return { state, applied, applyEvent };
}

function deps(over: Partial<WebhookDeps> = {}, ledger = makeLedger()): WebhookDeps & { ledger: ReturnType<typeof makeLedger> } {
  return {
    secrets: [SECRET],
    allowTestMode: false,
    nowSeconds: NOW,
    subtle,
    findUserByCustomer: async (customer) => (customer === "cus_1" ? USER : null),
    applyEvent: ledger.applyEvent,
    ...over,
    ledger,
  };
}

describe("signature Stripe", () => {
  it("accepte une signature valide", async () => {
    const { body, header } = await signed(event("evt_1", "customer.subscription.created", subscription()));
    expect((await verifyStripeSignature(body, header, SECRET, NOW, 300, subtle)).ok).toBe(true);
  });

  it("refuse une signature invalide, un corps modifié ou un mauvais secret", async () => {
    const { body, header } = await signed(event("evt_1", "customer.subscription.created", subscription()));
    expect(await verifyStripeSignature(body + " ", header, SECRET, NOW, 300, subtle)).toEqual({ ok: false, reason: "signature_mismatch" });
    expect(await verifyStripeSignature(body, header, "whsec_autre", NOW, 300, subtle)).toEqual({ ok: false, reason: "signature_mismatch" });
    expect(await verifyStripeSignature(body, `t=${NOW},v1=deadbeef`, SECRET, NOW, 300, subtle)).toEqual({ ok: false, reason: "signature_mismatch" });
  });

  it("refuse un en-tête absent ou mal formé", async () => {
    expect(await verifyStripeSignature("{}", null, SECRET, NOW, 300, subtle)).toEqual({ ok: false, reason: "missing_header" });
    expect(await verifyStripeSignature("{}", "n'importe quoi", SECRET, NOW, 300, subtle)).toEqual({ ok: false, reason: "malformed_header" });
    expect(await verifyStripeSignature("{}", `t=${NOW}`, SECRET, NOW, 300, subtle)).toEqual({ ok: false, reason: "malformed_header" });
  });

  it("refuse un horodatage trop ancien ou dans le futur", async () => {
    const { body, header } = await signed(event("evt_1", "customer.subscription.created", subscription()), NOW - 301);
    expect(await verifyStripeSignature(body, header, SECRET, NOW, 300, subtle)).toEqual({ ok: false, reason: "timestamp_out_of_tolerance" });
    const future = await signed(event("evt_1", "customer.subscription.created", subscription()), NOW + 301);
    expect(await verifyStripeSignature(future.body, future.header, SECRET, NOW, 300, subtle)).toEqual({ ok: false, reason: "timestamp_out_of_tolerance" });
    const edge = await signed(event("evt_1", "customer.subscription.created", subscription()), NOW - 300);
    expect((await verifyStripeSignature(edge.body, edge.header, SECRET, NOW, 300, subtle)).ok).toBe(true);
  });

  it("accepte l'ancien secret pendant une rotation", async () => {
    const { body, header } = await signed(event("evt_1", "customer.subscription.created", subscription()), NOW, "whsec_ancien");
    expect((await verifyStripeSignature(body, header, [SECRET, "whsec_ancien"], NOW, 300, subtle)).ok).toBe(true);
  });
});

describe("correspondance des événements", () => {
  it("achat : abonnement actif -> Pro actif jusqu'à la fin de période", () => {
    const r = mapStripeEvent(event("evt_1", "customer.subscription.created", subscription()), USER);
    expect(r.kind).toBe("apply");
    if (r.kind === "apply") {
      expect(r.update).toMatchObject({ plan: "pro", status: "active", source: "stripe", userId: USER, productId: "prod_pro" });
      expect(r.update.periodEnd).toBe(new Date((NOW + MONTH) * 1000).toISOString());
    }
  });

  it("résiliation programmée : Pro jusqu'à la fin de période, sans renouvellement", () => {
    const r = mapStripeEvent(event("evt_2", "customer.subscription.updated", subscription({ cancel_at_period_end: true })), USER);
    expect(r.kind === "apply" && r.update.status).toBe("cancelled_pending");
    expect(r.kind === "apply" && r.update.plan).toBe("pro");
  });

  it("renouvellement : invoice.paid prolonge la période", () => {
    const end = NOW + 2 * MONTH;
    const r = mapStripeEvent(event("evt_3", "invoice.paid", { customer: "cus_1", amount_paid: 499, lines: { data: [{ period: { end }, price: { id: "price_monthly" } }] } }), USER);
    expect(r.kind === "apply" && r.update.periodEnd).toBe(new Date(end * 1000).toISOString());
    expect(r.kind === "apply" && r.update.status).toBe("active");
  });

  it("facture à zéro euro ou sans période : ignorée", () => {
    expect(mapStripeEvent(event("evt_4", "invoice.paid", { amount_paid: 0, lines: { data: [{ period: { end: NOW + MONTH } }] } }), USER)).toEqual({ kind: "ignore", reason: "zero_amount_invoice" });
    expect(mapStripeEvent(event("evt_5", "invoice.paid", { amount_paid: 499, lines: { data: [] } }), USER)).toEqual({ kind: "ignore", reason: "missing_period_end" });
  });

  it("échec de paiement : accès maintenu, borné par un délai de grâce", () => {
    const farEnd = NOW + 40 * 24 * 3600;
    const r = mapStripeEvent(event("evt_6", "invoice.payment_failed", { customer: "cus_1", lines: { data: [{ period: { end: farEnd } }] } }), USER);
    expect(r.kind === "apply" && r.update.status).toBe("billing_issue");
    expect(r.kind === "apply" && r.update.periodEnd).toBe(new Date((NOW + BILLING_GRACE_SECONDS) * 1000).toISOString());
    const noEnd = mapStripeEvent(event("evt_7", "invoice.payment_failed", { customer: "cus_1" }), USER);
    expect(noEnd.kind === "apply" && noEnd.update.periodEnd).not.toBeNull();
  });

  it("impayé : billing_issue ; annulé ou expiré : retour au gratuit", () => {
    const pastDue = mapStripeEvent(event("evt_8", "customer.subscription.updated", subscription({ status: "past_due" })), USER);
    expect(pastDue.kind === "apply" && pastDue.update.status).toBe("billing_issue");
    for (const status of ["canceled", "incomplete_expired", "paused"]) {
      const r = mapStripeEvent(event("evt_9", "customer.subscription.updated", subscription({ status })), USER);
      expect(r.kind === "apply" && r.update).toMatchObject({ plan: "free", status: "expired", periodEnd: null });
    }
    const deleted = mapStripeEvent(event("evt_10", "customer.subscription.deleted", subscription({ status: "canceled" })), USER);
    expect(deleted.kind === "apply" && deleted.update).toMatchObject({ plan: "free", status: "expired" });
  });

  it("abonnement incomplet : ignoré (aucun accès tant que rien n'est payé)", () => {
    expect(mapStripeEvent(event("evt_11", "customer.subscription.created", subscription({ status: "incomplete" })), USER)).toEqual({ kind: "ignore", reason: "subscription_status_incomplete" });
  });

  it("remboursement total : accès retiré ; partiel : ignoré", () => {
    const full = mapStripeEvent(event("evt_12", "charge.refunded", { customer: "cus_1", refunded: true }), USER);
    expect(full.kind === "apply" && full.update).toMatchObject({ plan: "free", status: "refunded", periodEnd: null });
    expect(mapStripeEvent(event("evt_13", "charge.refunded", { customer: "cus_1", refunded: false }), USER)).toEqual({ kind: "ignore", reason: "partial_refund" });
  });

  it("ignore les événements non gérés, sans joueur, ou du mode test en production", () => {
    expect(mapStripeEvent(event("evt_14", "customer.created", {}), USER).kind).toBe("ignore");
    expect(mapStripeEvent(event("evt_15", "customer.subscription.created", subscription()), null)).toEqual({ kind: "ignore", reason: "no_player_for_event" });
    expect(mapStripeEvent(event("evt_16", "customer.subscription.created", subscription()), "pas-un-uuid").kind).toBe("ignore");
    expect(mapStripeEvent(event("evt_17", "customer.subscription.created", subscription(), NOW, false), USER)).toEqual({ kind: "ignore", reason: "test_mode_event_not_allowed" });
    expect(mapStripeEvent(event("evt_17", "customer.subscription.created", subscription(), NOW, false), USER, true).kind).toBe("apply");
  });
});

describe("récepteur complet (événements signés simulés)", () => {
  async function send(d: ReturnType<typeof deps>, ev: StripeEvent, timestamp = NOW) {
    const { body, header } = await signed(ev, timestamp);
    return handleStripeWebhook(body, header, d);
  }

  it("achat puis renouvellement puis expiration", async () => {
    const d = deps();
    expect((await send(d, event("evt_a", "customer.subscription.created", subscription(), NOW))).body).toMatchObject({ outcome: "applied" });
    expect(d.ledger.state).toMatchObject({ plan: "pro", status: "active" });
    const renewEnd = NOW + 2 * MONTH;
    await send(d, event("evt_b", "invoice.paid", { customer: "cus_1", amount_paid: 499, subscription_details: { metadata: { user_id: USER } }, lines: { data: [{ period: { end: renewEnd } }] } }, NOW + MONTH));
    expect(d.ledger.state.periodEnd).toBe(new Date(renewEnd * 1000).toISOString());
    await send(d, event("evt_c", "customer.subscription.deleted", subscription({ status: "canceled" }), NOW + 2 * MONTH));
    expect(d.ledger.state).toMatchObject({ plan: "free", status: "expired" });
  });

  it("remboursement : le joueur est retrouvé par l'identifiant client Stripe", async () => {
    const d = deps();
    await send(d, event("evt_a", "customer.subscription.created", subscription(), NOW));
    const r = await send(d, event("evt_r", "charge.refunded", { customer: "cus_1", refunded: true }, NOW + 100));
    expect(r.body).toMatchObject({ outcome: "applied" });
    expect(d.ledger.state).toMatchObject({ plan: "free", status: "refunded" });
  });

  it("remboursement d'un client inconnu : ignoré, rien n'est modifié", async () => {
    const d = deps();
    const r = await send(d, event("evt_r", "charge.refunded", { customer: "cus_inconnu", refunded: true }));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ignored: "no_player_for_event" });
    expect(d.ledger.applied).toHaveLength(0);
  });

  it("doublon : le même événement envoyé deux fois n'est appliqué qu'une fois", async () => {
    const d = deps();
    const ev = event("evt_dup", "customer.subscription.created", subscription());
    expect((await send(d, ev)).body).toMatchObject({ outcome: "applied" });
    expect((await send(d, ev)).body).toMatchObject({ outcome: "duplicate" });
    expect(d.ledger.applied).toHaveLength(1);
  });

  it("ordre inversé : un événement ancien arrivé en retard ne rétablit pas l'ancien état", async () => {
    const d = deps();
    await send(d, event("evt_new", "customer.subscription.deleted", subscription({ status: "canceled" }), NOW + 1000));
    const late = await send(d, event("evt_old", "customer.subscription.created", subscription(), NOW));
    expect(late.body).toMatchObject({ outcome: "stale" });
    expect(d.ledger.state.plan).toBe("free");
  });

  it("signature invalide : refusé (400), rien n'est appliqué", async () => {
    const d = deps();
    const ev = event("evt_x", "customer.subscription.created", subscription());
    const r = await handleStripeWebhook(JSON.stringify(ev), `t=${NOW},v1=00`, d);
    expect(r.status).toBe(400);
    expect(d.ledger.applied).toHaveLength(0);
  });

  it("horodatage trop ancien : refusé (400)", async () => {
    const d = deps();
    const r = await send(d, event("evt_x", "customer.subscription.created", subscription()), NOW - 3600);
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ error: "timestamp_out_of_tolerance" });
    expect(d.ledger.applied).toHaveLength(0);
  });

  it("secret non configuré : 503 ; erreur de base : 500 (Stripe réessaiera)", async () => {
    const ev = event("evt_x", "customer.subscription.created", subscription());
    const { body, header } = await signed(ev);
    expect((await handleStripeWebhook(body, header, deps({ secrets: [] }))).status).toBe(503);
    const failing = deps({
      applyEvent: async () => {
        throw new Error("db down");
      },
    });
    expect((await handleStripeWebhook(body, header, failing)).status).toBe(500);
  });
});
