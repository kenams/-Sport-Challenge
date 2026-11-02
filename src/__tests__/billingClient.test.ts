import { CONFIRM_TIMEOUT_MS, billingErrorMessage, canManageOnWeb, confirmationView, parseCheckoutReturn, webSubscribe } from "../screens/helpers/billing";

describe("webSubscribe", () => {
  it("est désactivé par défaut et sans le drapeau exact", () => {
    for (const flag of [undefined, "", "false", "TRUE", "1", "yes"]) expect(webSubscribe("web", flag).available).toBe(false);
    expect(webSubscribe("web", undefined).reason).toBe("disabled");
  });
  it("ne s'active que sur le web avec le drapeau true", () => {
    expect(webSubscribe("web", "true").available).toBe(true);
  });
  it("n'est jamais disponible sur iOS/Android, même drapeau activé", () => {
    expect(webSubscribe("ios", "true")).toEqual({ available: false, reason: "platform" });
    expect(webSubscribe("android", "true").available).toBe(false);
  });
});

describe("parseCheckoutReturn", () => {
  it("lit seulement success et cancel", () => {
    expect(parseCheckoutReturn("?checkout=success")).toBe("success");
    expect(parseCheckoutReturn("checkout=cancel")).toBe("cancel");
    expect(parseCheckoutReturn("?checkout=paid")).toBeNull();
    expect(parseCheckoutReturn("")).toBeNull();
    expect(parseCheckoutReturn(null)).toBeNull();
  });
});

describe("confirmationView : l'URL ne prouve jamais un paiement", () => {
  it("rien sans retour de paiement", () => expect(confirmationView(null, false, 0).kind).toBe("none"));
  it("retour success sans droit serveur : en cours de confirmation", () => {
    expect(confirmationView("success", false, 0).kind).toBe("confirming");
    expect(confirmationView("success", false, CONFIRM_TIMEOUT_MS - 1).kind).toBe("confirming");
  });
  it("confirmé seulement quand le serveur déclare Pro actif", () => {
    expect(confirmationView("success", true, 1000).kind).toBe("confirmed");
  });
  it("après le délai sans droit : délai anormal, sans dire « réussi »", () => {
    const view = confirmationView("success", false, CONFIRM_TIMEOUT_MS);
    expect(view.kind).toBe("delayed");
    expect("text" in view && view.text).not.toMatch(/réussi|confirmé par le serveur/i);
  });
  it("retour cancel : rien d'activé, ou rien à dire si déjà Pro", () => {
    expect(confirmationView("cancel", false, 0).kind).toBe("cancelled");
    expect(confirmationView("cancel", true, 0).kind).toBe("none");
  });
});

describe("billingErrorMessage / canManageOnWeb", () => {
  it("traduit les codes connus et reste générique pour les autres, sans promesse de paiement", () => {
    expect(billingErrorMessage("already_pro")).toMatch(/déjà/);
    expect(billingErrorMessage("stripe_error")).toMatch(/Aucun paiement n'a été effectué/);
    expect(billingErrorMessage("truc")).toMatch(/Aucun paiement n'a été effectué/);
    expect(billingErrorMessage(undefined)).toMatch(/Aucun paiement/);
  });
  it("le portail n'apparaît que pour un Pro Stripe sur le web avec le drapeau", () => {
    expect(canManageOnWeb("web", "true", "stripe", true)).toBe(true);
    expect(canManageOnWeb("web", "true", "apple", true)).toBe(false);
    expect(canManageOnWeb("web", "true", "stripe", false)).toBe(false);
    expect(canManageOnWeb("web", undefined, "stripe", true)).toBe(false);
    expect(canManageOnWeb("ios", "true", "stripe", true)).toBe(false);
  });
});
