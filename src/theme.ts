// src/theme.ts

export const COLORS = {
  background: "#050505",
  card: "#0F172A",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  border: "rgba(148,163,184,0.3)",
  primary: "#FACC15",
  accent: "#FB923C",
};

export type SportPalette = {
  background: string;
  card: string;
  border: string;
  accent: string;
  text: string;
};

const basePalette: SportPalette = {
  background: COLORS.background,
  card: COLORS.card,
  border: COLORS.border,
  accent: COLORS.accent,
  text: COLORS.text,
};

export const SPORT_PALETTES: Record<string, SportPalette> = {
  default: basePalette,
  basket: {
    background: "#140701",
    card: "#2A1205",
    border: "#FF9D45",
    accent: "#FF7A18",
    text: "#FFF4E0",
  },
  pushups: {
    background: "#111111",
    card: "#1E1E1E",
    border: "#FF5C5C",
    accent: "#FF0033",
    text: "#FFE1E1",
  },
  foot: {
    background: "#021206",
    card: "#062110",
    border: "#22FF88",
    accent: "#16FF5C",
    text: "#D3FFE7",
  },
  running: {
    background: "#04101C",
    card: "#0A1D2C",
    border: "#38BDF8",
    accent: "#0EA5E9",
    text: "#E0F2FE",
  },
  course: {
    background: "#04101C",
    card: "#0A1D2C",
    border: "#38BDF8",
    accent: "#0EA5E9",
    text: "#E0F2FE",
  },
  corde: {
    background: "#1A0228",
    card: "#2C0F3B",
    border: "#E879F9",
    accent: "#C026D3",
    text: "#FCE7F3",
  },
  velo: {
    background: "#030A1F",
    card: "#0B1633",
    border: "#60A5FA",
    accent: "#3B82F6",
    text: "#DBEAFE",
  },
  bike: {
    background: "#030A1F",
    card: "#0B1633",
    border: "#60A5FA",
    accent: "#3B82F6",
    text: "#DBEAFE",
  },
  workout: {
    background: "#1B100F",
    card: "#2A1513",
    border: "#F87171",
    accent: "#EF4444",
    text: "#FFE4E6",
  },
};

export const SPORT_COLORS: Record<string, string> = Object.entries(
  SPORT_PALETTES
).reduce((acc, [key, palette]) => {
  acc[key] = palette.accent;
  return acc;
}, {} as Record<string, string>);

export const getSportPalette = (sport?: string): SportPalette => {
  if (!sport) return SPORT_PALETTES.default;
  const normalized = sport.toLowerCase().trim();
  return SPORT_PALETTES[normalized] || SPORT_PALETTES.default;
};
