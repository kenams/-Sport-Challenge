// src/screens/LiveHubScreen.tsx
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";
import AppButton from "../components/AppButton";

const EVENTS = [
  { title: "Sprint duel", meta: "Vendredi 20:00", value: "Qualifies" },
  { title: "Squats clash", meta: "Dimanche 18:00", value: "Qualifs" },
];

export default function LiveHubScreen() {
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>LIVE HUB</Text>
          <Text style={styles.title}>Arena live</Text>
          <Text style={styles.subtitle}>Tout ce qui concerne les lives hebdo.</Text>
          <View style={styles.actions}>
            <AppButton label="Voir planning" size="sm" onPress={() => {}} />
            <AppButton label="Se qualifier" size="sm" variant="ghost" onPress={() => {}} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prochains lives</Text>
          <Text style={styles.sectionSubtitle}>Prepare ta session.</Text>
          {EVENTS.map((item, idx) => (
            <View key={`event-${idx}`} style={styles.card}>
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
  actions: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    ...TYPO.title,
    color: COLORS.text,
  },
  sectionSubtitle: {
    color: COLORS.textMuted,
    marginBottom: 10,
  },
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: COLORS.surface,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
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
