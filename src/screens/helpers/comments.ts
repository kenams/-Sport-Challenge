// Logique pure des commentaires et encouragements (le serveur applique les mêmes règles : ceci ne sert qu'à guider la saisie).

export const COMMENT_MAX = 280;

/** Même nettoyage que le serveur : caractères de contrôle/invisibles retirés, espaces réduits, bords rognés. */
export function cleanCommentInput(raw: string): string {
  return raw
    .replace(/[\u0001-\u001F\u007F​-‏‪-‮⁠-⁩﻿]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type CommentCheck = { ok: true; text: string } | { ok: false; message: string };

export function checkComment(raw: string): CommentCheck {
  const text = cleanCommentInput(raw);
  if (text === "") return { ok: false, message: "Écris un commentaire avant d'envoyer." };
  if (Array.from(text).length > COMMENT_MAX) return { ok: false, message: `Ton commentaire dépasse ${COMMENT_MAX} caractères.` };
  return { ok: true, text };
}

export function remainingChars(raw: string): number {
  return COMMENT_MAX - Array.from(raw).length;
}

export function cheerLabel(count: number): string {
  if (count <= 0) return "Aucun encouragement";
  return count === 1 ? "1 encouragement" : `${count} encouragements`;
}

export function commentCountLabel(count: number): string {
  if (count <= 0) return "Aucun commentaire";
  return count === 1 ? "1 commentaire" : `${count} commentaires`;
}

/** Âge lisible d'un commentaire : « à l'instant », « il y a 5 min », « il y a 3 h », « il y a 2 j », sinon date. */
export function commentAge(iso: string, now: number = Date.now()): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";
  const seconds = Math.max(0, Math.floor((now - time) / 1000));
  if (seconds < 60) return "à l'instant";
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)} h`;
  if (seconds < 7 * 86400) return `il y a ${Math.floor(seconds / 86400)} j`;
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(new Date(time));
  } catch {
    return "";
  }
}

export const COMMENT_REPORT_REASONS: Array<{ key: "spam" | "harassment" | "inappropriate" | "other"; label: string }> = [
  { key: "spam", label: "Spam ou publicité" },
  { key: "harassment", label: "Harcèlement ou moquerie" },
  { key: "inappropriate", label: "Contenu inapproprié" },
  { key: "other", label: "Autre" },
];
