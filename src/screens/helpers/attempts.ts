// Logique pure des écrans de défis : saisie, affichage, états. Aucune décision métier (points, gagnant officiel, validation) : le serveur décide.
import type { Attempt, ChallengeFormat, FormatKey } from "../../domain/types";

export const TITLE_MAX = 80;
export const DETAILS_MAX = 500;
export const PAGE_SIZE = 20;

export const FEED_FILTERS: Array<{ key: "all" | FormatKey; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "pushups_60s", label: "Pompes" },
  { key: "pullups_max", label: "Tractions" },
];

export type ParsedScore = { ok: true; value: number } | { ok: false; message: string };

/** Score déclaré : entier de 1 au maximum du format (le serveur contrôle à nouveau). */
export function parseDeclaredScore(raw: string, max: number): ParsedScore {
  const text = raw.trim();
  if (text === "") return { ok: false, message: "Indique le nombre de répétitions que tu as réalisées." };
  if (!/^\d+$/.test(text)) return { ok: false, message: "Le score doit être un nombre entier, sans virgule." };
  const value = Number(text);
  if (value < 1) return { ok: false, message: "Le score doit être d'au moins 1." };
  if (value > max) return { ok: false, message: `Le score ne peut pas dépasser ${max} pour ce format.` };
  return { ok: true, value };
}

export function sanitizeScoreInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

export function cleanTitle(raw: string): string | null {
  const text = raw.trim().replace(/\s+/g, " ");
  return text === "" ? null : text.slice(0, TITLE_MAX);
}

/** Territoire déclaré par l'auteur (information déclarative, non vérifiée). */
export function territoryLabel(attempt: Pick<Attempt, "city_declared" | "region_declared" | "country_declared">): string | null {
  const parts = [attempt.city_declared, attempt.region_declared, attempt.country_declared]
    .map((part) => (part ?? "").trim())
    .filter((part, index, all) => part !== "" && all.indexOf(part) === index);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function durationLabel(format: Pick<ChallengeFormat, "duration_seconds">): string {
  return format.duration_seconds ? `${format.duration_seconds} secondes` : "Une seule série";
}

export function shortDateFr(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" }).format(date);
  } catch {
    return date.toLocaleDateString("fr-FR");
  }
}

export function dateTimeFr(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(date);
  } catch {
    return date.toLocaleString("fr-FR");
  }
}

/** Ajoute une page au fil en évitant les doublons (même identifiant). */
export function mergeFeed(previous: Attempt[], next: Attempt[]): Attempt[] {
  const seen = new Set(previous.map((item) => item.id));
  return [...previous, ...next.filter((item) => !seen.has(item.id))];
}

/** Une page pleine laisse supposer qu'il y en a une autre ; une page courte, non. */
export function hasMorePages(received: number, pageSize = PAGE_SIZE): boolean {
  return received >= pageSize;
}

export type ScoreDisplay = { caption: "Score retenu" | "Score déclaré"; value: number; declaredNote: string | null };

/** Distingue clairement le score retenu par la modération du score simplement déclaré. */
export function scoreDisplay(attempt: Pick<Attempt, "status" | "declared_score" | "decided_score">): ScoreDisplay {
  if (attempt.status === "validated" && attempt.decided_score !== null) {
    const adjusted = attempt.decided_score !== attempt.declared_score;
    return { caption: "Score retenu", value: attempt.decided_score, declaredNote: adjusted ? `Déclaré : ${attempt.declared_score}` : null };
  }
  return { caption: "Score déclaré", value: attempt.declared_score, declaredNote: null };
}

export function isOwner(attempt: Pick<Attempt, "user_id">, userId: string | null): boolean {
  return !!userId && attempt.user_id === userId;
}

/** Un joueur répond à un défi qui n'est pas le sien, encore ouvert, et auquel il n'a pas déjà répondu. */
export function canRespond(challenge: Attempt, responses: Attempt[], userId: string | null): boolean {
  if (!userId) return false;
  if (challenge.user_id === userId) return false;
  if (challenge.status === "rejected" || challenge.status === "withdrawn" || challenge.video_removed) return false;
  if (challenge.recipient_user_id && challenge.recipient_user_id !== userId) return false;
  return !responses.some((response) => response.user_id === userId);
}

export function canWithdraw(attempt: Attempt, userId: string | null): boolean {
  return isOwner(attempt, userId) && attempt.status === "pending";
}

export function canReport(attempt: Attempt, userId: string | null): boolean {
  return !!userId && attempt.user_id !== userId && attempt.status !== "withdrawn";
}

export type DuelView =
  | { state: "awaiting" }
  | { state: "no_result" }
  | { state: "decided"; challengeScore: number; responseScore: number; relation: "tie" | "challenge_higher" | "response_higher" };

/**
 * Résultat d'un duel : affiché UNIQUEMENT si les deux performances sont validées avec un score retenu.
 * On compare seulement les scores retenus par la modération ; aucun point ni titre n'est calculé ici.
 */
export function duelView(challenge: Attempt, response: Attempt): DuelView {
  if (challenge.status === "rejected" || response.status === "rejected") return { state: "no_result" };
  if (challenge.status !== "validated" || response.status !== "validated") return { state: "awaiting" };
  if (challenge.decided_score === null || response.decided_score === null) return { state: "awaiting" };
  const a = challenge.decided_score;
  const b = response.decided_score;
  return { state: "decided", challengeScore: a, responseScore: b, relation: a === b ? "tie" : a > b ? "challenge_higher" : "response_higher" };
}

/** Adversaire d'une revanche : l'autre joueur du duel, seulement si l'utilisateur y a participé. */
export function revengeOpponent(challenge: Attempt, response: Attempt, userId: string | null): { id: string; pseudo: string | null } | null {
  if (!userId) return null;
  if (challenge.user_id === userId) return { id: response.user_id, pseudo: response.pseudo ?? null };
  if (response.user_id === userId) return { id: challenge.user_id, pseudo: challenge.pseudo ?? null };
  return null;
}

export type ReportReason = "wrong_count" | "not_the_exercise" | "fake_or_edited" | "inappropriate" | "other";

export const REPORT_REASONS: Array<{ key: ReportReason; label: string }> = [
  { key: "wrong_count", label: "Le compte de répétitions est faux" },
  { key: "not_the_exercise", label: "Ce n'est pas le bon exercice" },
  { key: "fake_or_edited", label: "Vidéo montée ou trompeuse" },
  { key: "inappropriate", label: "Contenu inapproprié" },
  { key: "other", label: "Autre motif" },
];

export function isNetworkMessage(message: string | null | undefined): boolean {
  return !!message && /Connexion impossible|réseau/i.test(message);
}

/** Titre affiché pour un défi : titre libre, sinon libellé du format. */
export function challengeTitle(attempt: Pick<Attempt, "title">, formatLabelText: string): string {
  const title = (attempt.title ?? "").trim();
  return title !== "" ? title : formatLabelText;
}
