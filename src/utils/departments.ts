export type DepartmentInfo = {
  code: string;
  label: string;
  short?: string;
};

export const IDF_DEPARTMENTS: DepartmentInfo[] = [
  { code: "75", label: "Paris", short: "75" },
  { code: "77", label: "Seine-et-Marne", short: "77" },
  { code: "78", label: "Yvelines", short: "78" },
  { code: "91", label: "Essonne", short: "91" },
  { code: "92", label: "Hauts-de-Seine", short: "92" },
  { code: "93", label: "Seine-Saint-Denis", short: "93" },
  { code: "94", label: "Val-de-Marne", short: "94" },
  { code: "95", label: "Val-d'Oise", short: "95" },
];

export const TARN_GARONNE_TERRITORIES: DepartmentInfo[] = [
  { code: "82", label: "Tarn-et-Garonne (général)", short: "82" },
  { code: "82-MON", label: "Montauban (82)", short: "82 MON" },
  { code: "82-MOI", label: "Moissac (82)", short: "82 MOI" },
  { code: "82-CAS", label: "Castelsarrasin (82)", short: "82 CAS" },
  { code: "82-MONTECH", label: "Montech (82)", short: "82 MONTECH" },
  { code: "82-BEAU", label: "Beaumont-de-Lomagne (82)", short: "82 BMT" },
];

export const COMPETING_TERRITORIES: DepartmentInfo[] = [
  ...IDF_DEPARTMENTS,
  ...TARN_GARONNE_TERRITORIES,
];

const LABEL_MAP: Record<string, DepartmentInfo> = COMPETING_TERRITORIES.reduce(
  (acc, dep) => {
    acc[dep.code] = dep;
    return acc;
  },
  {} as Record<string, DepartmentInfo>
);

export function getDepartmentLabel(
  code?: string | null
): string | null {
  if (!code) return null;
  return LABEL_MAP[code]?.label || null;
}

export function getDepartmentShortLabel(
  code?: string | null
): string | null {
  if (!code) return null;
  return LABEL_MAP[code]?.short || LABEL_MAP[code]?.label || null;
}
