// src/screens/ArenaHistoryScreen.tsx
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";
import AppButton from "../components/AppButton";

const KICKER = "HISTORIQUE";
const TITLE = "Historique arene";
const SUBTITLE = "Toutes les battles terminees et leurs resultats.";
const CTA_PRIMARY = "Action";
const CTA_SECONDARY = "Voir plus";

const STATS = [{"label": "Battles", "value": "48"}, {"label": "Victoires", "value": "31"}, {"label": "Fair-play", "value": "92%"}];
const SECTIONS = [{"title": "Dernieres confrontations", "subtitle": "Resume des duels recents.", "items": [{"title": "Kah Alpha vs Maya Flash", "meta": "Sprint 100m ? 2 jours", "value": "Victoire"}, {"title": "Noah Sprint vs Zara Wave", "meta": "Tractions ? 4 jours", "value": "Defaite"}, {"title": "Lina Force vs Jade Spark", "meta": "Pompes ? 6 jours", "value": "Victoire"}]}];

export default function ArenaHistoryScreen() {
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>{KICKER}</Text>
          <Text style={styles.title}>{TITLE}</Text>
          <Text style={styles.subtitle}>{SUBTITLE}</Text>
          <View style={styles.statsRow}>
            {STATS.map((item) => (
              <View key={item.label} style={styles.statCard}>
                <Text style={styles.statValue}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.actions}>
            <AppButton label={CTA_PRIMARY} size="sm" onPress={() => {}} />
            <AppButton label={CTA_SECONDARY} size="sm" variant="ghost" onPress={() => {}} />
          </View>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
            <View style={styles.cardGrid}>
              {section.items.map((item, idx) => (
                <View key={section.title + "-" + idx} style={styles.card}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardMeta}>{item.meta}</Text>
                  <Text style={styles.cardValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
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
  statsRow: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 140,
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
  actions: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  section: { marginBottom: 18 },
  sectionTitle: {
    ...TYPO.title,
    color: COLORS.text,
  },
  sectionSubtitle: {
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 10,
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    flex: 1,
    minWidth: 220,
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
    fontSize: 13,
    color: COLORS.primary,
    marginTop: 8,
    fontWeight: "700",
  },
});
