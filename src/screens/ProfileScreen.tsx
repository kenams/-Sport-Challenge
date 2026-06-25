// src/screens/ProfileScreen.tsx
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { COLORS, TYPO } from "../theme";
import AppButton from "../components/AppButton";
import VideoPlayer from "../components/VideoPlayer";
import UserAvatar from "../components/UserAvatar";

interface Profile {
  pseudo?: string | null;
  avatar_url?: string | null;
  department?: string | null;
  gender?: string | null;
}

interface Stats {
  points: number;
  title?: string | null;
  fair_play_score: number;
  level?: number | null;
}

interface Wallet { coins: number }

const GENDERS = [
  { value: "male", label: "Homme" },
  { value: "female", label: "Femme" },
  { value: "other", label: "Autre" },
];

export default function ProfileScreen({ navigation }: any) {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>({});
  const [stats, setStats] = useState<Stats>({ points: 0, fair_play_score: 100 });
  const [wallet, setWallet] = useState<Wallet>({ coins: 0 });
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editPseudo, setEditPseudo] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editGender, setEditGender] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setUserId(data.session?.user.id ?? null);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let active = true;
    const load = async () => {
      setLoading(true);
      const [{ data: prof }, { data: st }, { data: wal }, { data: resp }] = await Promise.all([
        supabase.from("profiles").select("pseudo,avatar_url,department,gender").eq("user_id", userId).maybeSingle(),
        supabase.from("players_stats").select("points,title,fair_play_score,level").eq("user_id", userId).maybeSingle(),
        supabase.from("wallets").select("coins").eq("user_id", userId).maybeSingle(),
        supabase.from("challenge_responses")
          .select("id,challenge_id,video_url,created_at,votes,is_winner,challenges(title,sport)")
          .eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      ]);
      if (!active) return;
      if (prof) setProfile(prof as Profile);
      if (st) setStats(st as Stats);
      if (wal) setWallet(wal as Wallet);
      setResponses(resp || []);
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const openEdit = () => {
    setEditPseudo(profile.pseudo || "");
    setEditDept(profile.department || "");
    setEditGender(profile.gender || "");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!userId) return;
    if (!editPseudo.trim()) return Alert.alert("Pseudo manquant", "Le pseudo ne peut pas être vide.");
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert(
      { user_id: userId, pseudo: editPseudo.trim(), department: editDept.trim() || null, gender: editGender || null },
      { onConflict: "user_id" }
    );
    setSaving(false);
    if (error) return Alert.alert("Erreur", error.message);
    setProfile((prev) => ({ ...prev, pseudo: editPseudo.trim(), department: editDept.trim() || null, gender: editGender || null }));
    setEditing(false);
  };

  const displayName = profile.pseudo || "Joueur";
  const fairPlayColor =
    stats.fair_play_score >= 80 ? COLORS.success :
    stats.fair_play_score >= 50 ? "#F59E0B" : COLORS.danger;

  if (!userId) {
    return (
      <ScreenContainer>
        <View style={styles.lockedCard}>
          <FontAwesome5 name="user-lock" size={40} color={COLORS.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.kicker}>ACCÈS RÉSERVÉ</Text>
          <Text style={styles.heroTitle}>Ton profil t'attend</Text>
          <Text style={styles.subtitle}>Connecte-toi pour accéder à tes stats, ton wallet et tes performances.</Text>
          <View style={styles.actions}>
            <AppButton label="Connexion" onPress={() => navigation?.navigate("Login")} />
            <AppButton label="Inscription" variant="ghost" onPress={() => navigation?.navigate("Register")} />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Hero identité */}
        <View style={styles.heroCard}>
          <View style={styles.avatarRow}>
            <UserAvatar uri={profile.avatar_url} label={displayName} size={72} />
            <View style={styles.identity}>
              <Text style={styles.pseudo} numberOfLines={1}>{displayName}</Text>
              <View style={styles.titlePill}>
                <FontAwesome5 name="fire" size={10} color={COLORS.primary} />
                <Text style={styles.titleText}>{stats.title || "Rookie"}</Text>
              </View>
              {profile.department && (
                <View style={styles.deptRow}>
                  <FontAwesome5 name="map-marker-alt" size={10} color={COLORS.textMuted} />
                  <Text style={styles.deptText}>Dép. {profile.department}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.editIcon} onPress={openEdit}>
              <FontAwesome5 name="pen" size={11} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Formulaire édition inline */}
          {editing && (
            <View style={styles.editForm}>
              <Text style={styles.editTitle}>Modifier le profil</Text>

              <Text style={styles.editLabel}>Pseudo</Text>
              <TextInput
                value={editPseudo}
                onChangeText={setEditPseudo}
                style={styles.editInput}
                placeholderTextColor={COLORS.textMuted}
                maxLength={30}
                autoCapitalize="none"
              />

              <Text style={styles.editLabel}>Département (ex: 75)</Text>
              <TextInput
                value={editDept}
                onChangeText={setEditDept}
                style={styles.editInput}
                placeholderTextColor={COLORS.textMuted}
                placeholder="75"
                keyboardType="number-pad"
                maxLength={3}
              />

              <Text style={styles.editLabel}>Genre</Text>
              <View style={styles.genderRow}>
                {GENDERS.map((g) => (
                  <TouchableOpacity
                    key={g.value}
                    style={[styles.genderChip, editGender === g.value && styles.genderChipActive]}
                    onPress={() => setEditGender(g.value)}
                  >
                    <Text style={[styles.genderText, editGender === g.value && styles.genderTextActive]}>{g.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.editActions}>
                <AppButton label={saving ? "Sauvegarde..." : "Sauvegarder"} size="sm" onPress={handleSave} loading={saving} />
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Stats grille */}
          <View style={styles.statsGrid}>
            {[
              { label: "Points XP", value: stats.points.toLocaleString("fr-FR"), icon: "star" },
              { label: "Niveau", value: String(stats.level ?? 1), icon: "layer-group" },
              { label: "Coins", value: wallet.coins.toLocaleString("fr-FR"), icon: "coins" },
            ].map((s) => (
              <View key={s.label} style={styles.statCard}>
                <FontAwesome5 name={s.icon as any} size={14} color={COLORS.primary} />
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Fair Play */}
          <View style={styles.fairPlayRow}>
            <FontAwesome5 name="shield-alt" size={12} color={fairPlayColor} />
            <Text style={styles.fairPlayLabel}>Fair Play</Text>
            <View style={styles.fairPlayBar}>
              <View style={[styles.fairPlayFill, {
                width: `${stats.fair_play_score}%` as any,
                backgroundColor: fairPlayColor,
              }]} />
            </View>
            <Text style={[styles.fairPlayScore, { color: fairPlayColor }]}>
              {stats.fair_play_score}/100
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <FontAwesome5 name="sign-out-alt" size={12} color={COLORS.textMuted} />
              <Text style={styles.logoutText}>Déconnexion</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Performances */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mes performances</Text>
            <Text style={styles.sectionSubtitle}>Tes dernières soumissions vidéo.</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
          ) : responses.length === 0 ? (
            <View style={styles.emptyBox}>
              <FontAwesome5 name="video" size={28} color={COLORS.textMuted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>Aucune performance</Text>
              <Text style={styles.emptyText}>Réponds à un défi pour apparaître ici.</Text>
              <AppButton
                label="Voir les défis"
                size="sm"
                style={{ marginTop: 14 }}
                onPress={() => navigation?.navigate("MainTabs", { screen: "Defis" })}
              />
            </View>
          ) : (
            <View style={styles.responseList}>
              {responses.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.responseCard}
                  activeOpacity={0.85}
                  onPress={() => item.challenge_id && navigation?.navigate("ChallengeDetail", { id: item.challenge_id })}
                >
                  <View style={styles.responseHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.responseTitle} numberOfLines={1}>
                        {item?.challenges?.title || `Défi #${item.challenge_id}`}
                      </Text>
                      <View style={styles.responseMeta}>
                        {item?.challenges?.sport && (
                          <View style={styles.sportPill}>
                            <Text style={styles.sportPillText}>{item.challenges.sport.toUpperCase()}</Text>
                          </View>
                        )}
                        <Text style={styles.responseDate}>
                          {new Date(item.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.voteBadge}>
                      <FontAwesome5 name="thumbs-up" size={10} color={item.is_winner ? COLORS.primary : COLORS.textMuted} />
                      <Text style={[styles.voteCount, item.is_winner && { color: COLORS.primary }]}>
                        {item.votes ?? 0}
                      </Text>
                      {item.is_winner && <FontAwesome5 name="crown" size={10} color={COLORS.primary} />}
                    </View>
                  </View>
                  <VideoPlayer
                    uri={item.video_url}
                    style={styles.videoPlayer}
                    contentFit="cover"
                    autoPlay={false}
                    shouldPlay={false}
                    allowUserToggle
                    showControlButton
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 80, gap: 18 },
  heroCard: {
    padding: 20, borderRadius: 22, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)", backgroundColor: "rgba(12,12,16,0.95)",
    gap: 16,
  },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  identity: { flex: 1, gap: 6 },
  pseudo: { ...TYPO.title, color: COLORS.text, fontSize: 22 },
  titlePill: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.12)", borderWidth: 1, borderColor: "rgba(212,175,55,0.3)",
  },
  titleText: { color: COLORS.primary, fontSize: 11, fontWeight: "700" },
  deptRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  deptText: { color: COLORS.textMuted, fontSize: 12 },
  editIcon: {
    width: 32, height: 32, borderRadius: 10, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)", backgroundColor: "rgba(212,175,55,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  editForm: {
    padding: 16, borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.25)", backgroundColor: "rgba(3,7,18,0.7)", gap: 8,
  },
  editTitle: { color: COLORS.primary, fontWeight: "800", fontSize: 13, marginBottom: 4 },
  editLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  editInput: {
    borderWidth: 1, borderColor: "rgba(148,163,184,0.25)", borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, color: COLORS.text,
    backgroundColor: "rgba(5,5,7,0.9)", fontSize: 13,
  },
  genderRow: { flexDirection: "row", gap: 8 },
  genderChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: "rgba(5,5,7,0.7)",
  },
  genderChipActive: { borderColor: COLORS.primary, backgroundColor: "rgba(212,175,55,0.15)" },
  genderText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  genderTextActive: { color: COLORS.primary, fontWeight: "700" },
  editActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  cancelBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(148,163,184,0.2)",
  },
  cancelText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  statsGrid: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1, alignItems: "center", padding: 12, borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)", backgroundColor: "rgba(3,7,18,0.7)", gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  statLabel: { fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  fairPlayRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)", backgroundColor: "rgba(3,7,18,0.5)",
  },
  fairPlayLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600" },
  fairPlayBar: {
    flex: 1, height: 4, borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden",
  },
  fairPlayFill: { height: "100%", borderRadius: 99 },
  fairPlayScore: { fontSize: 11, fontWeight: "700", minWidth: 40, textAlign: "right" },
  actions: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(148,163,184,0.2)",
  },
  logoutText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  lockedCard: {
    padding: 28, borderRadius: 22, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)", backgroundColor: "rgba(12,12,16,0.92)",
    alignItems: "center", marginTop: 40,
  },
  kicker: { fontSize: 11, letterSpacing: 3, color: COLORS.textMuted, fontWeight: "700" },
  heroTitle: { ...TYPO.display, color: COLORS.text, marginTop: 6, textAlign: "center" },
  subtitle: { ...TYPO.subtitle, color: COLORS.textMuted, marginTop: 6, textAlign: "center", lineHeight: 18 },
  section: { gap: 12 },
  sectionHeader: { gap: 2 },
  sectionTitle: { ...TYPO.title, color: COLORS.text },
  sectionSubtitle: { color: COLORS.textMuted, fontSize: 12 },
  emptyBox: { alignItems: "center", padding: 24, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  emptyTitle: { color: COLORS.text, fontWeight: "800", fontSize: 15 },
  emptyText: { color: COLORS.textMuted, fontSize: 12, textAlign: "center", marginTop: 4 },
  responseList: { gap: 12 },
  responseCard: {
    borderRadius: 18, borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)", backgroundColor: COLORS.surface,
    overflow: "hidden",
  },
  responseHeader: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 14, paddingBottom: 10,
  },
  responseTitle: { color: COLORS.text, fontWeight: "700", fontSize: 14 },
  responseMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  sportPill: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.12)", borderWidth: 1, borderColor: "rgba(212,175,55,0.25)",
  },
  sportPillText: { color: COLORS.primary, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  responseDate: { color: COLORS.textMuted, fontSize: 11 },
  voteBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "rgba(3,7,18,0.8)", borderWidth: 1, borderColor: COLORS.border,
  },
  voteCount: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  videoPlayer: { height: 180, width: "100%" },
});
