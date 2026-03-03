// src/screens/RankingScreen.tsx
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";

const RANKS = [
  { title: "Kah Alpha", meta: "Niveau 8", value: "1240 pts" },
  { title: "Maya Flash", meta: "Niveau 7", value: "980 pts" },
  { title: "Noah Sprint", meta: "Niveau 6", value: "860 pts" },
];

export default function RankingScreen() {
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>RANKING</Text>
          <Text style={styles.title}>Classement global</Text>
          <Text style={styles.subtitle}>Vue rapide des meilleurs joueurs.</Text>
        </View>
        <View style={styles.section}>
          {RANKS.map((item, index) => (
            <View key={`rank-${index}`} style={styles.card}>
              <Text style={styles.rank}>#{index + 1}</Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>{item.meta}</Text>
              <Text style={styles.cardValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 80 },
  hero: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    backgroundColor: "rgba(12,12,16,0.92)",
    marginBottom: 18,
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
  section: {
    gap: 12,
  },
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: COLORS.surface,
  },
  rank: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.primary,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 4,
  },
  cardMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  cardValue: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 6,
    fontWeight: "700",
  },
});
