// src/screens/ImpitoyableDashboard.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
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

interface CoachAlert {
  id: number;
  user_id: string;
  type: string;
  message?: string | null;
  seen: boolean;
  created_at: string;
  profiles?: { pseudo?: string | null; avatar_url?: string | null } | null;
}

interface Athlete {
  user_id: string;
  points: number;
  level?: number | null;
  fair_play_score?: number | null;
  title?: string | null;
  profiles?: { pseudo?: string | null; avatar_url?: string | null; department?: string | null } | null;
}

const ALERT_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  dept_rivalry: { icon: "swords", color: "#F97316", label: "Rivalité" },
  level_up: { icon: "star", color: "#C084FC", label: "Niveau up" },
  fair_play_low: { icon: "shield-alt", color: "#EF4444", label: "Fair Play bas" },
  inactivity: { icon: "moon", color: "#60A5FA", label: "Inactivité" },
  winner: { icon: "trophy", color: "#D4AF37", label: "Victoire" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}j`;
}

export default function ImpitoyableDashboard({ navigation }: any) {
  const [alerts, setAlerts] = useState<CoachAlert[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const loadData = useCallback(async (uid: string) => {
    const [{ data: alertData }, { data: athleteData }] = await Promise.all([
      supabase
        .from("coach_notifications")
        .select("id,user_id,type,message,seen,created_at,profiles(pseudo,avatar_url)")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("players_stats")
        .select("user_id,points,level,fair_play_score,title,profiles(pseudo,avatar_url,department)")
        .order("points", { ascending: false })
        .limit(10),
    ]);
    setAlerts((alertData as unknown as CoachAlert[]) || []);
    setAthletes((athleteData as unknown as Athlete[]) || []);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid || !mounted) { setLoading(false); return; }
      setUserId(uid);
      await loadData(uid);
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [loadData]);

  const markAlertSeen = async (id: number) => {
    await supabase.from("coach_notifications").update({ seen: true }).eq("id", id);
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, seen: true } : a));
  };

  const unread = alerts.filter((a) => !a.seen).length;
  const teamAvgPoints = athletes.length ? Math.round(athletes.reduce((s, a) => s + a.points, 0) / athletes.length) : 0;
  const teamAvgFairPlay = athletes.length ? Math.round(athletes.reduce((s, a) => s + (a.fair_play_score ?? 100), 0) / athletes.length) : 0;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.kicker}>COACH</Text>
          <Text style={styles.heroTitle}>Tableau de bord</Text>
          <Text style={styles.subtitle}>Pilotage des performances et discipline.</Text>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <FontAwesome5 name="users" size={14} color={COLORS.primary} style={{ marginBottom: 4 }} />
              <Text style={styles.statValue}>{athletes.length}</Text>
              <Text style={styles.statLabel}>Athlètes</Text>
            </View>
            <View style={styles.statCard}>
              <FontAwesome5 name="bell" size={14} color={unread > 0 ? "#EF4444" : COLORS.textMuted} style={{ marginBottom: 4 }} />
              <Text style={[styles.statValue, unread > 0 && { color: "#EF4444" }]}>{unread}</Text>
              <Text style={styles.statLabel}>Alertes</Text>
            </View>
            <View style={styles.statCard}>
              <FontAwesome5 name="star" size={14} color={COLORS.primary} style={{ marginBottom: 4 }} />
              <Text style={styles.statValue}>{teamAvgPoints}</Text>
              <Text style={styles.statLabel}>Score moy.</Text>
            </View>
            <View style={styles.statCard}>
              <FontAwesome5 name="shield-alt" size={14} color={teamAvgFairPlay >= 80 ? "#34D399" : "#F59E0B"} style={{ marginBottom: 4 }} />
              <Text style={[styles.statValue, { color: teamAvgFairPlay >= 80 ? "#34D399" : "#F59E0B" }]}>{teamAvgFairPlay}</Text>
              <Text style={styles.statLabel}>Fair Play</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Alertes */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <FontAwesome5 name="bell" size={13} color="#EF4444" />
                <Text style={styles.sectionTitle}>Alertes récentes</Text>
                {unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unread}</Text>
                  </View>
                )}
              </View>

              {alerts.length === 0 ? (
                <View style={styles.emptyBox}>
                  <FontAwesome5 name="check-circle" size={24} color="#34D399" style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyText}>Aucune alerte en cours.</Text>
                </View>
              ) : (
                alerts.slice(0, 8).map((alert) => {
                  const cfg = ALERT_CONFIG[alert.type] || { icon: "bolt", color: COLORS.textMuted, label: alert.type };
                  const prof = alert.profiles as any;
                  return (
                    <TouchableOpacity
                      key={alert.id}
                      style={[styles.alertItem, !alert.seen && styles.alertItemUnread]}
                      activeOpacity={0.85}
                      onPress={() => markAlertSeen(alert.id)}
                    >
                      <View style={[styles.alertIcon, { borderColor: cfg.color + "55", backgroundColor: cfg.color + "18" }]}>
                        <FontAwesome5 name={cfg.icon as any} size={13} color={cfg.color} />
                      </View>
                      <View style={styles.alertBody}>
                        <View style={styles.alertRow}>
                          <Text style={[styles.alertType, { color: cfg.color }]}>{cfg.label}</Text>
                          <Text style={styles.alertTime}>{timeAgo(alert.created_at)}</Text>
                        </View>
                        {alert.message && <Text style={styles.alertMsg} numberOfLines={2}>{alert.message}</Text>}
                        {prof?.pseudo && <Text style={styles.alertPseudo}>{prof.pseudo}</Text>}
                      </View>
                      {!alert.seen && <View style={styles.dot} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            {/* Top athlètes */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <FontAwesome5 name="users" size={13} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Top athlètes</Text>
              </View>

              {athletes.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>Aucun athlète enregistré.</Text>
                </View>
              ) : (
                athletes.slice(0, 8).map((athlete, index) => {
                  const prof = athlete.profiles as any;
                  const name = prof?.pseudo || `Joueur ${athlete.user_id.slice(0, 6)}`;
                  const fpColor = (athlete.fair_play_score ?? 100) >= 80 ? "#34D399" : (athlete.fair_play_score ?? 100) >= 50 ? "#F59E0B" : "#EF4444";
                  return (
                    <View key={athlete.user_id} style={styles.athleteCard}>
                      <View style={styles.rankBox}>
                        <Text style={styles.rankText}>#{index + 1}</Text>
                      </View>
                      <UserAvatar uri={prof?.avatar_url} label={name} size={38} />
                      <View style={styles.athleteInfo}>
                        <Text style={styles.athleteName} numberOfLines={1}>{name}</Text>
                        <View style={styles.athleteMeta}>
                          {athlete.title && <Text style={styles.athleteTitle}>{athlete.title}</Text>}
                          {prof?.department && <Text style={styles.athleteDept}>Dép. {prof.department}</Text>}
                        </View>
                      </View>
                      <View style={styles.athleteRight}>
                        <Text style={styles.athletePoints}>{(athlete.points || 0).toLocaleString("fr-FR")}</Text>
                        <Text style={styles.athletePtsLabel}>pts</Text>
                        <View style={[styles.fpBadge, { borderColor: fpColor + "55" }]}>
                          <FontAwesome5 name="shield-alt" size={8} color={fpColor} />
                          <Text style={[styles.fpText, { color: fpColor }]}>{athlete.fair_play_score ?? 100}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Accès rapide */}
            <View style={styles.quickRow}>
              <TouchableOpacity style={styles.quickCard} onPress={() => navigation?.navigate("ArenaChallenges")}>
                <FontAwesome5 name="fire" size={18} color="#F59E0B" />
                <Text style={styles.quickLabel}>Défis actifs</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickCard} onPress={() => navigation?.navigate("ArenaReports")}>
                <FontAwesome5 name="flag" size={18} color="#EF4444" />
                <Text style={styles.quickLabel}>Signalements</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickCard} onPress={() => navigation?.navigate("LiveHub")}>
                <FontAwesome5 name="broadcast-tower" size={18} color="#60A5FA" />
                <Text style={styles.quickLabel}>Lives</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 80, gap: 16 },
  hero: {
    padding: 18, borderRadius: 20, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)", backgroundColor: "rgba(12,12,16,0.92)",
  },
  kicker: { fontSize: 11, letterSpacing: 3, color: COLORS.textMuted, fontWeight: "700" },
  heroTitle: { ...TYPO.display, color: COLORS.text, marginTop: 6 },
  subtitle: { ...TYPO.subtitle, color: COLORS.textMuted, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  statCard: {
    flex: 1, minWidth: 70, padding: 10, borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)", backgroundColor: "rgba(3,7,18,0.6)",
    alignItems: "center",
  },
  statValue: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  statLabel: { fontSize: 9, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2 },
  section: { gap: 8 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  sectionTitle: { color: COLORS.text, fontWeight: "800", fontSize: 15, flex: 1 },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "#EF4444",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 6,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  alertItem: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 12, borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)", backgroundColor: COLORS.surface,
  },
  alertItemUnread: { borderColor: "rgba(212,175,55,0.25)", backgroundColor: "rgba(212,175,55,0.04)" },
  alertIcon: {
    width: 36, height: 36, borderRadius: 11, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  alertBody: { flex: 1, gap: 2 },
  alertRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  alertType: { fontSize: 12, fontWeight: "700" },
  alertTime: { color: COLORS.textMuted, fontSize: 11 },
  alertMsg: { color: COLORS.textMuted, fontSize: 12, lineHeight: 16 },
  alertPseudo: { color: COLORS.primary, fontSize: 11, fontWeight: "700", marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, alignSelf: "center" },
  athleteCard: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 12,
    borderRadius: 14, borderWidth: 1, borderColor: "rgba(148,163,184,0.15)", backgroundColor: COLORS.surface,
  },
  rankBox: {
    width: 28, height: 28, borderRadius: 8, borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)", backgroundColor: "rgba(3,7,18,0.7)",
    alignItems: "center", justifyContent: "center",
  },
  rankText: { color: COLORS.textMuted, fontSize: 10, fontWeight: "800" },
  athleteInfo: { flex: 1, minWidth: 0, gap: 3 },
  athleteName: { color: COLORS.text, fontWeight: "700", fontSize: 13 },
  athleteMeta: { flexDirection: "row", gap: 6, alignItems: "center" },
  athleteTitle: { color: COLORS.primary, fontSize: 10, fontWeight: "700" },
  athleteDept: { color: COLORS.textMuted, fontSize: 10 },
  athleteRight: { alignItems: "flex-end", gap: 3 },
  athletePoints: { color: COLORS.primary, fontSize: 14, fontWeight: "900" },
  athletePtsLabel: { color: COLORS.textMuted, fontSize: 9, textTransform: "uppercase" },
  fpBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, borderWidth: 1,
    backgroundColor: "rgba(3,7,18,0.6)",
  },
  fpText: { fontSize: 10, fontWeight: "700" },
  quickRow: { flexDirection: "row", gap: 10 },
  quickCard: {
    flex: 1, padding: 16, borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)", backgroundColor: COLORS.surface,
    alignItems: "center", gap: 8,
  },
  quickLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700", textAlign: "center" },
  emptyBox: { padding: 20, alignItems: "center", borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  emptyText: { color: COLORS.textMuted, fontSize: 13 },
});
