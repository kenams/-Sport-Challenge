// src/screens/LeaderboardScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";
import { supabase } from "../supabase";
import UserAvatar from "../components/UserAvatar";
import VideoPlayer from "../components/VideoPlayer";

interface Leader {
  user_id: string;
  points: number;
  level?: number | null;
  title?: string | null;
  fair_play_score?: number | null;
  profiles?: { pseudo?: string | null; avatar_url?: string | null; department?: string | null } | null;
}

interface TopResponse {
  id: number;
  video_url: string;
  votes: number;
  pseudo?: string | null;
  challenges?: { title: string; sport: string } | null;
}

const MEDAL_COLORS = ["#D4AF37", "#A0AEC0", "#C67C3E"];

export default function LeaderboardScreen() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const columns = isWeb && width >= 1100 ? 2 : 1;
  const [tab, setTab] = useState<"players" | "videos">("players");
  const [period, setPeriod] = useState<"all" | "7" | "30">("all");
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [topResponses, setTopResponses] = useState<TopResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaders = useCallback(async () => {
    const { data } = await supabase
      .from("players_stats")
      .select("user_id,points,level,title,fair_play_score,profiles(pseudo,avatar_url,department)")
      .order("points", { ascending: false })
      .limit(20);
    setLeaders((data as unknown as Leader[]) || []);
  }, []);

  const fetchVideos = useCallback(async () => {
    let query = supabase
      .from("challenge_responses")
      .select("id,video_url,votes,pseudo,challenges(title,sport)")
      .order("votes", { ascending: false })
      .limit(10);
    if (period !== "all") {
      const since = new Date(Date.now() - Number(period) * 86400000).toISOString();
      query = query.gte("created_at", since);
    }
    const { data } = await query;
    setTopResponses((data as unknown as TopResponse[]) || []);
  }, [period]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchLeaders(), fetchVideos()]).finally(() => setLoading(false));
  }, [fetchLeaders, fetchVideos]);

  const renderLeader = ({ item, index }: { item: Leader; index: number }) => {
    const prof = item.profiles as any;
    const name = prof?.pseudo || `Joueur ${item.user_id.slice(0, 6)}`;
    const medal = MEDAL_COLORS[index] || null;
    const isTop3 = index < 3;
    return (
      <View style={[styles.leaderCard, isTop3 && { borderColor: medal + "55" }]}>
        <View style={[styles.rankBadge, isTop3 && { backgroundColor: medal + "22", borderColor: medal + "66" }]}>
          {isTop3 ? (
            <FontAwesome5 name="medal" size={14} color={medal!} />
          ) : (
            <Text style={styles.rankText}>#{index + 1}</Text>
          )}
        </View>
        <UserAvatar uri={prof?.avatar_url} label={name} size={44} />
        <View style={styles.leaderInfo}>
          <Text style={styles.leaderName} numberOfLines={1}>{name}</Text>
          <View style={styles.leaderMeta}>
            {item.title && (
              <View style={styles.titlePill}>
                <Text style={styles.titlePillText}>{item.title}</Text>
              </View>
            )}
            {prof?.department && (
              <Text style={styles.deptText}>Dép. {prof.department}</Text>
            )}
          </View>
        </View>
        <View style={styles.leaderRight}>
          <Text style={[styles.leaderPoints, isTop3 && { color: medal! }]}>
            {(item.points || 0).toLocaleString("fr-FR")}
          </Text>
          <Text style={styles.leaderPtsLabel}>pts</Text>
          <Text style={styles.leaderLevel}>Niv. {item.level ?? 1}</Text>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.kicker}>CLASSEMENT</Text>
        <Text style={styles.title}>Tableau de chasse</Text>
        <Text style={styles.subtitle}>Les meilleurs athlètes de l'arène.</Text>
        <View style={styles.podium}>
          {leaders.slice(0, 3).map((l, i) => {
            const prof = l.profiles as any;
            const name = prof?.pseudo || "—";
            const order = [1, 0, 2][i];
            const heights = [100, 120, 80];
            return (
              <View key={l.user_id} style={styles.podiumItem}>
                <UserAvatar uri={prof?.avatar_url} label={name} size={i === 0 ? 44 : 36} />
                <Text style={styles.podiumName} numberOfLines={1}>{name}</Text>
                <View style={[styles.podiumBlock, { height: heights[i], backgroundColor: MEDAL_COLORS[i] + "22", borderColor: MEDAL_COLORS[i] + "55" }]}>
                  <FontAwesome5 name="medal" size={18} color={MEDAL_COLORS[i]} />
                  <Text style={[styles.podiumRank, { color: MEDAL_COLORS[i] }]}>#{i + 1}</Text>
                  <Text style={styles.podiumPts}>{(l.points || 0).toLocaleString("fr-FR")}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Onglets */}
      <View style={styles.tabs}>
        {([["players", "Joueurs", "users"], ["videos", "Top Vidéos", "video"]] as const).map(([key, label, icon]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <FontAwesome5 name={icon as any} size={12} color={tab === key ? "#000" : COLORS.textMuted} />
            <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "videos" && (
        <View style={styles.periodRow}>
          {([["all", "Global"], ["7", "7 jours"], ["30", "30 jours"]] as const).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.periodChip, period === key && styles.periodChipActive]}
              onPress={() => setPeriod(key)}
            >
              <Text style={[styles.periodLabel, period === key && styles.periodLabelActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : tab === "players" ? (
        <FlatList
          data={leaders.slice(3)}
          key={columns}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
          contentContainerStyle={styles.list}
          keyExtractor={(item) => item.user_id}
          renderItem={({ item, index }) =>
            columns > 1 ? (
              <View style={styles.gridItem}>{renderLeader({ item, index: index + 3 })}</View>
            ) : renderLeader({ item, index: index + 3 })}
          ListEmptyComponent={<Text style={styles.empty}>Aucun joueur classé pour le moment.</Text>}
        />
      ) : (
        <FlatList
          data={topResponses}
          contentContainerStyle={styles.list}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={<Text style={styles.empty}>Aucune performance pour le moment.</Text>}
          renderItem={({ item, index }) => {
            const medal = MEDAL_COLORS[index] || null;
            const title = (item.challenges as any)?.title || "Défi";
            const sport = (item.challenges as any)?.sport;
            return (
              <View style={[styles.videoCard, index < 3 && { borderColor: medal! + "55" }]}>
                <View style={styles.videoHeader}>
                  <View style={[styles.rankBadge, index < 3 && { backgroundColor: medal! + "22", borderColor: medal! + "66" }]}>
                    {index < 3 ? <FontAwesome5 name="medal" size={12} color={medal!} /> : <Text style={styles.rankText}>#{index + 1}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.videoTitle} numberOfLines={1}>{title}</Text>
                    <View style={styles.videoMeta}>
                      {sport && <View style={styles.sportPill}><Text style={styles.sportPillText}>{sport.toUpperCase()}</Text></View>}
                      <Text style={styles.videoPseudo}>{item.pseudo || "Joueur"}</Text>
                    </View>
                  </View>
                  <View style={styles.voteBadge}>
                    <FontAwesome5 name="thumbs-up" size={10} color={COLORS.primary} />
                    <Text style={styles.voteCount}>{item.votes ?? 0}</Text>
                  </View>
                </View>
                <VideoPlayer
                  uri={item.video_url}
                  style={{ height: 180, width: "100%" }}
                  contentFit="cover"
                  autoPlay={false}
                  shouldPlay={false}
                  allowUserToggle
                  showControlButton
                />
              </View>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: 18, borderRadius: 20, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)", backgroundColor: "rgba(12,12,16,0.92)", marginBottom: 16,
  },
  kicker: { fontSize: 11, letterSpacing: 3, color: COLORS.textMuted, fontWeight: "700" },
  title: { ...TYPO.display, color: COLORS.text, marginTop: 6 },
  subtitle: { ...TYPO.subtitle, color: COLORS.textMuted, marginTop: 4 },
  podium: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 8, marginTop: 16, minHeight: 140 },
  podiumItem: { alignItems: "center", gap: 4, flex: 1, maxWidth: 100 },
  podiumName: { color: COLORS.text, fontSize: 11, fontWeight: "700", textAlign: "center" },
  podiumBlock: {
    width: "100%", borderRadius: 14, borderWidth: 1,
    alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8,
  },
  podiumRank: { fontSize: 14, fontWeight: "900" },
  podiumPts: { color: COLORS.textMuted, fontSize: 10, fontWeight: "600" },
  tabs: {
    flexDirection: "row", marginBottom: 12, borderRadius: 14,
    overflow: "hidden", borderWidth: 1, borderColor: COLORS.border,
  },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, backgroundColor: COLORS.surface },
  tabActive: { backgroundColor: COLORS.primary },
  tabLabel: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 0.5 },
  tabLabelActive: { color: "#000" },
  periodRow: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  periodChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  periodChipActive: { borderColor: COLORS.primary, backgroundColor: "rgba(212,175,55,0.14)" },
  periodLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  periodLabelActive: { color: COLORS.primary },
  list: { paddingBottom: 80, gap: 10 },
  gridRow: { gap: 10 },
  gridItem: { flex: 1 },
  leaderCard: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 14,
    borderRadius: 16, borderWidth: 1, borderColor: "rgba(148,163,184,0.18)",
    backgroundColor: COLORS.surface,
  },
  rankBadge: {
    width: 32, height: 32, borderRadius: 10, borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)", backgroundColor: "rgba(3,7,18,0.7)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  rankText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "800" },
  leaderInfo: { flex: 1, minWidth: 0, gap: 4 },
  leaderName: { color: COLORS.text, fontWeight: "700", fontSize: 14 },
  leaderMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  titlePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: "rgba(212,175,55,0.12)", borderWidth: 1, borderColor: "rgba(212,175,55,0.25)" },
  titlePillText: { color: COLORS.primary, fontSize: 9, fontWeight: "700" },
  deptText: { color: COLORS.textMuted, fontSize: 10 },
  leaderRight: { alignItems: "flex-end", gap: 2 },
  leaderPoints: { color: COLORS.primary, fontSize: 16, fontWeight: "900" },
  leaderPtsLabel: { color: COLORS.textMuted, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8 },
  leaderLevel: { color: COLORS.textMuted, fontSize: 10 },
  videoCard: { borderRadius: 18, borderWidth: 1, borderColor: "rgba(148,163,184,0.2)", backgroundColor: COLORS.surface, overflow: "hidden" },
  videoHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, paddingBottom: 8 },
  videoTitle: { color: COLORS.text, fontWeight: "700", fontSize: 13 },
  videoMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  sportPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: "rgba(212,175,55,0.12)", borderWidth: 1, borderColor: "rgba(212,175,55,0.25)" },
  sportPillText: { color: COLORS.primary, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  videoPseudo: { color: COLORS.textMuted, fontSize: 11 },
  voteBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(3,7,18,0.8)", borderWidth: 1, borderColor: COLORS.border },
  voteCount: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  empty: { color: COLORS.textMuted, textAlign: "center", marginTop: 20 },
});
