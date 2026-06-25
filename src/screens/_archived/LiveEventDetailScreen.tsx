// src/screens/LiveEventDetailScreen.tsx
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";
import { supabase } from "../supabase";
import AppButton from "../components/AppButton";
import VideoPlayer from "../components/VideoPlayer";

interface LiveEvent {
  id: number;
  title: string;
  sport?: string | null;
  host_pseudo?: string | null;
  status: string;
  stream_url?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  viewer_count?: number | null;
  challenge_id?: number | null;
  challenges?: { title: string; sport: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  live: { label: "EN DIRECT", color: "#EF4444", icon: "broadcast-tower" },
  scheduled: { label: "PLANIFIÉ", color: "#60A5FA", icon: "clock" },
  ended: { label: "TERMINÉ", color: COLORS.textMuted, icon: "check-circle" },
};

export default function LiveEventDetailScreen({ navigation }: any) {
  const route = useRoute<any>();
  const eventId = route.params?.eventId ?? route.params?.id ?? null;
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) { setLoading(false); return; }
    let mounted = true;
    supabase
      .from("live_events")
      .select("id,title,sport,host_pseudo,status,stream_url,started_at,ended_at,viewer_count,challenge_id,challenges(title,sport)")
      .eq("id", eventId)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted) {
          setEvent(data as unknown as LiveEvent | null);
          setLoading(false);
        }
      });

    const channel = supabase
      .channel(`live-detail-${eventId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_events", filter: `id=eq.${eventId}` }, (payload) => {
        if (mounted) setEvent((prev) => prev ? { ...prev, ...(payload.new as any) } : prev);
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 80 }} />
      </ScreenContainer>
    );
  }

  if (!event) {
    return (
      <ScreenContainer>
        <View style={styles.emptyBox}>
          <FontAwesome5 name="video-slash" size={36} color={COLORS.textMuted} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>Live introuvable</Text>
          <Text style={styles.emptyText}>Cet événement n'existe pas ou a été supprimé.</Text>
          <AppButton label="Retour" size="sm" variant="ghost" style={{ marginTop: 16 }} onPress={() => navigation?.goBack()} />
        </View>
      </ScreenContainer>
    );
  }

  const cfg = STATUS_CONFIG[event.status] || { label: event.status.toUpperCase(), color: COLORS.textMuted, icon: "circle" };
  const challengeTitle = (event.challenges as any)?.title;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { borderColor: cfg.color + "55", backgroundColor: cfg.color + "18" }]}>
              {event.status === "live" && <View style={styles.liveDot} />}
              <FontAwesome5 name={cfg.icon as any} size={11} color={cfg.color} />
              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            {event.viewer_count != null && event.status === "live" && (
              <View style={styles.viewerBadge}>
                <FontAwesome5 name="eye" size={10} color={COLORS.textMuted} />
                <Text style={styles.viewerText}>{event.viewer_count} spectateurs</Text>
              </View>
            )}
          </View>

          <Text style={styles.kicker}>LIVE EVENT</Text>
          <Text style={styles.heroTitle}>{event.title}</Text>
          {event.host_pseudo && (
            <Text style={styles.hostText}>Animé par <Text style={{ color: COLORS.primary, fontWeight: "700" }}>{event.host_pseudo}</Text></Text>
          )}

          <View style={styles.metaRow}>
            {event.sport && (
              <View style={styles.sportPill}>
                <FontAwesome5 name="dumbbell" size={9} color={COLORS.primary} />
                <Text style={styles.sportPillText}>{event.sport.toUpperCase()}</Text>
              </View>
            )}
            {event.started_at && (
              <View style={styles.metaPill}>
                <FontAwesome5 name="clock" size={9} color={COLORS.textMuted} />
                <Text style={styles.metaPillText}>
                  {new Date(event.started_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Vidéo stream */}
        {event.stream_url ? (
          <View style={styles.playerWrap}>
            <VideoPlayer
              uri={event.stream_url}
              style={{ height: 220, width: "100%" }}
              contentFit="cover"
              autoPlay={event.status === "live"}
              shouldPlay={event.status === "live"}
              allowUserToggle
              showControlButton
            />
          </View>
        ) : (
          <View style={styles.noStream}>
            <FontAwesome5 name="satellite-dish" size={28} color={COLORS.textMuted} style={{ marginBottom: 8 }} />
            <Text style={styles.noStreamText}>
              {event.status === "scheduled" ? "Le stream n'a pas encore démarré." : "Aucun stream disponible."}
            </Text>
          </View>
        )}

        {/* Défi associé */}
        {challengeTitle && (
          <View style={styles.challengeCard}>
            <FontAwesome5 name="fire" size={14} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.challengeLabel}>Défi associé</Text>
              <Text style={styles.challengeTitle}>{challengeTitle}</Text>
            </View>
            {event.challenge_id && (
              <AppButton
                label="Voir"
                size="sm"
                variant="ghost"
                onPress={() => navigation?.navigate("ChallengeDetail", { id: event.challenge_id })}
              />
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 80, gap: 14 },
  hero: {
    padding: 18, borderRadius: 20, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)", backgroundColor: "rgba(12,12,16,0.92)",
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444",
  },
  statusText: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  viewerBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.08)", borderWidth: 1, borderColor: "rgba(148,163,184,0.2)",
  },
  viewerText: { color: COLORS.textMuted, fontSize: 11 },
  kicker: { fontSize: 11, letterSpacing: 3, color: COLORS.textMuted, fontWeight: "700" },
  heroTitle: { ...TYPO.display, color: COLORS.text, marginTop: 4 },
  hostText: { color: COLORS.textMuted, fontSize: 13, marginTop: 6 },
  metaRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  sportPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.12)", borderWidth: 1, borderColor: "rgba(212,175,55,0.25)",
  },
  sportPillText: { color: COLORS.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  metaPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.08)", borderWidth: 1, borderColor: "rgba(148,163,184,0.2)",
  },
  metaPillText: { color: COLORS.textMuted, fontSize: 10, fontWeight: "600" },
  playerWrap: {
    borderRadius: 18, overflow: "hidden", borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)", backgroundColor: COLORS.surface,
  },
  noStream: {
    padding: 40, alignItems: "center", borderRadius: 18, borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)", backgroundColor: COLORS.surface,
  },
  noStreamText: { color: COLORS.textMuted, fontSize: 13, textAlign: "center" },
  challengeCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 16, borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.25)", backgroundColor: "rgba(212,175,55,0.06)",
  },
  challengeLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  challengeTitle: { color: COLORS.text, fontWeight: "700", fontSize: 14, marginTop: 2 },
  emptyBox: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { color: COLORS.text, fontWeight: "800", fontSize: 18, marginBottom: 8 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: "center" },
});
