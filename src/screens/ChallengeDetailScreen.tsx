// src/screens/ChallengeDetailScreen.tsx
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";
import AppButton from "../components/AppButton";
import UserAvatar from "../components/UserAvatar";
import VideoPlayer from "../components/VideoPlayer";
import { supabase } from "../supabase";

interface ChallengeData {
  id: number;
  user_id: string;
  pseudo?: string | null;
  avatar_url?: string | null;
  title: string;
  description: string;
  sport: string;
  target_value: number;
  unit: string;
  ranked?: boolean;
  bet_enabled?: boolean;
  bet_amount?: number;
  created_at: string;
  ai_status?: string | null;
}

interface Response {
  id: number;
  user_id: string;
  pseudo?: string | null;
  avatar_url?: string | null;
  video_url: string;
  votes: number;
  is_winner: boolean;
  created_at: string;
}

const AI_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  validated: { color: "#34D399", icon: "check-circle", label: "IA validé" },
  ok: { color: "#34D399", icon: "check-circle", label: "IA validé" },
  rejected: { color: "#EF4444", icon: "times-circle", label: "Rejeté" },
  flagged: { color: "#F59E0B", icon: "exclamation-circle", label: "À vérifier" },
};

export default function ChallengeDetailScreen({ navigation }: any) {
  const route = useRoute<any>();
  const challengeId = Number(route?.params?.id ?? 0);

  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setIsAuthed(!!data.session);
        setCurrentUserId(data.session?.user.id ?? null);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setIsAuthed(!!session);
        setCurrentUserId(session?.user.id ?? null);
      }
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!challengeId) { setLoading(false); return; }
    let mounted = true;
    const load = async () => {
      const [{ data: ch }, { data: resp }] = await Promise.all([
        supabase.from("challenges")
          .select("id,user_id,pseudo,avatar_url,title,description,sport,target_value,unit,ranked,bet_enabled,bet_amount,created_at,ai_status")
          .eq("id", challengeId)
          .maybeSingle(),
        supabase.from("challenge_responses")
          .select("id,user_id,pseudo,avatar_url,video_url,votes,is_winner,created_at")
          .eq("challenge_id", challengeId)
          .order("votes", { ascending: false })
          .limit(20),
      ]);
      if (!mounted) return;
      setChallenge(ch as unknown as ChallengeData | null);
      setResponses((resp as unknown as Response[]) || []);
      setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [challengeId]);

  const handleShare = async () => {
    if (!challenge) return;
    await Share.share({
      title: `Défi IMMORTAL-K : ${challenge.title}`,
      message: `🔥 Défi ${challenge.sport.toUpperCase()} sur IMMORTAL ARENA\n« ${challenge.title} »\n\nRelève le défi et montre ce que tu vaux !`,
    });
  };

  const handleVote = async (responseId: number) => {
    if (!currentUserId || votingId) return;
    setVotingId(responseId);
    const current = responses.find((r) => r.id === responseId)?.votes ?? 0;
    const { error } = await supabase.rpc("increment_votes", { row_id: responseId });
    if (error) {
      await supabase.from("challenge_responses").update({ votes: current + 1 }).eq("id", responseId);
    }
    setResponses((prev) => prev.map((r) => r.id === responseId ? { ...r, votes: (r.votes || 0) + 1 } : r));
    setVotingId(null);
  };

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 80 }} />
      </ScreenContainer>
    );
  }

  if (!isAuthed) {
    return (
      <ScreenContainer>
        <View style={styles.lockedCard}>
          <FontAwesome5 name="lock" size={36} color={COLORS.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.kicker}>ACCÈS RESTREINT</Text>
          <Text style={styles.heroTitle}>Connecte-toi pour voir le détail</Text>
          <Text style={styles.subtitle}>Stats, participants, vidéos et lives sont réservés aux membres.</Text>
          <View style={styles.actions}>
            <AppButton label="Connexion" onPress={() => navigation?.navigate("Login")} />
            <AppButton label="Inscription" variant="ghost" onPress={() => navigation?.navigate("Register")} />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (!challenge) {
    return (
      <ScreenContainer>
        <View style={styles.lockedCard}>
          <FontAwesome5 name="exclamation-triangle" size={36} color={COLORS.textMuted} style={{ marginBottom: 16 }} />
          <Text style={styles.heroTitle}>Défi introuvable</Text>
          <Text style={styles.subtitle}>Ce défi n'existe pas ou a été supprimé.</Text>
          <AppButton label="Retour" size="sm" variant="ghost" style={{ marginTop: 16 }} onPress={() => navigation?.goBack()} />
        </View>
      </ScreenContainer>
    );
  }

  const aiCfg = challenge.ai_status ? AI_CONFIG[challenge.ai_status] : null;
  const topResponse = responses[0];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Hero défi */}
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <UserAvatar uri={challenge.avatar_url} label={challenge.pseudo || "?"} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>DÉFI #{challenge.id}</Text>
              <Text style={styles.heroTitle} numberOfLines={2}>{challenge.title}</Text>
              <Text style={styles.author}>{challenge.pseudo || `Joueur`}</Text>
            </View>
            {aiCfg && (
              <View style={[styles.aiBadge, { borderColor: aiCfg.color + "55", backgroundColor: aiCfg.color + "15" }]}>
                <FontAwesome5 name={aiCfg.icon as any} size={10} color={aiCfg.color} />
                <Text style={[styles.aiLabel, { color: aiCfg.color }]}>{aiCfg.label}</Text>
              </View>
            )}
          </View>

          <Text style={styles.description}>{challenge.description}</Text>

          <View style={styles.pillsRow}>
            <View style={styles.sportPill}>
              <FontAwesome5 name="dumbbell" size={10} color={COLORS.primary} />
              <Text style={styles.sportPillText}>{challenge.sport.toUpperCase()}</Text>
            </View>
            <View style={styles.pill}>
              <FontAwesome5 name="bullseye" size={10} color={COLORS.textMuted} />
              <Text style={styles.pillText}>{challenge.target_value} {challenge.unit}</Text>
            </View>
            {challenge.ranked && (
              <View style={[styles.pill, styles.pillGold]}>
                <FontAwesome5 name="trophy" size={9} color={COLORS.primary} />
                <Text style={[styles.pillText, { color: COLORS.primary }]}>Classé</Text>
              </View>
            )}
            {challenge.bet_enabled && (
              <View style={[styles.pill, styles.pillBet]}>
                <FontAwesome5 name="coins" size={9} color="#F59E0B" />
                <Text style={[styles.pillText, { color: "#F59E0B" }]}>{challenge.bet_amount} coins</Text>
              </View>
            )}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{responses.length}</Text>
              <Text style={styles.statLabel}>Réponses</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{responses.reduce((s, r) => s + (r.votes || 0), 0)}</Text>
              <Text style={styles.statLabel}>Votes total</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{new Date(challenge.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</Text>
              <Text style={styles.statLabel}>Date</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <AppButton
              label="Participer"
              size="sm"
              onPress={() => navigation?.navigate("RespondChallenge", { id: challengeId, sport: challenge.sport, title: challenge.title })}
            />
            <AppButton label="Partager" size="sm" variant="ghost" onPress={handleShare} />
          </View>
        </View>

        {/* Leader actuel */}
        {topResponse && (
          <View style={styles.leaderSection}>
            <View style={styles.sectionHead}>
              <FontAwesome5 name="crown" size={13} color="#D4AF37" />
              <Text style={styles.sectionTitle}>Leader actuel</Text>
            </View>
            <View style={styles.leaderCard}>
              <UserAvatar uri={topResponse.avatar_url} label={topResponse.pseudo || "?"} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.leaderName}>{topResponse.pseudo || "Joueur"}</Text>
                <Text style={styles.leaderDate}>{new Date(topResponse.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</Text>
              </View>
              <View style={styles.voteBadge}>
                <FontAwesome5 name="thumbs-up" size={11} color={COLORS.primary} />
                <Text style={styles.voteCount}>{topResponse.votes ?? 0}</Text>
              </View>
            </View>
            <VideoPlayer
              uri={topResponse.video_url}
              style={{ height: 200, width: "100%" }}
              contentFit="cover"
              autoPlay={false}
              shouldPlay={false}
              allowUserToggle
              showControlButton
            />
          </View>
        )}

        {/* Toutes les réponses */}
        {responses.length > 1 && (
          <View style={styles.responsesSection}>
            <View style={styles.sectionHead}>
              <FontAwesome5 name="video" size={13} color="#60A5FA" />
              <Text style={styles.sectionTitle}>Toutes les performances ({responses.length})</Text>
            </View>
            {responses.map((resp, index) => (
              <View key={resp.id} style={[styles.respCard, index === 0 && { borderColor: "#D4AF3755" }]}>
                <View style={styles.respHeader}>
                  <UserAvatar uri={resp.avatar_url} label={resp.pseudo || "?"} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.respName}>{resp.pseudo || "Joueur"}</Text>
                    <Text style={styles.respDate}>{new Date(resp.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</Text>
                  </View>
                  <View style={styles.respRight}>
                    <TouchableOpacity
                      style={[styles.voteBtn, votingId === resp.id && { opacity: 0.5 }]}
                      onPress={() => handleVote(resp.id)}
                      disabled={!currentUserId || votingId !== null}
                    >
                      <FontAwesome5 name="thumbs-up" size={11} color={COLORS.primary} />
                      <Text style={styles.voteBtnText}>{resp.votes ?? 0}</Text>
                    </TouchableOpacity>
                    {resp.is_winner && <FontAwesome5 name="crown" size={12} color="#D4AF37" />}
                  </View>
                </View>
                <VideoPlayer
                  uri={resp.video_url}
                  style={{ height: 160, width: "100%" }}
                  contentFit="cover"
                  autoPlay={false}
                  shouldPlay={false}
                  allowUserToggle
                  showControlButton
                />
              </View>
            ))}
          </View>
        )}

        {responses.length === 0 && (
          <View style={styles.emptyBox}>
            <FontAwesome5 name="video" size={28} color={COLORS.textMuted} style={{ marginBottom: 10 }} />
            <Text style={styles.emptyTitle}>Aucune réponse pour l'instant</Text>
            <Text style={styles.emptyText}>Sois le premier à relever ce défi !</Text>
            <AppButton
              label="Répondre au défi"
              size="sm"
              style={{ marginTop: 14 }}
              onPress={() => navigation?.navigate("RespondChallenge", { id: challengeId, sport: challenge.sport, title: challenge.title })}
            />
          </View>
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
  lockedCard: {
    padding: 28, borderRadius: 22, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)", backgroundColor: "rgba(12,12,16,0.92)",
    alignItems: "center", marginTop: 40,
  },
  heroHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  kicker: { fontSize: 11, letterSpacing: 3, color: COLORS.textMuted, fontWeight: "700" },
  heroTitle: { ...TYPO.display, color: COLORS.text, marginTop: 4 },
  author: { color: COLORS.textMuted, fontSize: 12, marginTop: 2, fontWeight: "600" },
  subtitle: { ...TYPO.subtitle, color: COLORS.textMuted, marginTop: 4, textAlign: "center" },
  description: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  aiBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, flexShrink: 0,
  },
  aiLabel: { fontSize: 10, fontWeight: "700" },
  pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  pillGold: { backgroundColor: "rgba(212,175,55,0.1)", borderColor: "rgba(212,175,55,0.3)" },
  pillBet: { backgroundColor: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.3)" },
  pillText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600" },
  sportPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.12)", borderWidth: 1, borderColor: "rgba(212,175,55,0.25)",
  },
  sportPillText: { color: COLORS.primary, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, alignItems: "center",
    borderColor: "rgba(148,163,184,0.2)", backgroundColor: "rgba(3,7,18,0.6)",
  },
  statValue: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  statLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 3, textTransform: "uppercase" },
  actions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  leaderSection: {
    borderRadius: 18, borderWidth: 1, borderColor: "rgba(212,175,55,0.3)",
    backgroundColor: COLORS.surface, overflow: "hidden",
  },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, paddingBottom: 10 },
  sectionTitle: { color: COLORS.text, fontWeight: "800", fontSize: 14 },
  leaderCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingBottom: 10 },
  leaderName: { color: COLORS.text, fontWeight: "700", fontSize: 14 },
  leaderDate: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  voteBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "rgba(3,7,18,0.8)", borderWidth: 1, borderColor: COLORS.border,
  },
  voteCount: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  responsesSection: { gap: 10 },
  respCard: {
    borderRadius: 18, borderWidth: 1, borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: COLORS.surface, overflow: "hidden",
  },
  respHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, paddingBottom: 8 },
  respName: { color: COLORS.text, fontWeight: "700", fontSize: 13 },
  respDate: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  respRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  voteBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.1)", borderWidth: 1, borderColor: "rgba(212,175,55,0.3)",
  },
  voteBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  emptyBox: {
    alignItems: "center", padding: 32, borderRadius: 18, borderWidth: 1,
    borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  emptyTitle: { color: COLORS.text, fontWeight: "800", fontSize: 15, marginBottom: 4 },
  emptyText: { color: COLORS.textMuted, fontSize: 12, textAlign: "center" },
});
