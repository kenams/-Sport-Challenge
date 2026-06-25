// src/screens/SimpleHomeScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { COLORS, TYPO } from "../theme";
import AppButton from "../components/AppButton";
import ChallengeCard from "../components/ChallengeCard";
import { Challenge } from "../types";

const SPORTS_FILTER = ["Tous", "running", "pushups", "basket", "fitness", "foot", "traction", "squat", "nage"];
const PAGE = 10;

interface Stats { challenges: number; athletes: number; sports: number }

export default function SimpleHomeScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const columns = isWeb && width >= 1100 ? 2 : 1;

  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("Tous");
  const [isAuthed, setIsAuthed] = useState(false);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [stats, setStats] = useState<Stats>({ challenges: 0, athletes: 0, sports: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setIsAuthed(!!data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setIsAuthed(!!session);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const fetchStats = useCallback(async () => {
    const [{ count: c }, { count: a }] = await Promise.all([
      supabase.from("challenges").select("id", { count: "exact", head: true }),
      supabase.from("players_stats").select("user_id", { count: "exact", head: true }),
    ]);
    const { data: sports } = await supabase.from("challenges").select("sport");
    const uniqueSports = new Set((sports || []).map((r: any) => r.sport)).size;
    setStats({ challenges: c ?? 0, athletes: a ?? 0, sports: uniqueSports });
  }, []);

  const buildQuery = useCallback((from: number, sportFilter: string, searchFilter: string) => {
    let q = supabase
      .from("challenges")
      .select("id,user_id,pseudo,avatar_url,title,description,sport,target_value,unit,video_url,created_at,ranked,bet_enabled,bet_amount,ai_status")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (sportFilter !== "Tous") q = q.eq("sport", sportFilter);
    if (searchFilter.trim()) q = q.ilike("title", `%${searchFilter.trim()}%`);
    return q;
  }, []);

  const fetchChallenges = useCallback(async (from = 0, sportFilter = sport, searchFilter = search) => {
    const { data } = await buildQuery(from, sportFilter, searchFilter);
    const rows = (data as unknown as Challenge[]) || [];
    if (from === 0) setChallenges(rows);
    else setChallenges((prev) => [...prev, ...rows]);
    setHasMore(rows.length === PAGE);
  }, [buildQuery, sport, search]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStats(), fetchChallenges(0, sport, search)]).finally(() => setLoading(false));
  }, [fetchStats, fetchChallenges]);

  const applyFilter = (newSport: string) => {
    setSport(newSport);
    setLoading(true);
    fetchChallenges(0, newSport, search).finally(() => setLoading(false));
  };

  const applySearch = (text: string) => {
    setSearch(text);
    if (text.length === 0 || text.length > 2) {
      setLoading(true);
      fetchChallenges(0, sport, text).finally(() => setLoading(false));
    }
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchChallenges(challenges.length, sport, search).finally(() => setLoadingMore(false));
  };

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchStats(), fetchChallenges(0, sport, search)]).finally(() => setRefreshing(false));
  };

  const filtered = useMemo(() => challenges, [challenges]);

  return (
    <ScreenContainer>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Text style={styles.kicker}>IMMORTAL ARENA</Text>
        <Text style={styles.heroTitle}>Performances Studio</Text>
        <Text style={styles.subtitle}>Le terrain des performances vidéo. Rapide, propre, certifié.</Text>
        <View style={styles.heroRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{stats.challenges || "—"}</Text>
            <Text style={styles.heroStatLabel}>Défis en ligne</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{stats.athletes || "—"}</Text>
            <Text style={styles.heroStatLabel}>Athlètes</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{stats.sports || "—"}</Text>
            <Text style={styles.heroStatLabel}>Disciplines</Text>
          </View>
        </View>
      </View>

      {/* Search + action */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <FontAwesome5 name="search" size={11} color={COLORS.textMuted} style={{ marginLeft: 12 }} />
          <TextInput
            value={search}
            onChangeText={applySearch}
            placeholder="Rechercher un défi, un sport..."
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => applySearch("")} style={{ paddingRight: 12 }}>
              <FontAwesome5 name="times" size={11} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {isAuthed ? (
          <AppButton label="+ Publier" size="sm" onPress={() => navigation?.navigate("CreateChallenge")} />
        ) : (
          <AppButton label="Rejoindre" size="sm" onPress={() => navigation?.navigate("Register")} />
        )}
      </View>

      {/* Filtre sport */}
      <View style={styles.filterRow}>
        {SPORTS_FILTER.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, sport === s && styles.filterChipActive]}
            onPress={() => applyFilter(s)}
          >
            <Text style={[styles.filterText, sport === s && styles.filterTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          key={columns}
          keyExtractor={(item) => String(item.id)}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          renderItem={({ item }) => (
            <View style={columns > 1 ? styles.gridItem : undefined}>
              <ChallengeCard
                challenge={item}
                onPress={() => navigation?.navigate("ChallengeDetail", { id: item.id })}
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <FontAwesome5 name="dumbbell" size={32} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>Aucun défi trouvé</Text>
              <Text style={styles.emptyText}>
                {search || sport !== "Tous" ? "Essaie d'autres filtres." : "Sois le premier à publier une performance !"}
              </Text>
              {isAuthed && (
                <AppButton label="Créer un défi" size="sm" style={{ marginTop: 14 }} onPress={() => navigation?.navigate("CreateChallenge")} />
              )}
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : null}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: "relative", padding: 20, borderRadius: 22, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)", backgroundColor: "rgba(12,12,16,0.92)",
    marginBottom: 14, overflow: "hidden",
  },
  heroGlow: {
    position: "absolute", top: -60, right: -80, width: 200, height: 200,
    borderRadius: 120, backgroundColor: "rgba(212,175,55,0.2)",
  },
  kicker: { fontSize: 11, letterSpacing: 3, color: COLORS.textMuted, fontWeight: "700" },
  heroTitle: { ...TYPO.display, color: COLORS.text, marginTop: 6 },
  subtitle: { ...TYPO.subtitle, color: COLORS.textMuted, marginTop: 6 },
  heroRow: { marginTop: 16, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  heroStat: {
    flex: 1, minWidth: 90, padding: 12, borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)", backgroundColor: "rgba(3,7,18,0.6)",
  },
  heroStatValue: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  heroStatLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap",
  },
  searchWrap: {
    flex: 1, minWidth: 200, flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)", backgroundColor: "rgba(8,8,12,0.6)",
  },
  searchInput: {
    flex: 1, color: COLORS.text, paddingVertical: 10, paddingHorizontal: 4, fontSize: 13,
  },
  filterRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
    borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: "rgba(212,175,55,0.14)" },
  filterText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600" },
  filterTextActive: { color: COLORS.primary },
  list: { paddingBottom: 80 },
  gridRow: { gap: 12 },
  gridItem: { flex: 1 },
  emptyBox: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { color: COLORS.text, fontWeight: "800", fontSize: 16, marginBottom: 8 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: "center" },
});
