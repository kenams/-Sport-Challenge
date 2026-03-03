// src/screens/NotificationsScreen.tsx
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";

const ITEMS = [
  { title: "Nouveau vote", meta: "Kah Alpha a vote", value: "Il y a 2h" },
  { title: "Nouveau commentaire", meta: "Maya Flash a commente", value: "Il y a 5h" },
  { title: "Challenge valide", meta: "Pompes explosives", value: "Hier" },
];

export default function NotificationsScreen() {
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>NOTIFICATIONS</Text>
          <Text style={styles.title}>Alertes et actualites</Text>
          <Text style={styles.subtitle}>Reste au courant des actions importantes.</Text>
        </View>
        <View style={styles.section}>
          {ITEMS.map((item, index) => (
            <View key={`notif-${index}`} style={styles.card}>
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
