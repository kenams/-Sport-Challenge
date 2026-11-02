// src/theme.ts

export const COLORS = {
  background: "#050507",
  surface: "#0E0E12",
  card: "#14151B",
  text: "#F7F5F2",
  textMuted: "#A2A3A8",
  border: "rgba(255,255,255,0.08)",
  primary: "#D4AF37",
  accent: "#B91C1C",
  success: "#34D399",
  danger: "#EF4444",
};

export const TYPO = {
  display: {
    fontSize: 26,
    fontWeight: "900" as const,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  title: {
    fontSize: 18,
    fontWeight: "800" as const,
    letterSpacing: 1.2,
  },
  subtitle: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    fontSize: 14,
    fontWeight: "800" as const,
    letterSpacing: 1.6,
    textTransform: "uppercase" as const,
  },
};
