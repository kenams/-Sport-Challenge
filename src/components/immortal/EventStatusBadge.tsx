import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme";
import { eventStatusInfo, type EventTone } from "../../screens/helpers/eventStatus";

const TONES: Record<EventTone, { bg: string; fg: string }> = {
  muted: { bg: "rgba(162,163,168,0.14)", fg: COLORS.textMuted },
  warning: { bg: "rgba(250,204,21,0.14)", fg: "#FACC15" },
  success: { bg: "rgba(52,211,153,0.14)", fg: COLORS.success },
  danger: { bg: "rgba(239,68,68,0.16)", fg: "#F87171" },
  gold: { bg: "rgba(212,175,55,0.16)", fg: COLORS.primary },
};

/** Statut d'un événement : libellé toujours écrit, jamais seulement une couleur. */
export default function EventStatusBadge({ status }: { status: string }) {
  const info = eventStatusInfo(status);
  const tone = TONES[info.tone];
  return (
    <View accessible accessibilityLabel={`Statut : ${info.label}`} style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{info.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  text: { fontSize: 12, fontWeight: "800" },
});
