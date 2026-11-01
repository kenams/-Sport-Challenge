import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme";

type Props = { title: string; description: string; locked: boolean; lockedText?: string; badge?: string; children?: React.ReactNode };

/** Bloc d'avantage Pro. Verrouillé : dit honnêtement ce qu'il apporterait, sans afficher de fausses données. */
export default function ProBlock({ title, description, locked, lockedText, badge, children }: Props) {
  return (
    <View style={[styles.card, locked ? styles.cardLocked : null]}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <View style={[styles.pill, locked ? styles.pillLocked : styles.pillOn]} accessible accessibilityLabel={badge ?? (locked ? "Réservé aux membres Pro" : "Inclus dans ton abonnement Pro")}>
          <Text style={[styles.pillText, { color: locked ? COLORS.textMuted : COLORS.primary }]}>{badge ?? (locked ? "Verrouillé · Pro" : "Pro actif")}</Text>
        </View>
      </View>
      <Text style={styles.desc}>{description}</Text>
      {locked ? <Text style={styles.lock}>{lockedText ?? "Disponible avec IMMORTAL Pro."}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, gap: 10 },
  cardLocked: { opacity: 0.92 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  title: { color: COLORS.text, fontSize: 16, fontWeight: "800", flexShrink: 1 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pillOn: { backgroundColor: "rgba(212,175,55,0.16)" },
  pillLocked: { backgroundColor: "rgba(162,163,168,0.14)" },
  pillText: { fontSize: 11, fontWeight: "800" },
  desc: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  lock: { color: COLORS.text, fontSize: 13, lineHeight: 18, padding: 10, borderRadius: 10, backgroundColor: COLORS.surface },
});
