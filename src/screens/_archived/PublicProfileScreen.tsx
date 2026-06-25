// src/screens/PublicProfileScreen.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";

export default function PublicProfileScreen() {
  const route = useRoute<any>();
  const userId = route?.params?.userId || "public";

  return (
    <ScreenContainer>
      <View style={styles.card}>
        <Text style={styles.kicker}>Profil public</Text>
        <Text style={styles.title}>Joueur {String(userId).slice(0, 6)}</Text>
        <Text style={styles.subtitle}>
          Profil simplifié pour la navigation publique.
        </Text>
        <View style={styles.row}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>8</Text>
            <Text style={styles.statLabel}>Niveau</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>1240</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Victoires</Text>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    backgroundColor: "rgba(12,12,16,0.92)",
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.textMuted,
    fontWeight: "700",
  },
  title: {
    ...TYPO.display,
    color: COLORS.text,
    marginTop: 6,
  },
  subtitle: {
    ...TYPO.subtitle,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  row: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  stat: {
    flex: 1,
    minWidth: 120,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: "rgba(3,7,18,0.6)",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
});
