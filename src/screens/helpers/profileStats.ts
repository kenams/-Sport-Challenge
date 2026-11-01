// Calculs d'affichage du profil à partir des performances DÉJÀ validées par le serveur. Rien n'est inventé.
import type { Attempt, FormatKey } from "../../domain/types";

type PerfLike = Pick<Attempt, "status" | "format_key" | "decided_score" | "decided_at" | "created_at">;

export type Badge = { key: string; label: string; description: string; earned: boolean };

const WEEK_MS = 7 * 24 * 3600 * 1000;

export function validatedPerformances<T extends PerfLike>(attempts: T[]): T[] {
  return attempts.filter((a) => a.status === "validated" && a.decided_score !== null);
}

export function bestValidatedScore(attempts: PerfLike[], format: FormatKey): number | null {
  const scores = validatedPerformances(attempts)
    .filter((a) => a.format_key === format)
    .map((a) => a.decided_score as number);
  return scores.length ? Math.max(...scores) : null;
}

/** Vrai s'il existe 3 performances validées dans une fenêtre de 7 jours. */
export function hasRegularity(attempts: PerfLike[]): boolean {
  const times = validatedPerformances(attempts)
    .map((a) => new Date(a.decided_at ?? a.created_at).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  for (let i = 0; i + 2 < times.length; i++) {
    if (times[i + 2] - times[i] <= WEEK_MS) return true;
  }
  return false;
}

export function computeBadges(attempts: PerfLike[]): Badge[] {
  return [
    {
      key: "first_validated",
      label: "Première performance validée",
      description: "Au moins une performance validée par la modération.",
      earned: validatedPerformances(attempts).length >= 1,
    },
    {
      key: "regularity",
      label: "Régularité",
      description: "3 performances validées sur 7 jours.",
      earned: hasRegularity(attempts),
    },
  ];
}

export function nextObjective(best: number | null): string {
  if (best === null) return "Obtenir ta 1re performance validée";
  return `Dépasser ton record : ${best + 1}`;
}
