export type League = {
  key: string;
  name: string;
  short: string;
  from: number;
  to: number;
  color: string;
  label: string;
};

export const LEAGUES: League[] = [
  { key: "bronze", name: "Bronze", short: "BR", from: 1, to: 10, color: "#CD7F32", label: "Débutant" },
  { key: "silver", name: "Argent", short: "AR", from: 11, to: 20, color: "#C5CBD2", label: "Régulier" },
  { key: "gold", name: "Or", short: "OR", from: 21, to: 30, color: "#F5C451", label: "Confirmé" },
  { key: "jade", name: "Jade", short: "JA", from: 31, to: 40, color: "#42B883", label: "Athlète" },
  { key: "sapphire", name: "Saphir", short: "SA", from: 41, to: 50, color: "#4386F5", label: "Avancé" },
  { key: "ruby", name: "Rubis", short: "RU", from: 51, to: 60, color: "#E34D69", label: "Élite" },
  { key: "emerald", name: "Émeraude", short: "EM", from: 61, to: 70, color: "#16A676", label: "Expert" },
  { key: "amethyst", name: "Améthyste", short: "AM", from: 71, to: 80, color: "#A879E8", label: "Maître" },
  { key: "diamond", name: "Diamant", short: "DI", from: 81, to: 90, color: "#7ED8EA", label: "Champion" },
  { key: "immortal", name: "Immortel", short: "IM", from: 91, to: 100, color: "#F4D477", label: "Légende" },
];

export function leagueForLevel(level: number) {
  const safeLevel = Math.min(100, Math.max(1, Math.floor(level || 1)));
  return LEAGUES.find((league) => safeLevel <= league.to) ?? LEAGUES[LEAGUES.length - 1];
}

export function leagueProgress(level: number, league = leagueForLevel(level)) {
  if (league.to === 100) return 1;
  return Math.max(0, Math.min(1, (level - league.from + 1) / (league.to - league.from + 1)));
}
