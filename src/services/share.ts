// Lien public et partage d'un événement IMMORTAL. Aucune donnée privée : pseudo + ville déclarés, date, format.
import { Platform, Share } from "react-native";
import { deviceTimezone, formatTimeFr } from "../domain/formats";
import type { EventStatus } from "../domain/types";

export type ShareableEvent = {
  slug: string;
  status: EventStatus;
  scheduled_at: string | null;
  timezone: string;
  formatKey: string;
  playerA: { pseudo: string | null; city: string | null };
  playerB: { pseudo: string | null; city: string | null };
};

export function webBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

/** `${EXPO_PUBLIC_WEB_BASE_URL}/e/${slug}` ; sans variable, chemin relatif (pas un vrai lien partageable). */
export function publicEventUrl(slug: string, base: string = webBaseUrl()): string {
  return `${base.replace(/\/+$/, "")}/e/${slug}`;
}

/** Vrai si un lien absolu partageable peut être construit. */
export function hasShareableLink(base: string = webBaseUrl()): boolean {
  return /^https?:\/\//i.test(base);
}

const SHORT_FORMAT: Record<string, string> = { pushups_60s: "Pompes 60 s", pullups_max: "Tractions max" };

function who(p: { pseudo: string | null; city: string | null }): string {
  const name = p.pseudo?.trim() || "Joueur";
  const city = p.city?.trim();
  return city ? `${name} (${city})` : name;
}

/** Texte de partage. Un duel non confirmé n'est jamais annoncé comme confirmé. */
export function buildShareText(event: ShareableEvent): string {
  const format = SHORT_FORMAT[event.formatKey] ?? event.formatKey;
  const duel = `${who(event.playerA)} vs ${who(event.playerB)} — ${format}`;
  const when = formatTimeFr(event.scheduled_at, deviceTimezone());
  if (event.status === "scheduled") return `${when} : ${duel}. Viens soutenir !`;
  if (event.status === "cancelled") return `Duel annulé : ${duel}.`;
  if (event.status === "finished") return `Duel terminé : ${duel}.`;
  if (event.status === "live") return `Duel en cours : ${duel}.`;
  return `Duel proposé, en attente d'accord de l'adversaire (non confirmé) : ${duel}, prévu ${when}.`;
}

export function buildShareMessage(event: ShareableEvent, base: string = webBaseUrl()): { text: string; url: string | null } {
  const text = buildShareText(event);
  return { text, url: hasShareableLink(base) ? publicEventUrl(event.slug, base) : null };
}

export type ShareOutcome = {
  status: "shared" | "copied" | "dismissed" | "failed";
  message: string;
  withLink: boolean;
};

export async function shareEvent(event: ShareableEvent): Promise<ShareOutcome> {
  const { text, url } = buildShareMessage(event);
  const withLink = url !== null;
  const full = url ? `${text}\n${url}` : text;
  try {
    if (Platform.OS === "web") {
      const nav: any = typeof navigator !== "undefined" ? navigator : undefined;
      if (nav?.share) {
        try {
          await nav.share(url ? { text, url } : { text });
          return { status: "shared", message: "Partagé.", withLink };
        } catch (error: any) {
          if (error?.name === "AbortError") return { status: "dismissed", message: "", withLink };
        }
      }
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(full);
        return { status: "copied", message: url ? "Lien et texte copiés dans le presse-papiers." : "Texte copié (sans lien : adresse web non configurée).", withLink };
      }
      return { status: "failed", message: "Le partage n'est pas disponible dans ce navigateur. Copie le texte manuellement.", withLink };
    }
    const result = await Share.share({ message: full });
    if (result.action === Share.dismissedAction) return { status: "dismissed", message: "", withLink };
    return { status: "shared", message: "Partagé.", withLink };
  } catch {
    return { status: "failed", message: "Le partage a échoué. Réessaie.", withLink };
  }
}
