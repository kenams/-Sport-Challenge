// src/theme.ts

export const COLORS = {
  // Aggressive / metallic base theme
  background: "#07070A",
  surface: "#0D0F12",
  card: "#111316",
  text: "#F4F6F8",
  textMuted: "#9EA3A6",
  border: "rgba(255,255,255,0.06)",
  primary: "#FF3B30", // neon red
  accent: "#FF6B00", // neon orange
  success: "#34D399",
  danger: "#F87171",

  // Supporting vivid accents
  neonYellow: "#FACC15",
  neonCyan: "#06B6D4",
  neonPurple: "#A855F7",
  neonPink: "#EC4899",
  neonBlue: "#0EA5E9",
  neonGreen: "#10B981",
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
    background: "#0E1116",
    card: "#1A1E26",
    border: "#4B5563",
    accent: "#9CA3AF",
    text: "#F3F4F6",
  },
  run: {
    background: "#0E1116",
    card: "#1A1E26",
    border: "#4B5563",
    accent: "#9CA3AF",
    text: "#F3F4F6",
  },
  course: {
    background: "#0E1116",
    card: "#1A1E26",
    border: "#4B5563",
    accent: "#9CA3AF",
    text: "#F3F4F6",
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

// Metallic / greyscale palette for login or special screens
export const METAL_PALETTE = {
  background: "#1F2226",
  surface: "#232629",
  card: "#2B2F33",
  text: "#E6E9EB",
  textMuted: "#9EA3A6",
  border: "rgba(190,195,200,0.12)",
  primary: "#B0B6BA",
  accent: "#A7AEB3",
};

export const getSportPalette = (sport?: string): SportPalette => {
  if (!sport) return SPORT_PALETTES.default;
  const normalized = sport.toLowerCase().trim();
  return SPORT_PALETTES[normalized] || SPORT_PALETTES.default;
};
