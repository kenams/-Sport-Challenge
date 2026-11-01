import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme";
import type { ChallengeFormat } from "../../domain/types";

type Props = { format: ChallengeFormat };

/** Règles exactes du format (version affichée) : amplitude, cadrage, condition de réussite. */
export default function RulesCard({ format }: Props) {
  return (
    <View style={styles.card} accessible accessibilityLabel={`Règles du format ${format.label_fr}`}>
      <Text style={styles.title}>{format.label_fr}</Text>
      <Text style={styles.version}>Règles version {format.rules_version}</Text>
      <Text style={styles.heading}>Mouvement</Text>
      <Text style={styles.body}>{format.rules_fr}</Text>
      <Text style={styles.heading}>Cadrage de la vidéo</Text>
      <Text style={styles.body}>{format.framing_fr}</Text>
      <Text style={styles.heading}>Score retenu</Text>
      <Text style={styles.body}>{format.success_fr}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, gap: 6 },
  title: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  version: { color: COLORS.textMuted, fontSize: 12 },
  heading: { color: COLORS.primary, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginTop: 8 },
  body: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
});
