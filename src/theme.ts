// src/theme.ts

export const COLORS = {
  background: "#03050C",
  surface: "#0B1020",
  card: "#141A2D",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  border: "rgba(148,163,184,0.25)",
  primary: "#FACC15",
  accent: "#FF6B00",
  success: "#34D399",
  danger: "#F87171",
  
  // New vibrant colors for better UI
  blue: "#0EA5E9",
  purple: "#A855F7",
  pink: "#EC4899",
  green: "#10B981",
  orange: "#F97316",
  red: "#EF4444",
  yellow: "#FBBF24",
  cyan: "#06B6D4",
  indigo: "#6366F1",
  lime: "#84CC16",
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
    border: "#FFB366",
    accent: "#FF7A18",
    text: "#FFF4E0",
  },
  basketball: {
    background: "#140701",
    card: "#2A1205",
    border: "#FFB366",
    accent: "#FF7A18",
    text: "#FFF4E0",
  },
  swim: {
    background: "#021428",
    card: "#05213F",
    border: "#47C2FF",
    accent: "#1FB6FF",
    text: "#E3F7FF",
  },
  piscine: {
    background: "#021428",
    card: "#05213F",
    border: "#47C2FF",
    accent: "#1FB6FF",
    text: "#E3F7FF",
  },
  aquatique: {
    background: "#021428",
    card: "#05213F",
    border: "#47C2FF",
    accent: "#1FB6FF",
    text: "#E3F7FF",
  },
  swimming: {
    background: "#021428",
    card: "#05213F",
    border: "#47C2FF",
    accent: "#1FB6FF",
    text: "#E3F7FF",
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
    background: "#0F1014",
    card: "#1B1C24",
    border: "#B5B7C3",
    accent: "#E3E5ED",
    text: "#F9FAFB",
  },
  musculation: {
    background: "#0F1014",
    card: "#1B1C24",
    border: "#B5B7C3",
    accent: "#E3E5ED",
    text: "#F9FAFB",
  },
  muscu: {
    background: "#0F1014",
    card: "#1B1C24",
    border: "#B5B7C3",
    accent: "#E3E5ED",
    text: "#F9FAFB",
  },
  fitness: {
    background: "#12111B",
    card: "#1E1D27",
    border: "#A1A6B8",
    accent: "#D1D5E0",
    text: "#F7F7FB",
  },
  boxe: {
    background: "#180B0F",
    card: "#271216",
    border: "#F47272",
    accent: "#E11D48",
    text: "#FFE4E6",
  },
  mma: {
    background: "#160A10",
    card: "#241015",
    border: "#FB7185",
    accent: "#F43F5E",
    text: "#FFE4E6",
  },
  yoga: {
    background: "#0E1418",
    card: "#182127",
    border: "#9CECFB",
    accent: "#8EC5FC",
    text: "#F1FBFF",
  },
  danse: {
    background: "#170223",
    card: "#250836",
    border: "#EB80FF",
    accent: "#D946EF",
    text: "#FEECFF",
  },
  parkour: {
    background: "#04110E",
    card: "#0B1F1A",
    border: "#34D399",
    accent: "#10B981",
    text: "#D1FAE5",
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
