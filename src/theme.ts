// src/theme.ts

export const COLORS = {
  background: "#080B0F",
  surface: "#10161D",
  card: "#17212A",
  text: "#F5F7F8",
  textMuted: "#A7B1BA",
  border: "rgba(255,255,255,0.09)",
  primary: "#E4BC47",
  accent: "#E97865",
  success: "#48C997",
  danger: "#E16D63",
};

export const TYPO = {
  display: {
    fontSize: 26,
    fontWeight: "900" as const,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
  },
  title: {
    fontSize: 18,
    fontWeight: "800" as const,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    fontSize: 14,
    fontWeight: "800" as const,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
  },
};
