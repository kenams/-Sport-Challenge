import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text } from "react-native";
import { COLORS } from "../../theme";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  busy?: boolean;
  disabled?: boolean;
  selected?: boolean;
  accessibilityHint?: string;
};

/** Bouton d'action des écrans d'événements : zone tactile >= 48 px, rôle et état exposés, focus visible sur le web. */
export default function EventAction({ label, onPress, variant = "primary", busy, disabled, selected, accessibilityHint }: Props) {
  const off = disabled || busy;
  const fg = variant === "primary" ? "#0B0B0B" : variant === "danger" ? "#F87171" : COLORS.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!busy, selected: !!selected }}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" ? styles.primary : variant === "danger" ? styles.danger : styles.ghost,
        selected ? styles.selected : null,
        off ? styles.off : null,
        pressed ? { opacity: 0.8 } : null,
        Platform.OS === "web" ? ({ cursor: off ? "not-allowed" : "pointer" } as any) : null,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.label, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: COLORS.primary },
  ghost: { borderWidth: 1, borderColor: "rgba(212,175,55,0.5)", backgroundColor: "rgba(212,175,55,0.08)" },
  danger: { borderWidth: 1, borderColor: "rgba(239,68,68,0.5)", backgroundColor: "rgba(239,68,68,0.08)" },
  selected: { borderWidth: 2, borderColor: COLORS.primary },
  off: { opacity: 0.5 },
  label: { fontSize: 14, fontWeight: "800", letterSpacing: 0.8, textAlign: "center" },
});
