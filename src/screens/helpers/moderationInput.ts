// Saisie du modérateur : contrôles avant d'appeler le serveur (qui reste décisionnaire).
export type ModerationAction = "validate" | "reject" | "remove_video" | "restore_video" | "dismiss_reports";

const REPORT_REASON_LABELS: Record<string, string> = {
  wrong_count: "Décompte contesté",
  not_the_exercise: "Ce n'est pas le bon exercice",
  fake_or_edited: "Vidéo truquée ou montée",
  inappropriate: "Contenu inapproprié",
  other: "Autre motif",
};

export function reportReasonLabel(reason: string): string {
  return REPORT_REASON_LABELS[reason] ?? "Autre motif";
}

export function parseRetainedScore(input: string, max: number): { ok: true; value: number } | { ok: false; error: string } {
  const text = input.trim();
  if (!/^\d+$/.test(text)) return { ok: false, error: "Le score retenu doit être un nombre entier." };
  const value = Number(text);
  if (value > max) return { ok: false, error: `Le score retenu ne peut pas dépasser ${max} pour ce format.` };
  return { ok: true, value };
}

export function reasonRequired(action: ModerationAction): boolean {
  return action === "reject" || action === "remove_video";
}

/** Retourne un message d'erreur, ou null si la décision est complète. */
export function validateDecision(action: ModerationAction, scoreInput: string, reason: string, max: number): string | null {
  if (action === "validate") {
    const parsed = parseRetainedScore(scoreInput, max);
    if (!parsed.ok) return parsed.error;
  }
  if (reasonRequired(action) && reason.trim().length < 3) return "Un motif est obligatoire pour cette décision.";
  return null;
}

export const ACTION_CONFIRM: Record<ModerationAction, { title: string; button: string }> = {
  validate: { title: "Valider cette performance", button: "Confirmer la validation" },
  reject: { title: "Rejeter cette performance", button: "Confirmer le rejet" },
  remove_video: { title: "Retirer la vidéo", button: "Confirmer le retrait" },
  restore_video: { title: "Rétablir la vidéo", button: "Confirmer le rétablissement" },
  dismiss_reports: { title: "Classer les signalements sans suite", button: "Confirmer le classement" },
};
