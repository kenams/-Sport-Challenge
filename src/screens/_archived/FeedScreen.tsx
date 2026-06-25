// src/screens/FeedScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";
import { supabase } from "../supabase";
import UserAvatar from "../components/UserAvatar";

interface Activity {
  id: number;
  user_id: string;
  pseudo?: string | null;
  avatar_url?: string | null;
  type: string;
  challenge_id?: number | null;
  message?: string | null;
  created_at: string;
  challenges?: { title: string; sport: string } | null;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  challenge_created: { icon: "fire", color: "#F59E0B", label: "Nouveau défi" },
  challenge_winner: { icon: "trophy", color: "#D4AF37", label: "Victoire" },
  response_posted: { icon: "video", color: "#60A5FA", label: "Réponse vidéo" },
  challenge_response: { icon: "video", color: "#60A5FA", label: "Réponse vidéo" },
  vote_cast: { icon: "thumbs-up", color: "#34D399", label: "Vote" },
  live_started: { icon: "broadcast-tower", color: "#EF4444", label: "Live démarré" },
  level_up: { icon: "star", color: "#C084FC", label: "Niveau up" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Il y a ${d}j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export default function FeedScreen({ navigation }: any) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState({ posts: 0, responses: 0, votes: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE = 15;

  const fetchStats = useCallback(async () => {
    const [{ count: posts }, { count: responses }] = await Promise.all([
      supabase.from("challenges").select("id", { count: "exact", head: true }),
      supabase.from("challenge_responses").select("id", { count: "exact", head: true }),
    ]);
    setStats({ posts: posts ?? 0, responses: responses ?? 0, votes: 0 });
  }, []);

  const fetchActivities = useCallback(async (from = 0) => {
    const { data } = await supabase
      .from("activities")
      .select("id,user_id,pseudo,avatar_url,type,challenge_id,message,created_at,challenges(title,sport)")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    const rows = (data as unknown as Activity[]) || [];
    if (from === 0) setActivities(rows);
    else setActivities((prev) => [...prev, ...rows]);
    setHasMore(rows.length === PAGE);
    return rows.length;
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchActivities(0)]).finally(() => setLoading(false));

    const channel = supabase
      .channel("feed-activities")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activities" }, () => {
        fetchActivities(0);
        fetchStats();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchStats, fetchActivities]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchActivities(activities.length);
    setLoadingMore(false);
  };

  const renderItem = ({ item }: { item: Activity }) => {
    const cfg = TYPE_CONFIG[item.type] || { icon: "bolt", color: COLORS.textMuted, label: item.type };
    const name = item.pseudo || `Joueur ${item.user_id.slice(0, 6)}`;
    const challengeTitle = (item.challenges as any)?.title;

    return (
      <TouchableOpacity
        style={styles.item}
        activeOpacity={0.85}
        onPress={() => item.challenge_id && navigation?.navigate("ChallengeDetail", { id: item.challenge_id })}
      >
        <View style={[styles.iconCircle, { borderColor: cfg.color + "55", backgroundColor: cfg.color + "18" }]}>
          <FontAwesome5 name={cfg.icon as any} size={14} color={cfg.color} />
        </View>
        <View style={styles.itemBody}>
          <View style={styles.itemRow}>
            <UserAvatar uri={item.avatar_url} label={name} size={28} />
            <View style={styles.itemText}>
              <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
              <Text style={[styles.itemType, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
          </View>
          {(item.message || challengeTitle) ? (
            <Text style={styles.itemMessage} numberOfLines={2}>
              {item.message || challengeTitle}
            </Text>
          ) : null}
          {challengeTitle && (
            <View style={styles.challengePill}>
              <FontAwesome5 name="dumbbell" size={9} color={COLORS.primary} />
              <Text style={styles.challengePillText} numberOfLines={1}>{challengeTitle}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.kicker}>ACTIVITÉ</Text>
        <Text style={styles.title}>Flux en direct</Text>
        <Text style={styles.subtitle}>Les dernières actions de l'arène.</Text>
        <View style={styles.statsRow}>
          {[
            { label: "Défis", value: stats.posts, icon: "fire" },
            { label: "Réponses", value: stats.responses, icon: "video" },
            { label: "Live", icon: "broadcast-tower", value: null, live: true },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <FontAwesome5 name={s.icon as any} size={12} color={COLORS.primary} style={{ marginBottom: 4 }} />
              <Text style={styles.statValue}>{s.value !== null ? s.value : "—"}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <FontAwesome5 name="stream" size={32} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>Aucune activité</Text>
              <Text style={styles.emptyText}>
                Les actions de l'arène apparaîtront ici en temps réel.
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: 18, borderRadius: 20, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    backgroundColor: "rgba(12,12,16,0.92)", marginBottom: 16,
  },
  kicker: { fontSize: 11, letterSpacing: 3, color: COLORS.textMuted, fontWeight: "700" },
  title: { ...TYPO.display, color: COLORS.text, marginTop: 6 },
  subtitle: { ...TYPO.subtitle, color: COLORS.textMuted, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 14, flexWrap: "wrap" },
  statCard: {
    flex: 1, minWidth: 80, padding: 10, borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)", backgroundColor: "rgba(3,7,18,0.6)",
    alignItems: "center",
  },
  statValue: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  statLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.8 },
  list: { paddingBottom: 80, gap: 2 },
  item: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)",
  },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  itemBody: { flex: 1, gap: 6 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemText: { flex: 1, minWidth: 0 },
  itemName: { color: COLORS.text, fontWeight: "700", fontSize: 13, letterSpacing: 0.2 },
  itemType: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  itemTime: { color: COLORS.textMuted, fontSize: 11, flexShrink: 0 },
  itemMessage: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  challengePill: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.1)", borderWidth: 1,
    borderColor: "rgba(212,175,55,0.25)",
  },
  challengePillText: { color: COLORS.primary, fontSize: 11, fontWeight: "700", maxWidth: 200 },
  emptyBox: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { color: COLORS.text, fontWeight: "800", fontSize: 16, marginBottom: 8 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: "center", lineHeight: 18 },
});
