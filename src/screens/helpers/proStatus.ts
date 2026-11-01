import type { Entitlement } from "../../domain/types";

export type ProState = { label: string; tone: "muted" | "success" | "warning" | "danger"; detail: string };

function dateFr(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** État réel du droit, tel que le serveur le déclare. `active` (isPro) reste la seule clé d'accès aux avantages. */
export function describeEntitlement(ent: Entitlement, active: boolean): ProState {
  const end = dateFr(ent.current_period_end);
  switch (ent.status) {
    case "active":
      return { label: "Pro actif", tone: "success", detail: end ? `Valable jusqu'au ${end}.` : "Abonnement actif." };
    case "cancelled_pending":
      return {
        label: active ? "Pro actif, non renouvelé" : "Pro résilié",
        tone: "warning",
        detail: end ? `Accès jusqu'au ${end}, sans renouvellement.` : "Abonnement résilié.",
      };
    case "billing_issue":
      return {
        label: "Problème de facturation",
        tone: "danger",
        detail: active
          ? "Ton accès est maintenu pour l'instant. Mets à jour ton moyen de paiement auprès de la boutique."
          : "Le paiement a échoué : les avantages Pro sont suspendus.",
      };
    case "expired":
      return { label: "Pro expiré", tone: "muted", detail: end ? `Expiré le ${end}. Tu gardes tout l'accès gratuit.` : "Abonnement expiré. Tu gardes tout l'accès gratuit." };
    case "refunded":
      return { label: "Pro remboursé", tone: "muted", detail: "Abonnement remboursé : les avantages Pro sont retirés. Tu gardes tout l'accès gratuit." };
    default:
      return active
        ? { label: "Pro actif", tone: "success", detail: end ? `Valable jusqu'au ${end}.` : "Accès Pro actif." }
        : { label: "Gratuit", tone: "muted", detail: "Tu utilises IMMORTAL gratuitement. Rien d'essentiel n'est bloqué." };
  }
}

export type SubscribeCta = { label: string; disabled: boolean };

/** Tant qu'aucun module d'achat n'est branché, aucun achat n'est possible, même si le drapeau est activé. */
export function subscribeCta(iapFlag: string | undefined): SubscribeCta {
  return iapFlag === "true" ? { label: "S'abonner", disabled: false } : { label: "Abonnements bientôt disponibles", disabled: true };
}

export const CARD_THEMES = [
  { key: "gold", label: "Or", color: "#D4AF37" },
  { key: "steel", label: "Acier", color: "#9CA3AF" },
  { key: "crimson", label: "Carmin", color: "#DC2626" },
  { key: "emerald", label: "Émeraude", color: "#10B981" },
] as const;
export type CardThemeKey = (typeof CARD_THEMES)[number]["key"];

/** Largeur relative (0..1) d'une barre de progression. */
export function barRatio(value: number, max: number): number {
  if (!(max > 0) || !(value > 0)) return 0;
  return Math.min(1, value / max);
}
