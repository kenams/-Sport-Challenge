import { Challenge } from "../types";

type TutorialContent = {
  title: string;
  steps: string[];
  rules: string[];
  icon: {
    name: string;
    color: string;
  };
};

const buildBaseRules = () => [
  "Vidéo en une seule prise (pas de montage).",
  "Montre le corps entier et la zone d'exécution.",
  "Ajoute un repère clair (chrono, distance, ou compteur).",
  "Luminosité forte, pas de contre-jour.",
];

const withCustomRule = (rules: string[], hint?: string | null) => {
  const trimmed = hint?.trim();
  if (!trimmed) return rules;
  return [...rules, `Repère imposé: ${trimmed}`];
};

const sportMatch = (sport: string, keys: string[]) =>
  keys.some((key) => sport.includes(key));

export function getChallengeTutorial(challenge: Challenge): TutorialContent {
  const sport = (challenge.sport || "").toLowerCase();
  const objective = `${challenge.target_value} ${challenge.unit}`;

  if (sportMatch(sport, ["running", "course", "run", "jog", "trail"])) {
    return {
      title: "Tutoriel course",
      steps: [
        `Prépare un trajet clair pour ${objective}.`,
        "Démarre la vidéo avant le départ (montre le chrono).",
        "Garde la caméra stable ou en mode selfie sur tout le trajet.",
        "Montre l'arrivée et le chrono final.",
      ],
      rules: withCustomRule(
        [...buildBaseRules(), "Le parcours doit être visible ou annoncé."],
        challenge.proof_hint
      ),
      icon: { name: "running", color: "#FACC15" },
    };
  }

  if (sportMatch(sport, ["basket", "basketball"])) {
    return {
      title: "Tutoriel basket",
      steps: [
        `Annonce l'objectif (${objective}).`,
        "Cadre le panier et le joueur en entier.",
        "Enchaîne les tirs sans coupure.",
        "Montre le compteur final.",
      ],
      rules: withCustomRule(
        [...buildBaseRules(), "Le panier doit être visible en continu."],
        challenge.proof_hint
      ),
      icon: { name: "basketball-ball", color: "#F97316" },
    };
  }

  if (sportMatch(sport, ["foot", "football", "soccer"])) {
    return {
      title: "Tutoriel football",
      steps: [
        `Explique l'objectif (${objective}).`,
        "Cadre la zone (cibles, plots, ou but).",
        "Montre chaque tentative sans couper.",
        "Affiche le résultat final.",
      ],
      rules: withCustomRule(
        [...buildBaseRules(), "Les tentatives doivent être visibles."],
        challenge.proof_hint
      ),
      icon: { name: "futbol", color: "#34D399" },
    };
  }

  if (sportMatch(sport, ["swim", "natation", "nage"])) {
    return {
      title: "Tutoriel natation",
      steps: [
        `Annonce la distance (${objective}).`,
        "Filme le départ et le chrono.",
        "Garde la ligne d'eau visible autant que possible.",
        "Montre l'arrivée et le chrono final.",
      ],
      rules: withCustomRule(
        [...buildBaseRules(), "Le bassin doit être identifiable."],
        challenge.proof_hint
      ),
      icon: { name: "swimmer", color: "#38BDF8" },
    };
  }

  if (sportMatch(sport, ["pushup", "push-up", "pompe"])) {
    return {
      title: "Tutoriel pompes",
      steps: [
        `Annonce le nombre (${objective}).`,
        "Cadre le corps entier de profil.",
        "Place un repère sous le torse (poing/objet).",
        "Effectue les répétitions sans pause longue.",
        "Montre le compteur final.",
      ],
      rules: withCustomRule(
        [...buildBaseRules(), "La poitrine doit toucher le repère fixe."],
        challenge.proof_hint
      ),
      icon: { name: "dumbbell", color: "#F472B6" },
    };
  }

  if (sportMatch(sport, ["traction", "pullup", "pull-up", "pull up"])) {
    return {
      title: "Tutoriel tractions",
      steps: [
        `Annonce le nombre (${objective}).`,
        "Cadre le corps entier et la barre.",
        "Bras tendus en bas à chaque rep.",
        "Menton au-dessus de la barre à chaque rep.",
      ],
      rules: withCustomRule(
        [
          ...buildBaseRules(),
          "Pronation ou supination, mais annonce la prise.",
          "Pas de balancement excessif (kipping).",
        ],
        challenge.proof_hint
      ),
      icon: { name: "dumbbell", color: "#60A5FA" },
    };
  }

  if (sportMatch(sport, ["squat", "squats"])) {
    return {
      title: "Tutoriel squats",
      steps: [
        `Annonce le nombre (${objective}).`,
        "Cadre le corps entier.",
        "Descends sous le niveau des genoux.",
        "Montre le compteur final.",
      ],
      rules: withCustomRule(
        [...buildBaseRules(), "Amplitude complète obligatoire."],
        challenge.proof_hint
      ),
      icon: { name: "dumbbell", color: "#A3E635" },
    };
  }

  return {
    title: "Tutoriel rapide",
    steps: [
      `Annonce l'objectif (${objective}).`,
      "Cadre bien la zone et le corps entier.",
      "Réalise la performance sans coupure.",
      "Montre le résultat final.",
    ],
    rules: withCustomRule(buildBaseRules(), challenge.proof_hint),
    icon: { name: "bolt", color: "#FACC15" },
  };
}