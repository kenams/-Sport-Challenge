import React from "react";
import { ActivityIndicator, Platform, StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from "react-native";
import { COLORS } from "../../theme";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger" | "link";
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/** Bouton accessible : zone tactile >= 44 px, rôle, état désactivé/chargement annoncés. */
export default function ActionButton({ label, onPress, variant = "primary", loading, disabled, accessibilityLabel, accessibilityHint, style }: Props) {
  const inactive = !!disabled || !!loading;
  const palette = PALETTE[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: !!loading }}
      style={[
        styles.base,
        variant === "link" ? styles.link : null,
        { backgroundColor: palette.bg, borderColor: palette.border },
        disabled ? { opacity: 0.5 } : null,
        Platform.OS === "web" ? ({ cursor: inactive ? "default" : "pointer" } as object) : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.label, { color: palette.fg }, variant === "link" ? styles.linkLabel : null]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const PALETTE = {
  primary: { bg: COLORS.primary, border: "rgba(255,255,255,0.12)", fg: "#0B0B0B" },
  ghost: { bg: "rgba(212,175,55,0.08)", border: "rgba(212,175,55,0.5)", fg: COLORS.primary },
  danger: { bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.55)", fg: "#F87171" },
  link: { bg: "transparent", border: "transparent", fg: COLORS.primary },
} as const;

const styles = StyleSheet.create({
  base: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  link: { minHeight: 44, paddingHorizontal: 8 },
  label: { fontSize: 14, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", textAlign: "center" },
  linkLabel: { textTransform: "none", letterSpacing: 0, fontSize: 14, textDecorationLine: "underline" },
});
