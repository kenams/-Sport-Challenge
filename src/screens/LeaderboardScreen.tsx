// src/screens/LeaderboardScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";
import { supabase } from "../supabase";
import VideoPlayer from "../components/VideoPlayer";

const SAMPLE_LEADERS = [
  { id: "p1", pseudo: "Kah Alpha", points: 1240, level: 8 },
  { id: "p2", pseudo: "Maya Flash", points: 980, level: 7 },
  { id: "p3", pseudo: "Noah Sprint", points: 860, level: 6 },
  { id: "p4", pseudo: "Lina Force", points: 720, level: 5 },
  { id: "p5", pseudo: "Zara Wave", points: 640, level: 5 },
];

export default function LeaderboardScreen() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const columns = isWeb && width >= 1100 ? 2 : 1;
  const [period, setPeriod] = useState("all");
  const [topResponses, setTopResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const periods = useMemo(
    () => [
      { key: "all", label: "Global" },
      { key: "7", label: "7 jours" },
      { key: "30", label: "30 jours" },
    ],
    []
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("challenge_responses")
        .select("id, video_url, created_at, votes, pseudo, challenges(title, sport)")
        .order("votes", { ascending: false })
        .limit(10);
      if (active) {
        setTopResponses(data || []);
        setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [period]);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.kicker}>Classement</Text>
        <Text style={styles.title}>Tableau de chasse</Text>
        <Text style={styles.subtitle}>Suivez les leaders par période et par discipline.</Text>
      </View>

      <View style={styles.periodRow}>
        {periods.map((item) => (
          <Text
            key={item.key}
            onPress={() => setPeriod(item.key)}
            style={[styles.periodChip, period === item.key && styles.periodChipActive]}
          >
            {item.label}
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top performances</Text>
        <Text style={styles.sectionSubtitle}>
          Les soumissions les plus votees du moment.
        </Text>
        {loading ? (
          <Text style={styles.empty}>Chargement...</Text>
        ) : topResponses.length === 0 ? (
          <Text style={styles.empty}>Aucune performance pour le moment.</Text>
        ) : (
          <View style={styles.responseGrid}>
            {topResponses.map((item, index) => (
              <View key={item.id} style={styles.responseCard}>
                <Text style={styles.rank}>#{index + 1}</Text>
                <Text style={styles.cardName}>
                  {item?.challenges?.title || "Defi"}
                </Text>
                <Text style={styles.cardMeta}>
                  {item?.challenges?.sport || "Sport"} - {item.pseudo || "Joueur"}
                </Text>
                <View style={styles.videoCard}>
                  <VideoPlayer
                    uri={item.video_url}
                    style={styles.videoPlayer}
                    contentFit="cover"
                    autoPlay={false}
                    shouldPlay={false}
                    allowUserToggle
                    showControlButton
                  />
                </View>
                <Text style={styles.cardPoints}>{item.votes ?? 0} votes</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <FlatList
        data={SAMPLE_LEADERS}
        key={columns}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
        contentContainerStyle={styles.list}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View style={columns > 1 ? styles.gridItem : null}>
            <View style={styles.card}>
              <Text style={styles.rank}>#{index + 1}</Text>
              <Text style={styles.cardName}>{item.pseudo}</Text>
              <Text style={styles.cardMeta}>Niveau {item.level}</Text>
              <Text style={styles.cardPoints}>{item.points} pts</Text>
            </View>
          </View>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    backgroundColor: "rgba(12,12,16,0.92)",
    marginBottom: 16,
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
  periodRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    ...TYPO.title,
    color: COLORS.text,
  },
  sectionSubtitle: {
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 10,
  },
  empty: {
    color: COLORS.textMuted,
  },
  responseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  responseCard: {
    flex: 1,
    minWidth: 240,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: COLORS.surface,
  },
  videoCard: {
    marginTop: 10,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
  },
  videoPlayer: {
    width: "100%",
    minHeight: 160,
  },
  periodChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    color: COLORS.textMuted,
    fontSize: 11,
  },
  periodChipActive: {
    color: COLORS.text,
    borderColor: "rgba(212,175,55,0.6)",
    backgroundColor: "rgba(212,175,55,0.12)",
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
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: COLORS.surface,
    marginBottom: 12,
  },
  rank: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 6,
  },
  cardMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  cardPoints: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
    marginTop: 8,
  },
});
