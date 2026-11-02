// src/screens/OnboardingScreen.tsx — 3 écrans honnêtes, sans promesse inexistante.
import React, { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FontAwesome5 } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, TYPO } from "../theme";
import LogoMark from "../components/LogoMark";
import ActionButton from "../components/immortal/ActionButton";

const ONBOARDING_KEY = "immortal_onboarding_seen";
const DEMO_URL = "https://immortal-kah-demo.vercel.app/";

export async function markOnboardingSeen() {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // Le stockage local peut être indisponible : l'onboarding sera simplement reproposé.
  }
}

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "1";
  } catch {
    return false;
  }
}

const SLIDES = [
  {
    key: "challenge",
    icon: "video",
    kicker: "Le principe",
    title: "Défie tes amis en vidéo",
    body: "Filme une série de pompes (60 secondes) ou de tractions (maximum strict), puis lance un défi. Tes amis te répondent avec leur propre vidéo.",
    points: ["Deux épreuves : pompes et tractions", "Des règles claires, affichées avant de filmer"],
  },
  {
    key: "validation",
    icon: "user-check",
    kicker: "La règle du jeu",
    title: "Un humain valide chaque performance",
    body: "Le score que tu annonces est un score déclaré. Un modérateur regarde la vidéo, puis valide un score retenu ou rejette avec un motif.",
    points: ["En attente : ça ne compte pas encore", "Seules les performances validées entrent dans les records"],
  },
  {
    key: "records",
    icon: "trophy",
    kicker: "Les records",
    title: "Ta ville, ta région, ton pays, le monde",
    body: "Les classements reposent sur le territoire que tu déclares. Il n'est pas vérifié. À score égal, celui qui l'a réalisé le premier passe devant.",
    points: ["Un record par épreuve et par territoire", "Le titre reste à son détenteur jusqu'à ce qu'un score validé le dépasse"],
  },
] as const;

export default function OnboardingScreen({ navigation }: any) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  const openDemo = () => {
    void Linking.openURL(DEMO_URL).catch(() => undefined);
  };

  const finish = async () => {
    await markOnboardingSeen();
    navigation?.replace("Login");
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <LogoMark size={36} />
        <ActionButton label="Passer" variant="link" onPress={finish} accessibilityLabel="Passer la présentation" />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <View style={styles.iconWrap} accessible={false}>
            <FontAwesome5 name={slide.icon} size={34} color={COLORS.primary} />
          </View>
          <Text style={styles.kicker}>{slide.kicker}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {slide.title}
          </Text>
          <Text style={styles.body}>{slide.body}</Text>
          <View style={styles.points}>
            {slide.points.map((point) => (
              <View key={point} style={styles.point}>
                <FontAwesome5 name="check" size={12} color={COLORS.primary} style={{ marginTop: 4 }} />
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.dots} accessibilityLabel={`Étape ${index + 1} sur ${SLIDES.length}`} accessible>
          {SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === index ? styles.dotOn : null]} />
          ))}
        </View>
        <View style={styles.footerButtons}>
          {index > 0 ? <ActionButton label="Retour" variant="ghost" onPress={() => setIndex(index - 1)} style={{ flex: 1 }} /> : null}
          <ActionButton label={last ? "Commencer" : "Suivant"} onPress={() => (last ? finish() : setIndex(index + 1))} style={{ flex: 2 }} />
        </View>
        <ActionButton label="Voir la démo interactive · sans compte" variant="link" onPress={openDemo} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 20 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingVertical: 24 },
  column: { width: "100%", maxWidth: 480, alignSelf: "center", gap: 14 },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(212,175,55,0.12)", borderWidth: 1, borderColor: "rgba(212,175,55,0.4)" },
  kicker: { ...TYPO.subtitle, color: COLORS.primary },
  title: { color: COLORS.text, fontSize: 28, fontWeight: "900", lineHeight: 34 },
  body: { color: COLORS.textMuted, fontSize: 16, lineHeight: 24 },
  points: { gap: 10, marginTop: 6 },
  point: { flexDirection: "row", gap: 10 },
  pointText: { flex: 1, color: COLORS.text, fontSize: 15, lineHeight: 22 },
  footer: { width: "100%", maxWidth: 480, alignSelf: "center", gap: 16, paddingBottom: 16 },
  dots: { flexDirection: "row", gap: 8, justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)" },
  dotOn: { width: 24, backgroundColor: COLORS.primary },
  footerButtons: { flexDirection: "row", gap: 12 },
});
