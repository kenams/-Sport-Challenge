// src/screens/PublicTopVotesScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import VideoPlayer from "../components/VideoPlayer";
import { COLORS, TYPO } from "../theme";
import AppButton from "../components/AppButton";
import { useNavigation } from "@react-navigation/native";

type PublicVoteItem = {
  response_id: number;
  challenge_id: number;
  votes: number;
  video_url: string;
  created_at: string;
  responder_pseudo: string;
  challenge_title: string;
  sport: string;
};

type Props = {
  route?: { params?: { challengeId?: number } };
};

export default function PublicTopVotesScreen({ route }: Props) {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isCompact = Platform.OS !== "web" || width < 640;
  const isNarrow = width < 520;
  const isTiny = width < 420;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PublicVoteItem[]>([]);
  const [days, setDays] = useState(30);
  const [limit, setLimit] = useState(10);
  const challengeId =
    Number(route?.params?.challengeId ?? 0) ||
    (typeof window !== "undefined"
      ? Number(new URLSearchParams(window.location.search).get("challenge_id") ?? 0)
      : 0);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
      if (!baseUrl) {
        setItems([]);
        return;
      }
      const params = new URLSearchParams({
        limit: String(limit),
        days: String(days),
      });
      if (challengeId) {
        params.set("challenge_id", String(challengeId));
      }
      const url = `${baseUrl}/functions/v1/public-top-votes?${params.toString()}`;
      const res = await fetch(url);
      const json = await res.json();
      setItems((json?.items as PublicVoteItem[]) || []);
    } catch (err) {
      console.log("PUBLIC TOP VOTES LOAD ERROR", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [challengeId, days, limit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.subtle}>Chargement des tops...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.hero, isNarrow && styles.heroCompact]}>
          <View style={styles.heroGlow} />
          <View style={[styles.heroHeader, isNarrow && styles.heroHeaderStack]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>VOTE PUBLIC</Text>
              <Text style={[styles.title, isNarrow && styles.titleCompact]}>
                {challengeId ? `Top votes - Défi #${challengeId}` : "Top votes"}
              </Text>
            </View>
            <AppButton label="Retour" size="sm" variant="ghost" onPress={() => navigation.goBack()} />
          </View>
          <Text style={[styles.subtle, isNarrow && styles.subtleCompact]}>
            Les réponses les plus votées du moment.
          </Text>
          <View style={[styles.heroRow, isTiny && styles.heroRowCompact]}>
            <View style={[styles.heroStat, isTiny && styles.heroStatCompact]}>
              <Text style={styles.heroStatValue}>{items.length}</Text>
              <Text style={styles.heroStatLabel}>Vidéos</Text>
            </View>
            <View style={[styles.heroStat, isTiny && styles.heroStatCompact]}>
              <Text style={styles.heroStatValue}>{days}</Text>
              <Text style={styles.heroStatLabel}>Jours</Text>
            </View>
            <View style={[styles.heroStat, isTiny && styles.heroStatCompact]}>
              <Text style={styles.heroStatValue}>{limit}</Text>
              <Text style={styles.heroStatLabel}>Top</Text>
            </View>
          </View>
          <View style={[styles.filterRow, isTiny && styles.filterRowCompact]}>
            {[7, 30, 90, 365].map((value) => (
              <TouchableOpacity
                key={`days-${value}`}
                onPress={() => setDays(value)}
                style={styles.filterChipWrap}
              >
                <Text
                  style={[
                    styles.filterChip,
                    isTiny && styles.filterChipCompact,
                    days === value && styles.filterChipActive,
                  ]}
                >
                  {value === 365 ? "1 an" : `${value} jours`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {items.length === 0 ? (
          <Text style={styles.empty}>Aucun vote public pour le moment.</Text>
        ) : (
          items.map((item, index) => (
            <View
              key={`public-${item.response_id}`}
              style={[styles.card, isNarrow && styles.cardCompact, index === 0 && styles.cardTop]}
            >
              <Text style={styles.rank}>#{index + 1}</Text>
              {index < 3 && (
                <View style={styles.topBadge}>
                  <Text style={styles.topBadgeText}>TOP 3</Text>
                </View>
              )}
              <Text style={styles.cardTitle}>{item.challenge_title}</Text>
              <Text style={styles.cardMeta}>
                {item.responder_pseudo} · {item.sport} · {item.votes} vote(s)
              </Text>
              <View style={styles.videoCard}>
                <VideoPlayer
                  uri={item.video_url}
                  style={{
                    height: isTiny ? 160 : isCompact ? 180 : 200,
                    backgroundColor: "#000",
                  }}
                  nativeControls
                  contentFit="contain"
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    backgroundColor: "rgba(12,12,16,0.92)",
  },
  heroCompact: {
    padding: 14,
    borderRadius: 18,
  },
  heroGlow: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 120,
    backgroundColor: "rgba(212,175,55,0.18)",
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  heroHeaderStack: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.textMuted,
    fontWeight: "700",
  },
  heroRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    flexWrap: "wrap",
  },
  heroRowCompact: {
    gap: 8,
  },
  heroStat: {
    flex: 1,
    minWidth: 110,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: "rgba(3,7,18,0.6)",
  },
  heroStatCompact: {
    minWidth: 100,
    padding: 8,
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
  filterRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterRowCompact: {
    gap: 6,
    marginTop: 10,
  },
  filterChipWrap: {
    borderRadius: 999,
  },
  filterChip: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textMuted,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(8,8,12,0.6)",
  },
  filterChipCompact: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 10,
  },
  filterChipActive: {
    color: COLORS.text,
    borderColor: "rgba(212,175,55,0.7)",
    backgroundColor: "rgba(212,175,55,0.12)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  title: {
    ...TYPO.display,
    color: COLORS.text,
  },
  titleCompact: {
    fontSize: 22,
    letterSpacing: 1.4,
  },
  subtle: {
    ...TYPO.subtitle,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  subtleCompact: {
    fontSize: 11,
    letterSpacing: 1.4,
  },
  empty: {
    color: COLORS.textMuted,
    marginTop: 16,
  },
  card: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.2)",
    backgroundColor: COLORS.surface,
  },
  cardCompact: {
    padding: 12,
  },
  cardTop: {
    borderColor: "rgba(212,175,55,0.75)",
    backgroundColor: "rgba(212,175,55,0.08)",
  },
  topBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.6)",
    backgroundColor: "rgba(212,175,55,0.12)",
  },
  topBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 0.6,
  },
  rank: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.primary,
  },
  cardTitle: {
    ...TYPO.title,
    color: COLORS.text,
    marginTop: 6,
  },
  cardMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  videoCard: {
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
});
