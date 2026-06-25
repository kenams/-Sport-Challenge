// src/screens/ArenaLiveScreen.tsx
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";
import AppButton from "../components/AppButton";
import { supabase } from "../supabase";

interface LiveEvent {
  id: number;
  status: string;
  scheduled_at: string;
  winner_id?: string | null;
  replay_url?: string | null;
  player1_id?: string | null;
  player2_id?: string | null;
  challenge_types?: { name: string; sport: string } | null;
}

interface Stats {
  live: number;
  participants: number;
  scheduled: number;
}

export default function ArenaLiveScreen({ navigation }: any) {
  const [activeLives, setActiveLives] = useState<LiveEvent[]>([]);
  const [upcoming, setUpcoming] = useState<LiveEvent[]>([]);
  const [stats, setStats] = useState<Stats>({ live: 0, participants: 0, scheduled: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [{ data: liveData }, { data: upData }] = await Promise.all([
        supabase
          .from("live_events")
          .select("id,status,scheduled_at,winner_id,replay_url,player1_id,player2_id,challenge_types(name,sport)")
          .eq("status", "live")
          .order("scheduled_at", { ascending: true })
          .limit(10),
        supabase
          .from("live_events")
          .select("id,status,scheduled_at,winner_id,replay_url,player1_id,player2_id,challenge_types(name,sport)")
          .eq("status", "scheduled")
          .order("scheduled_at", { ascending: true })
          .limit(10),
      ]);

      if (!mounted) return;

      const lives = (liveData as unknown as LiveEvent[]) || [];
      const ups = (upData as unknown as LiveEvent[]) || [];

      setActiveLives(lives);
      setUpcoming(ups);

      const participants = lives.reduce((acc, e) => {
        return acc + (e.player1_id ? 1 : 0) + (e.player2_id ? 1 : 0);
      }, 0);

      setStats({
        live: lives.length,
        participants,
        scheduled: ups.length,
      });
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel("arena-live-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_events" },
        () => load()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderEvent = (item: LiveEvent, isLive: boolean) => {
    const typeName = (item.challenge_types as any)?.name ?? "Défi";
    const sport = (item.challenge_types as any)?.sport ?? "";
    const players = [item.player1_id, item.player2_id].filter(Boolean).length;
    return (
      <TouchableOpacity
        key={`live-${item.id}`}
        style={[styles.card, isLive && styles.cardLive]}
        onPress={() => navigation?.navigate("LiveEventDetail", { eventId: item.id })}
      >
        {isLive && <View style={styles.liveDot} />}
        <Text style={styles.cardTitle}>{typeName}</Text>
        {sport ? <Text style={styles.sportTag}>{sport.toUpperCase()}</Text> : null}
        <Text style={styles.cardMeta}>{formatTime(item.scheduled_at)}</Text>
        <Text style={styles.cardValue}>
          {isLive ? `${players} joueur${players > 1 ? "s" : ""}` : "À confirmer"}
        </Text>
        {item.replay_url ? (
          <Text style={styles.replayBadge}>REPLAY DISPO</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>LIVE</Text>
          <Text style={styles.title}>Arène Live</Text>
          <Text style={styles.subtitle}>Sessions live synchronisées en temps réel.</Text>

          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 16 }} />
          ) : (
            <View style={styles.statsRow}>
              {[
                { label: "Lives actifs", value: String(stats.live) },
                { label: "Participants", value: String(stats.participants) },
                { label: "Planifiés", value: String(stats.scheduled) },
              ].map((item) => (
                <View key={item.label} style={styles.statCard}>
                  <Text style={styles.statValue}>{item.value}</Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <AppButton
              label="Créer un live"
              size="sm"
              onPress={() => navigation?.navigate("ArenaChallenges")}
            />
            <AppButton
              label="Historique"
              size="sm"
              variant="ghost"
              onPress={() => navigation?.navigate("ArenaHistory")}
            />
          </View>
        </View>

        {activeLives.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sessions en cours</Text>
            <Text style={styles.sectionSubtitle}>Rejoins un duel maintenant.</Text>
            <View style={styles.cardGrid}>
              {activeLives.map((item) => renderEvent(item, true))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>À venir</Text>
          <Text style={styles.sectionSubtitle}>Prochains lives planifiés.</Text>
          {loading ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : upcoming.length === 0 ? (
            <Text style={styles.empty}>Aucun live planifié pour l'instant.</Text>
          ) : (
            <View style={styles.cardGrid}>
              {upcoming.map((item) => renderEvent(item, false))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 80 },
  hero: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    backgroundColor: "rgba(12,12,16,0.92)",
    marginBottom: 18,
  },
  kicker: { fontSize: 11, letterSpacing: 3, color: COLORS.textMuted, fontWeight: "700" },
  title: { ...TYPO.display, color: COLORS.text, marginTop: 6 },
  subtitle: { ...TYPO.subtitle, color: COLORS.textMuted, marginTop: 4 },
  statsRow: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    flex: 1,
    minWidth: 100,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: "rgba(3,7,18,0.6)",
  },
  statValue: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  actions: { marginTop: 16, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  section: { marginBottom: 18 },
  sectionTitle: { ...TYPO.title, color: COLORS.text },
  sectionSubtitle: { color: COLORS.textMuted, marginTop: 4, marginBottom: 10 },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    flex: 1,
    minWidth: 220,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: COLORS.surface,
    position: "relative",
  },
  cardLive: { borderColor: "rgba(239,68,68,0.5)" },
  liveDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  sportTag: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  cardMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  cardValue: { fontSize: 13, color: COLORS.primary, marginTop: 8, fontWeight: "700" },
  replayBadge: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.success,
    letterSpacing: 1.5,
  },
  empty: { color: COLORS.textMuted, marginTop: 8 },
});
