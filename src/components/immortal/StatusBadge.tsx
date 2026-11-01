import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme";
import { STATUS_INFO } from "../../domain/formats";
import type { AttemptStatus } from "../../domain/types";

const TONES = {
  muted: { bg: "rgba(162,163,168,0.14)", fg: COLORS.textMuted },
  warning: { bg: "rgba(250,204,21,0.14)", fg: "#FACC15" },
  success: { bg: "rgba(52,211,153,0.14)", fg: COLORS.success },
  danger: { bg: "rgba(239,68,68,0.16)", fg: "#F87171" },
} as const;

type Props = { status: AttemptStatus; compact?: boolean };

/** Statut d'une performance : toujours lisible, jamais seulement une couleur. */
export default function StatusBadge({ status, compact }: Props) {
  const info = STATUS_INFO[status];
  const tone = TONES[info.tone];
  return (
    <View
      accessible
      accessibilityLabel={`Statut : ${info.label}`}
      style={[styles.badge, { backgroundColor: tone.bg }, compact ? styles.compact : null]}
    >
      <Text style={[styles.text, { color: tone.fg }, compact ? styles.textCompact : null]}>{info.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  compact: { paddingHorizontal: 8, paddingVertical: 4 },
  text: { fontSize: 12, fontWeight: "800" },
  textCompact: { fontSize: 11 },
});
