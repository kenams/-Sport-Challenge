// Logique pure du paiement web (Stripe) de l'écran Pro : activation, retour de paiement, messages. Testée par Jest.
// Principe : l'URL de retour ne prouve JAMAIS un paiement. Seul l'état du droit lu côté serveur (is_pro) fait foi.

export type CheckoutPlan = "monthly" | "annual";

export const PLAN_LABELS: Record<CheckoutPlan, string> = {
  monthly: "S'abonner · 4,99 € par mois",
  annual: "S'abonner · 39,99 € par an",
};

export type WebSubscribe = { available: boolean; reason: "platform" | "disabled" | "enabled" };

/** Le paiement web n'existe que sur le web et seulement si le drapeau vaut exactement "true". Jamais sur iOS/Android (achats numériques via les boutiques). */
export function webSubscribe(platform: string, flag: string | undefined): WebSubscribe {
  if (platform !== "web") return { available: false, reason: "platform" };
  if (flag !== "true") return { available: false, reason: "disabled" };
  return { available: true, reason: "enabled" };
}

export type CheckoutReturn = "success" | "cancel" | null;

export function parseCheckoutReturn(search: string | undefined | null): CheckoutReturn {
  if (!search) return null;
  const value = new URLSearchParams(search.startsWith("?") ? search : `?${search}`).get("checkout");
  return value === "success" || value === "cancel" ? value : null;
}

export const CONFIRM_POLL_MS = 3000;
export const CONFIRM_TIMEOUT_MS = 90_000;

export type ConfirmationView =
  | { kind: "none" }
  | { kind: "confirming"; text: string }
  | { kind: "confirmed"; text: string }
  | { kind: "delayed"; text: string }
  | { kind: "cancelled"; text: string };

/**
 * Message de retour de paiement. "Confirmé" uniquement si le serveur déclare le droit Pro actif ;
 * sinon "en cours de confirmation" tant que le webhook n'a pas écrit le droit, puis "délai anormal" après le délai d'attente.
 */
export function confirmationView(returned: CheckoutReturn, proActive: boolean, elapsedMs: number): ConfirmationView {
  if (!returned) return { kind: "none" };
  if (returned === "cancel") {
    return proActive
      ? { kind: "none" }
      : { kind: "cancelled", text: "Tu es revenu sans terminer le paiement. Rien n'est activé tant que ton abonnement n'apparaît pas comme « Pro actif » ci-dessus." };
  }
  if (proActive) return { kind: "confirmed", text: "Paiement confirmé par le serveur : ton abonnement Pro est actif." };
  if (elapsedMs < CONFIRM_TIMEOUT_MS) {
    return { kind: "confirming", text: "Paiement en cours de confirmation… Ton accès Pro s'active dès que la confirmation de paiement est reçue. Ne repaie pas." };
  }
  return {
    kind: "delayed",
    text: "La confirmation prend plus de temps que prévu. Ne repaie pas : actualise cette page dans quelques minutes. Si ton accès n'apparaît pas, contacte le support avec ton e-mail de paiement.",
  };
}

const BILLING_MESSAGES: Record<string, string> = {
  not_authenticated: "Connecte-toi pour t'abonner.",
  invalid_plan: "Formule inconnue. Choisis mensuel ou annuel.",
  already_pro: "Tu as déjà un abonnement Pro actif.",
  no_customer: "Aucun abonnement web trouvé pour ce compte. Si tu as souscrit via une boutique, gère-le dans la boutique.",
  billing_unavailable: "Le paiement n'est pas disponible pour le moment. Aucun paiement n'a été effectué.",
  stripe_error: "Le service de paiement est indisponible. Aucun paiement n'a été effectué. Réessaie plus tard.",
};

export function billingErrorMessage(code: unknown): string {
  return (typeof code === "string" && BILLING_MESSAGES[code]) || "Impossible d'ouvrir le paiement. Aucun paiement n'a été effectué. Réessaie dans un instant.";
}

/** Le portail n'a de sens que pour un abonnement venant de Stripe. */
export function canManageOnWeb(platform: string, flag: string | undefined, source: string | null | undefined, proActive: boolean): boolean {
  return platform === "web" && flag === "true" && source === "stripe" && proActive;
}
