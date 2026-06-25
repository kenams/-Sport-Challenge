// src/screens/FairPlayHelpScreen.tsx
import React from "react";
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";
import AppButton from "../components/AppButton";

const tips = [
  {
    title: "Valider tes preuves vidéo",
    description:
      "Upload des vidéos nettes, cadrées et complètes. Pas de coupure ni d'effet accéléré.",
  },
  {
    title: "Finaliser tes punitions",
    description:
      "Les punitions actives bloquent ton fair-play. Résous-les avec un admin ou via l'app pour regagner +10.",
  },
  {
    title: "Respecter les mises",
    description:
      "Annoncer clairement les règles de la pyramide et respecter le nombre de répétitions.",
  },
  {
    title: "Répondre aux reports",
    description:
      "Explique ta version en commentaire ou propose une revanche filmée pour calmer les doutes.",
  },
];

export default function FairPlayHelpScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const isTiny = width < 420;
  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Text style={[styles.pageTitle, isTiny && styles.pageTitleTiny]}>
          Regagner ton fair-play
        </Text>
        <Text style={styles.pageSubtitle}>
          Chaque action positive te rend crédible. Combine ces étapes pour
          rouvrir l'accès Arena.
        </Text>

        {tips.map((tip) => (
          <View
            key={tip.title}
            style={{
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 18,
              padding: 16,
              marginBottom: 14,
              backgroundColor: COLORS.surface,
            }}
          >
            <Text style={styles.tipTitle}>
              {tip.title}
            </Text>
            <Text style={styles.tipText}>
              {tip.description}
            </Text>
          </View>
        ))}

        <Text style={styles.note}>
          Bonus : laisse un admin vérifier tes preuves sur Discord pour un boost
          express (+5).
        </Text>

        <AppButton label="Retour" variant="ghost" onPress={() => navigation.goBack()} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    ...TYPO.display,
    color: COLORS.text,
    marginBottom: 12,
  },
  pageTitleTiny: {
    fontSize: 24,
    lineHeight: 30,
  },
  pageSubtitle: {
    ...TYPO.subtitle,
    color: COLORS.textMuted,
    marginBottom: 18,
  },
  tipTitle: {
    ...TYPO.title,
    color: COLORS.text,
    marginBottom: 6,
  },
  tipText: {
    ...TYPO.body,
    color: COLORS.textMuted,
  },
  note: {
    ...TYPO.subtitle,
    color: COLORS.textMuted,
    marginBottom: 20,
  },
});