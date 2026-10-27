// src/screens/OnboardingScreen.tsx
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FontAwesome5 } from "@expo/vector-icons";
import { COLORS, TYPO } from "../theme";
import LogoMark from "../components/LogoMark";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = Math.min(SCREEN_W - 48, 420);

const SLIDES = [
  {
    key: "arena",
    icon: "fire",
    color: "#D4AF37",
    kicker: "BIENVENUE",
    title: "L'ARÈNE",
    subtitle: "Rejoins la ligue des performances vidéo.",
    body: "IMMORTAL ARENA est le terrain où les athlètes se défient, se mesurent et progressent. Chaque défi est une opportunité de montrer ton niveau.",
    detail: ["Défis vidéo vérifiés", "Classement en temps réel", "Communauté elite"],
  },
  {
    key: "challenges",
    icon: "dumbbell",
    color: "#60A5FA",
    kicker: "LES DÉFIS",
    title: "PARTICIPER",
    subtitle: "Lance ou relève un défi en 3 étapes.",
    body: "Choisis un défi parmi les disciplines disponibles. Filme ta performance, soumets ta vidéo. L'IA et la communauté votent pour valider.",
    detail: ["Film ta perf", "Vote communautaire", "Validation IA"],
  },
  {
    key: "coins",
    icon: "coins",
    color: "#34D399",
    kicker: "LES RÉCOMPENSES",
    title: "LES COINS",
    subtitle: "Gagne des coins, monte en niveau.",
    body: "Chaque victoire, vote et participation te rapporte des XP et des coins. Utilise-les dans la boutique pour booster ton profil et défier l'arène.",
    detail: ["XP & niveaux", "Bonus quotidien", "Shop exclusif"],
  },
];

const ONBOARDING_KEY = "immortal_onboarding_seen";

export async function markOnboardingSeen() {
  await AsyncStorage.setItem(ONBOARDING_KEY, "1");
}

export async function hasSeenOnboarding(): Promise<boolean> {
  const val = await AsyncStorage.getItem(ONBOARDING_KEY);
  return val === "1";
}

export default function OnboardingScreen({ navigation }: any) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      handleDone();
    }
  };

  const handleDone = async () => {
    await markOnboardingSeen();
    navigation?.replace("Login");
  };

  const handleSkip = async () => {
    await markOnboardingSeen();
    navigation?.replace("Login");
  };

  const slide = SLIDES[currentIndex];

  return (
    <View style={styles.root}>
      {/* Background glow */}
      <View style={[styles.glow, { backgroundColor: slide.color + "18" }]} />

      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
        <Text style={styles.skipText}>Passer</Text>
        <FontAwesome5 name="chevron-right" size={10} color={COLORS.textMuted} />
      </TouchableOpacity>

      {/* Logo */}
      <View style={styles.logoWrap}>
        <LogoMark size={52} />
      </View>

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        scrollEnabled={false}
        getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          setCurrentIndex(idx);
        }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: SCREEN_W }]}>
            <View style={[styles.card, { width: CARD_W, borderColor: item.color + "44" }]}>
              <View style={[styles.iconCircle, { backgroundColor: item.color + "20", borderColor: item.color + "55" }]}>
                <FontAwesome5 name={item.icon as any} size={32} color={item.color} />
              </View>
              <Text style={styles.kicker}>{item.kicker}</Text>
              <Text style={[styles.title, { color: item.color }]}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <View style={styles.detailList}>
                {item.detail.map((d: string) => (
                  <View key={d} style={styles.detailItem}>
                    <FontAwesome5 name="check" size={10} color={item.color} />
                    <Text style={[styles.detailText, { color: item.color }]}>{d}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((s, i) => (
          <View
            key={s.key}
            style={[
              styles.dot,
              i === currentIndex
                ? { backgroundColor: SLIDES[currentIndex].color, width: 20 }
                : { backgroundColor: "rgba(255,255,255,0.2)", width: 6 },
            ]}
          />
        ))}
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[styles.cta, { backgroundColor: slide.color }]}
        onPress={goNext}
        activeOpacity={0.85}
      >
        <Text style={styles.ctaText}>
          {currentIndex < SLIDES.length - 1 ? "Suivant" : "Entrer dans l'arène"}
        </Text>
        <FontAwesome5
          name={currentIndex < SLIDES.length - 1 ? "arrow-right" : "fire"}
          size={14}
          color="#000"
        />
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>KAH Digital Studio · IMMORTAL-K</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 32,
  },
  glow: {
    position: "absolute",
    top: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  skipBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 36,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  skipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  logoWrap: { marginBottom: 8 },
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 28, borderWidth: 1,
    backgroundColor: "rgba(14,14,18,0.95)",
    padding: 28, alignItems: "center", gap: 10,
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 24, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  kicker: { fontSize: 10, letterSpacing: 3, color: COLORS.textMuted, fontWeight: "700" },
  title: { fontSize: 28, fontWeight: "900", letterSpacing: 2, textAlign: "center" },
  subtitle: { color: COLORS.text, fontSize: 14, fontWeight: "700", textAlign: "center", lineHeight: 20 },
  body: { color: COLORS.textMuted, fontSize: 13, textAlign: "center", lineHeight: 19, marginTop: 4 },
  detailList: { flexDirection: "row", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 8 },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  detailText: { fontSize: 11, fontWeight: "700" },
  dotsRow: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 20, marginBottom: 20 },
  dot: { height: 6, borderRadius: 3 },
  cta: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16,
    width: Math.min(SCREEN_W - 48, 340),
    justifyContent: "center",
  },
  ctaText: { color: "#000", fontWeight: "900", fontSize: 15, letterSpacing: 1 },
  footer: { marginTop: 16 },
  footerText: { color: COLORS.textMuted, fontSize: 10, letterSpacing: 1.5 },
});
