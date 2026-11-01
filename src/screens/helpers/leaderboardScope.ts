import type { TerritoryScope } from "../../domain/types";

export const SCOPE_OPTIONS: Array<{ key: TerritoryScope; label: string; missingHint: string }> = [
  { key: "world", label: "Monde", missingHint: "" },
  { key: "country", label: "Pays", missingHint: "ton pays" },
  { key: "region", label: "Région", missingHint: "ta région" },
  { key: "city", label: "Ville", missingHint: "ta ville" },
];

type TerritoryLike = { city?: string | null; region?: string | null; country?: string | null } | null | undefined;

/** Valeur de périmètre à envoyer au serveur, issue du territoire DÉCLARÉ du joueur connecté. */
export function resolveScope(scope: TerritoryScope, profile: TerritoryLike): { value: string | null; missing: boolean; label: string } {
  if (scope === "world") return { value: null, missing: false, label: "Monde" };
  const raw = scope === "country" ? profile?.country : scope === "region" ? profile?.region : profile?.city;
  const value = (raw ?? "").trim();
  if (!value) return { value: null, missing: true, label: "" };
  return { value, missing: false, label: value };
}
