import type { AttemptStatus, ChallengeFormat, DisciplineKey, FormatKey } from "./types";

/**
 * Formats standardisés proposés au lancement. Le serveur reste la référence (table challenge_formats) :
 * cette copie sert d'affichage hors ligne et de garde-fou quand la liste n'est pas encore chargée.
 */
export const FALLBACK_FORMATS: ChallengeFormat[] = [
  {
    key: "pushups_60s",
    discipline: "pushups",
    label_fr: "Pompes — 60 secondes",
    description_fr: "Un maximum de pompes complètes en 60 secondes.",
    duration_seconds: 60,
    rules_version: 1,
    rules_fr:
      "Départ en planche, bras tendus, genoux au sol interdits. À chaque répétition : poitrine à moins d'un poing du sol (coudes à 90° minimum), puis extension complète des bras, corps aligné (pas de bassin affaissé, pas de fesses en l'air). Une répétition incomplète ne compte pas. Une pause est permise en position haute. Durée : 60 secondes.",
    framing_fr:
      "Caméra de profil posée au sol, corps entier visible du premier au dernier mouvement, vidéo continue (pas de montage). Un chronomètre visible, ou la vidéo dure 60 s.",
    success_fr: "Le score retenu est le nombre de répétitions complètes comptées par un modérateur pendant les 60 secondes.",
    max_score: 200,
    max_video_seconds: 120,
  },
  {
    key: "pullups_max",
    discipline: "pullups",
    label_fr: "Tractions — maximum strict",
    description_fr: "Un maximum de tractions strictes en une seule série.",
    duration_seconds: null,
    rules_version: 1,
    rules_fr:
      "Départ suspendu bras tendus. À chaque répétition : menton au-dessus de la barre, puis redescente bras tendus. Pas d'élan (kipping interdit). Une seule série : elle s'arrête quand tu lâches la barre ou touches le sol. Une répétition incomplète ne compte pas.",
    framing_fr: "Caméra de face ou de profil, corps entier et barre visibles, vidéo continue de la prise de barre au dernier mouvement.",
    success_fr: "Le score retenu est le nombre de tractions strictes complètes comptées par un modérateur dans la série.",
    max_score: 100,
    max_video_seconds: 180,
  },
];

export const DISCIPLINE_LABELS: Record<DisciplineKey, string> = {
  pushups: "Pompes",
  pullups: "Tractions",
};

export const DISCIPLINE_ICONS: Record<DisciplineKey, string> = {
  pushups: "dumbbell",
  pullups: "grip-lines",
};

export function formatByKey(formats: ChallengeFormat[], key: string): ChallengeFormat | undefined {
  return formats.find((format) => format.key === key) ?? FALLBACK_FORMATS.find((format) => format.key === key);
}

export function formatLabel(key: string): string {
  return FALLBACK_FORMATS.find((format) => format.key === key)?.label_fr ?? key;
}

export function disciplineLabel(key: string): string {
  return DISCIPLINE_LABELS[key as DisciplineKey] ?? key;
}

/** Libellés et teintes des statuts : toujours visibles, jamais ambigus. */
export const STATUS_INFO: Record<AttemptStatus, { label: string; tone: "muted" | "warning" | "success" | "danger"; help: string }> = {
  pending: { label: "En attente de validation", tone: "warning", help: "Score déclaré, pas encore vérifié par la modération. Il ne compte pas encore dans les records." },
  validated: { label: "Validé", tone: "success", help: "Score vérifié par la modération. Il compte dans les records." },
  rejected: { label: "Rejeté", tone: "danger", help: "Performance non retenue. Le motif est indiqué." },
  withdrawn: { label: "Retiré", tone: "muted", help: "Retiré par son auteur." },
};

/** Score à afficher : le score retenu si validé, sinon le score déclaré (clairement étiqueté comme déclaré). */
export function scoreLabel(attempt: { status: AttemptStatus; declared_score: number; decided_score: number | null }): string {
  if (attempt.status === "validated" && attempt.decided_score !== null) {
    return `${attempt.decided_score}`;
  }
  return `${attempt.declared_score} (déclaré)`;
}

export const COUNTRIES = [
  "France",
  "Belgique",
  "Suisse",
  "Canada",
  "Luxembourg",
  "Espagne",
  "Italie",
  "Allemagne",
  "Royaume-Uni",
  "États-Unis",
  "Maroc",
  "Algérie",
  "Tunisie",
  "Sénégal",
  "Côte d'Ivoire",
  "Autre",
] as const;

export function formatTimeFr(iso: string | null, timezone = "Europe/Paris"): string {
  if (!iso) return "Date à fixer";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString("fr-FR");
  }
}
