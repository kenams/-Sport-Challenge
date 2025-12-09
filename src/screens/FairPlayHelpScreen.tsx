// src/screens/FairPlayHelpScreen.tsx
import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS } from "../theme";
import AppButton from "../components/AppButton";
import SectionHeader from "../components/SectionHeader";
import InfoCard from "../components/InfoCard";

const TIPS = [
  {
    id: 1,
    icon: "🎥",
    title: "Preuves Vidéo",
    description: "Upload des vidéos nettes, cadrées et complètes. Pas de coupure ni d'accélération.",
    color: COLORS.cyan,
  },
  {
    id: 2,
    icon: "⚖️",
    title: "Résoudre les Punitions",
    description: "Les punitions actives bloquent ton fair-play. Résous-les pour regagner +10.",
    color: COLORS.yellow,
  },
  {
    id: 3,
    icon: "🏆",
    title: "Respecter les Mises",
    description: "Annonce clairement les règles et respecte le nombre de répétitions convenu.",
    color: COLORS.green,
  },
  {
    id: 4,
    icon: "💬",
    title: "Répondre aux Reports",
    description: "Explique ta version ou propose une revanche filmée pour clarifier les doutes.",
    color: COLORS.purple,
  },
  {
    id: 5,
    icon: "🎯",
    title: "Arena Fair-Play",
    description: "Maintiens un score ≥60 pour accéder à Arena Live et ses récompenses spéciales.",
    color: COLORS.orange,
  },
];

const SCORE_RULES = [
  { label: "Vidéo validée", points: "+3", color: COLORS.green },
  { label: "Punition résolue", points: "+5", color: COLORS.blue },
  { label: "Défi complété", points: "+1", color: COLORS.yellow },
  { label: "Report non prouvé", points: "-2", color: COLORS.danger },
];

export default function FairPlayHelpScreen({ navigation }: any) {
  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroEmoji}>⭐</Text>
          <Text style={styles.heroTitle}>Ton Fair-Play</Text>
          <Text style={styles.heroSubtitle}>
            Maintiens ta réputation pour accéder à tous les modes de jeu
          </Text>
        </View>

        {/* Tips Section */}
        <SectionHeader
          title="Comment Progresser"
          subtitle="5 actions pour être crédible"
          icon="📈"
          color={COLORS.primary}
        />

        {TIPS.map((tip) => (
          <InfoCard
            key={tip.id}
            icon={tip.icon}
            title={tip.title}
            description={tip.description}
            color={tip.color}
            backgroundColor={`${tip.color}10`}
          />
        ))}

        {/* Scoring Rules */}
        <SectionHeader
          title="Système de Points"
          subtitle="Comment ton score change"
          icon="🔢"
          color={COLORS.blue}
        />

        {SCORE_RULES.map((rule, idx) => (
          <View key={idx} style={styles.scoreCard}>
            <Text style={[styles.scoreLabel, { color: rule.color }]}>
              ● {rule.label}
            </Text>
            <Text style={[styles.scorePoints, { color: rule.color }]}>
              {rule.points}
            </Text>
          </View>
        ))}

        {/* Threshold Info */}
        <View style={styles.thresholdCard}>
          <Text style={styles.thresholdEmoji}>🚨</Text>
          <Text style={styles.thresholdTitle}>Score Minimum: 60</Text>
          <Text style={styles.thresholdDesc}>
            Ton fair-play doit rester ≥ 60 pour utiliser Arena Live et accéder
            aux modes compétitifs.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonsSection}>
          <AppButton
            label="Voir mes Punitions"
            onPress={() => navigation.navigate("Punishment")}
            variant="accent"
          />
          <AppButton
            label="Fermer"
            onPress={() => navigation.goBack()}
            variant="ghost"
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroSection: {
    marginHorizontal: 16,
    marginVertical: 20,
    padding: 24,
    backgroundColor: `${COLORS.primary}15`,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: `${COLORS.primary}40`,
    alignItems: "center",
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  scoreCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  scorePoints: {
    fontSize: 16,
    fontWeight: "700",
  },
  thresholdCard: {
    marginHorizontal: 16,
    marginVertical: 20,
    padding: 20,
    backgroundColor: `${COLORS.danger}10`,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: `${COLORS.danger}40`,
    alignItems: "center",
  },
  thresholdEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },
  thresholdTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.danger,
    marginBottom: 8,
  },
  thresholdDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  buttonsSection: {
    marginHorizontal: 16,
    marginTop: 20,
    gap: 12,
  },
});

        <Text
          style={{
            color: COLORS.textMuted,
            fontSize: 12,
            marginBottom: 20,
          }}
        >
          Bonus : laisse un admin vérifier tes preuves sur Discord pour un boost
          express (+5).
        </Text>

        <AppButton label="Retour" variant="ghost" onPress={() => navigation.goBack()} />
      </ScrollView>
    </ScreenContainer>
  );
}
