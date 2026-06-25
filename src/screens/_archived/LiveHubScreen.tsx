// src/screens/LiveHubScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
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

const PAGE_SIZE = 10;

interface BattleEvent {
  id: number;
  title?: string | null;
  sport?: string | null;
  status: string;
  player1_pseudo?: string | null;
  player2_pseudo?: string | null;
  player1_avatar?: string | null;
  player2_avatar?: string | null;
  player1_votes: number;
  player2_votes: number;
  viewer_count: number;
  scheduled_at?: string | null;
  replay_url?: string | null;
}

function useCountdown(targetIso?: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!targetIso) return;
    const tick = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      setRemaining(diff > 0 ? diff : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return remaining;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function BattleCard({ item, onPress }: { item: BattleEvent; onPress: () => void }) {
  const countdown = useCountdown(item.status === "scheduled" ? item.scheduled_at : null);
  const isLive = item.status === "live";
  const isScheduled = item.status === "scheduled";
  const isFinished = item.status === "ended" || item.status === "finished";
  const totalVotes = (item.player1_votes || 0) + (item.player2_votes || 0);
  const p1Pct = totalVotes > 0 ? Math.round(((item.player1_votes || 0) / totalVotes) * 100) : 50;

  const formatDate = (iso?: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString("fr-FR", {
      weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <TouchableOpacity style={[styles.card, isLive && styles.cardLive]} onPress={onPress} activeOpacity={0.85}>
      {/* Status badge */}
      <View style={styles.cardTop}>
        {isLive && (
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTxt}>EN DIRECT</Text>
          </View>
        )}
        {isScheduled && (
          <View style={styles.scheduledPill}>
            <FontAwesome5 name="clock" size={9} color={COLORS.primary} />
            <Text style={styles.scheduledTxt}>
              {countdown !== null && countdown > 0 ? formatCountdown(countdown) : formatDate(item.scheduled_at)}
            </Text>
          </View>
        )}
        {isFinished && (
          <View style={styles.finishedPill}>
            <Text style={styles.finishedTxt}>TERMINÉ</Text>
          </View>
        )}
        {item.sport && (
          <Text style={styles.sportTag}>{item.sport.toUpperCase()}</Text>
        )}
        {isLive && (
          <View style={styles.viewersRow}>
            <FontAwesome5 name="eye" size={9} color={COLORS.textMuted} />
            <Text style={styles.viewersTxt}>{item.viewer_count || 0}</Text>
          </View>
        )}
      </View>

      {/* Title */}
      {item.title ? <Text style={styles.cardTitle}>{item.title}</Text> : null}

      {/* Players */}
      <View style={styles.playersRow}>
        <View style={styles.playerInfo}>
          <UserAvatar uri={item.player1_avatar} label={item.player1_pseudo || "?"} size={32} />
          <Text style={styles.playerName} numberOfLines={1}>{item.player1_pseudo || "Joueur 1"}</Text>
        </View>
        <Text style={styles.vsSmall}>VS</Text>
        <View style={[styles.playerInfo, styles.playerInfoRight]}>
          <Text style={[styles.playerName, { textAlign: "right" }]} numberOfLines={1}>{item.player2_pseudo || "Joueur 2"}</Text>
          <UserAvatar uri={item.player2_avatar} label={item.player2_pseudo || "?"} size={32} />
        </View>
      </View>

      {/* Vote bar */}
      {totalVotes > 0 && (
        <View style={styles.miniVoteBar}>
          <View style={[styles.miniVoteP1, { flex: p1Pct }]} />
          <View style={[styles.miniVoteP2, { flex: 100 - p1Pct }]} />
        </View>
      )}

      {/* CTA */}
      <View style={styles.cardActions}>
        {isLive && (
          <View style={styles.ctaLive}>
            <FontAwesome5 name="broadcast-tower" size={11} color="#000" />
            <Text style={styles.ctaLiveTxt}>Rejoindre le LIVE</Text>
          </View>
        )}
        {isScheduled && (
          <View style={styles.ctaScheduled}>
            <FontAwesome5 name="bell" size={11} color={COLORS.primary} />
            <Text style={styles.ctaScheduledTxt}>Rappel · Rejoindre</Text>
          </View>
        )}
        {isFinished && item.replay_url && (
          <View style={styles.ctaReplay}>
            <FontAwesome5 name="play-circle" size={11} color={COLORS.success} />
            <Text style={styles.ctaReplayTxt}>Voir le replay</Text>
          </View>
        )}
        {totalVotes > 0 && (
          <Text style={styles.votesCount}>{totalVotes} votes</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function LiveHubScreen({ navigation }: any) {
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "live" | "history">("upcoming");
  const offsetRef = useRef(0);

  const fetchEvents = useCallback(
    async (reset = false) => {
      if (reset) { offsetRef.current = 0; setHasMore(true); }
      const statusFilter =
        tab === "upcoming" ? ["scheduled"] : tab === "live" ? ["live"] : ["ended", "finished", "canceled"];
      const from = reset ? 0 : offsetRef.current;
      const { data, error } = await supabase
        .from("live_events")
        .select("id,title,sport,status,player1_pseudo,player2_pseudo,player1_avatar,player2_avatar,player1_votes,player2_votes,viewer_count,scheduled_at,replay_url")
        .in("status", statusFilter)
        .order("scheduled_at", { ascending: tab !== "history" })
        .range(from, from + PAGE_SIZE - 1);
      if (error) return;
      const rows = (data || []) as unknown as BattleEvent[];
      if (reset) setEvents(rows);
      else setEvents((prev) => [...prev, ...rows]);
      offsetRef.current = from + rows.length;
      setHasMore(rows.length === PAGE_SIZE);
    },
    [tab]
  );

  useEffect(() => {
    setLoading(true);
    fetchEvents(true).finally(() => setLoading(false));
  }, [fetchEvents]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchEvents(false);
    setLoadingMore(false);
  }, [loadingMore, hasMore, fetchEvents]);

  const liveCount = tab === "live" ? events.length : 0;

  return (
    <ScreenContainer>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>IMMORTAL ARENA</Text>
          <Text style={styles.heroTitle}>LIVE BATTLES</Text>
          <Text style={styles.heroSub}>Duels live, tournois et replays.</Text>
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation?.navigate("CreateLiveBattle")}
        >
          <FontAwesome5 name="plus" size={12} color="#000" />
          <Text style={styles.createBtnTxt}>Créer</Text>
        </TouchableOpacity>
      </View>

      {/* Live count banner */}
      {tab === "live" && liveCount > 0 && (
        <View style={styles.liveBanner}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBannerTxt}>{liveCount} battle{liveCount > 1 ? "s" : ""} en cours</Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        {(["upcoming", "live", "history"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t === "upcoming" ? "Planifiées" : t === "live" ? "🔴 Live" : "Historique"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => `ev-${item.id}`}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <BattleCard
              item={item}
              onPress={() => navigation?.navigate("LiveBattle", { id: item.id })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <FontAwesome5 name="broadcast-tower" size={32} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
              <Text style={styles.empty}>
                {tab === "upcoming" ? "Aucune battle planifiée." : tab === "live" ? "Aucun live en ce moment." : "Aucun historique."}
              </Text>
              {tab === "upcoming" && (
                <TouchableOpacity style={styles.emptyCreate} onPress={() => navigation?.navigate("CreateLiveBattle")}>
                  <Text style={styles.emptyCreateTxt}>Programmer une battle</Text>
                </TouchableOpacity>
              )}
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
    flexDirection: "row", alignItems: "center",
    padding: 18, borderRadius: 20, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)", backgroundColor: "rgba(12,12,16,0.92)",
    marginBottom: 14,
  },
  kicker: { fontSize: 10, letterSpacing: 3, color: COLORS.textMuted, fontWeight: "700" },
  heroTitle: { ...TYPO.display, color: COLORS.text, marginTop: 4 },
  heroSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 3 },
  createBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12,
  },
  createBtnTxt: { color: "#000", fontWeight: "800", fontSize: 12 },

  liveBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(239,68,68,0.1)", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 10,
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#EF4444" },
  liveBannerTxt: { color: "#EF4444", fontWeight: "700", fontSize: 12 },

  tabs: {
    flexDirection: "row", marginBottom: 12, borderRadius: 12, overflow: "hidden",
    borderWidth: 1, borderColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", backgroundColor: COLORS.surface },
  tabActive: { backgroundColor: COLORS.primary },
  tabLabel: { fontSize: 11, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 0.5 },
  tabLabelActive: { color: "#000" },

  list: { paddingBottom: 80, gap: 12 },

  card: {
    padding: 16, borderRadius: 20, borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)", backgroundColor: COLORS.surface,
    gap: 10,
  },
  cardLive: {
    borderColor: "rgba(239,68,68,0.4)", backgroundColor: "rgba(239,68,68,0.05)",
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },

  livePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "rgba(239,68,68,0.15)", borderWidth: 1, borderColor: "rgba(239,68,68,0.4)",
  },
  liveTxt: { color: "#EF4444", fontSize: 10, fontWeight: "900", letterSpacing: 1 },

  scheduledPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.1)", borderWidth: 1, borderColor: "rgba(212,175,55,0.35)",
  },
  scheduledTxt: { color: COLORS.primary, fontSize: 10, fontWeight: "800" },

  finishedPill: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.1)", borderWidth: 1, borderColor: COLORS.border,
  },
  finishedTxt: { color: COLORS.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  sportTag: { color: COLORS.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  viewersRow: { flexDirection: "row", alignItems: "center", gap: 3, marginLeft: "auto" as any },
  viewersTxt: { color: COLORS.textMuted, fontSize: 10 },

  cardTitle: { color: COLORS.text, fontWeight: "800", fontSize: 14 },

  playersRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  playerInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  playerInfoRight: { justifyContent: "flex-end" },
  playerName: { color: COLORS.text, fontWeight: "700", fontSize: 12, flex: 1 },
  vsSmall: { color: COLORS.primary, fontWeight: "900", fontSize: 14, letterSpacing: 2 },

  miniVoteBar: { flexDirection: "row", height: 4, borderRadius: 99, overflow: "hidden" },
  miniVoteP1: { backgroundColor: "#60A5FA", minWidth: 2 },
  miniVoteP2: { backgroundColor: "#F97316", minWidth: 2 },

  cardActions: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  ctaLive: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#EF4444", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
  },
  ctaLiveTxt: { color: "#fff", fontWeight: "800", fontSize: 11 },
  ctaScheduled: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.primary + "15", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.primary + "44",
  },
  ctaScheduledTxt: { color: COLORS.primary, fontWeight: "700", fontSize: 11 },
  ctaReplay: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.success + "15", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.success + "44",
  },
  ctaReplayTxt: { color: COLORS.success, fontWeight: "700", fontSize: 11 },
  votesCount: { color: COLORS.textMuted, fontSize: 11, marginLeft: "auto" as any },

  emptyWrap: { alignItems: "center", paddingTop: 40 },
  empty: { color: COLORS.textMuted, fontSize: 13, textAlign: "center" },
  emptyCreate: {
    marginTop: 14, backgroundColor: COLORS.primary + "15", borderWidth: 1,
    borderColor: COLORS.primary + "44", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
  },
  emptyCreateTxt: { color: COLORS.primary, fontWeight: "700", fontSize: 13 },
});
