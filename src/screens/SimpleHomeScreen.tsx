// src/screens/SimpleHomeScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { COLORS, TYPO } from "../theme";
import AppButton from "../components/AppButton";
import ChallengeCard from "../components/ChallengeCard";
import { Challenge, UserProfile } from "../types";

const SAMPLE_PROFILES: UserProfile[] = [
  { user_id: "demo-01", pseudo: "Kah Alpha", avatar_url: null, department: "75" },
  { user_id: "demo-02", pseudo: "Maya Flash", avatar_url: null, department: "92" },
  { user_id: "demo-03", pseudo: "Noah Sprint", avatar_url: null, department: "93" },
  { user_id: "demo-04", pseudo: "Lina Force", avatar_url: null, department: "94" },
  { user_id: "demo-05", pseudo: "Zara Wave", avatar_url: null, department: "77" },
  { user_id: "demo-06", pseudo: "Owen Blaze", avatar_url: null, department: "69" },
  { user_id: "demo-07", pseudo: "Nora Heat", avatar_url: null, department: "13" },
  { user_id: "demo-08", pseudo: "Leo Arrow", avatar_url: null, department: "31" },
  { user_id: "demo-09", pseudo: "Eden Rush", avatar_url: null, department: "33" },
  { user_id: "demo-10", pseudo: "Axel Nova", avatar_url: null, department: "44" },
  { user_id: "demo-11", pseudo: "Jade Spark", avatar_url: null, department: "59" },
  { user_id: "demo-12", pseudo: "Iris Volt", avatar_url: null, department: "78" },
];

const SAMPLE_VIDEOS = [
  "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
];

const CHALLENGE_TEMPLATES = [
  { title: "Pompes explosives", description: "50 repetitions propres, torse au sol a chaque rep.", sport: "pushups", target: 50, unit: "reps" },
  { title: "Sprint 100m", description: "Sprint sec, chrono en main. Pas de depart anticipe.", sport: "course", target: 100, unit: "m" },
  { title: "Tractions strictes", description: "10 reps, menton au-dessus de la barre.", sport: "traction", target: 10, unit: "reps" },
  { title: "Tirs francs", description: "10 tirs consecutifs, panier visible.", sport: "basket", target: 10, unit: "tirs" },
  { title: "Squats profonds", description: "40 reps amplitude complete.", sport: "squat", target: 40, unit: "reps" },
  { title: "Nage 200m", description: "Distance complete sans coupure.", sport: "nage", target: 200, unit: "m" },
  { title: "Run 5km", description: "5 km chrono, capture GPS visible.", sport: "running", target: 5, unit: "km" },
  { title: "Dribble slalom", description: "Slalom 6 plots, vitesse et controle.", sport: "foot", target: 6, unit: "plots" },
  { title: "Corde a sauter", description: "200 sauts sans interruption.", sport: "corde", target: 200, unit: "sauts" },
  { title: "Yoga flow", description: "Sequence 6 postures, respiration visible.", sport: "yoga", target: 6, unit: "postures" },
  { title: "MMA combo", description: "10 combos propres, garde stable.", sport: "mma", target: 10, unit: "combos" },
  { title: "Burpees", description: "20 burpees complets, rythme constant.", sport: "fitness", target: 20, unit: "reps" },
];

const SAMPLE_CHALLENGES: Challenge[] = Array.from({ length: 18 }).map((_, index) => {
  const template = CHALLENGE_TEMPLATES[index % CHALLENGE_TEMPLATES.length];
  const owner = SAMPLE_PROFILES[index % SAMPLE_PROFILES.length];
  const suffix = index >= CHALLENGE_TEMPLATES.length ? ` #${index + 1}` : "";
  return {
    id: 101 + index,
    user_id: owner.user_id,
    pseudo: owner.pseudo,
    title: `${template.title}${suffix}`,
    description: template.description,
    sport: template.sport,
    target_value: template.target,
    unit: template.unit,
    video_url: SAMPLE_VIDEOS[index % SAMPLE_VIDEOS.length],
    created_at: new Date(Date.now() - index * 3600 * 1000).toISOString(),
    ranked: true,
  };
});

const DISCIPLINES_COUNT = new Set(SAMPLE_CHALLENGES.map((item) => item.sport)).size;

export default function SimpleHomeScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const columns = isWeb && width >= 1100 ? 2 : 1;
  const [search, setSearch] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setIsAuthed(!!data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setIsAuthed(!!session);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const profileMap = useMemo(() => {
    return new Map(SAMPLE_PROFILES.map((p) => [p.user_id, p]));
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return SAMPLE_CHALLENGES;
    return SAMPLE_CHALLENGES.filter((item) =>
      [item.title, item.description, item.sport].some((value) =>
        String(value).toLowerCase().includes(query)
      )
    );
  }, [search]);

  return (
    <ScreenContainer>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Text style={styles.kicker}>IMMORTAL ARENA</Text>
        <Text style={styles.title}>Performances Studio</Text>
        <Text style={styles.subtitle}>
          Le terrain des performances vidéo. Rapide, propre, certifié.
        </Text>
        <View style={styles.heroRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{SAMPLE_CHALLENGES.length}</Text>
            <Text style={styles.heroStatLabel}>Défis en ligne</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{SAMPLE_PROFILES.length}</Text>
            <Text style={styles.heroStatLabel}>Athlètes</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{DISCIPLINES_COUNT}</Text>
            <Text style={styles.heroStatLabel}>Disciplines</Text>
          </View>
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un défi, un sport, un joueur..."
          placeholderTextColor={COLORS.textMuted}
          style={styles.searchInput}
        />
        {isAuthed ? (
          <AppButton label="Publier" size="sm" onPress={() => navigation?.navigate("Creer")} />
        ) : (
          <View style={styles.authRow}>
            <AppButton
              label="Connexion"
              size="sm"
              variant="ghost"
              onPress={() => navigation?.navigate("Login")}
            />
            <AppButton
              label="Inscription"
              size="sm"
              onPress={() => navigation?.navigate("Register")}
            />
          </View>
        )}
      </View>

      <FlatList
        data={filtered}
        key={columns}
        keyExtractor={(item) => String(item.id)}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={columns > 1 ? styles.gridItem : null}>
            <ChallengeCard
              challenge={item}
              profile={profileMap.get(item.user_id)}
              onPress={() => navigation?.navigate("ChallengeDetail", { id: item.id })}
            />
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucun défi trouvé.</Text>}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: "relative",
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    backgroundColor: "rgba(12,12,16,0.92)",
    marginBottom: 18,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    top: -60,
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 120,
    backgroundColor: "rgba(212,175,55,0.2)",
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
    marginTop: 6,
  },
  heroRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  heroStat: {
    flex: 1,
    minWidth: 140,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: "rgba(3,7,18,0.6)",
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  heroStatLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    minWidth: 220,
    color: COLORS.text,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    backgroundColor: "rgba(8,8,12,0.6)",
  },
  authRow: {
    flexDirection: "row",
    gap: 10,
  },
  list: {
    paddingBottom: 80,
  },
  gridRow: {
    gap: 12,
  },
  gridItem: {
    flex: 1,
  },
  empty: {
    color: COLORS.textMuted,
    marginTop: 10,
  },
});
