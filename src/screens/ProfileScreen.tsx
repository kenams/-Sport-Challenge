// Profil : identité, territoire déclaré, progression issue du serveur, records personnels, performances, accès modération/Pro.
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { FontAwesome5 } from "@expo/vector-icons";
import { supabase } from "../supabase";
import ScreenContainer from "../components/ScreenContainer";
import UserAvatar from "../components/UserAvatar";
import StatusBadge from "../components/immortal/StatusBadge";
import ErrorState from "../components/immortal/ErrorState";
import EmptyState from "../components/immortal/EmptyState";
import ActionButton from "../components/immortal/ActionButton";
import ProfileSetupForm from "../components/immortal/ProfileSetupForm";
import DeleteAccountFlow from "../components/immortal/DeleteAccountFlow";
import { COLORS } from "../theme";
import { ensurePlayer, getMyBest, getMyPrivateProfile, getMyProfile, getMyStats, isModerator, listMyAttempts } from "../services/api";
import { FALLBACK_FORMATS, formatLabel } from "../domain/formats";
import type { Attempt, MyPrivateProfile, MyProfile, MyStats } from "../domain/types";
import { computeBadges, nextObjective } from "./helpers/profileStats";
import { calculateAge } from "./helpers/validation";

type Records = Record<string, number | null>;

function privateProfileLine(value: MyPrivateProfile | null): string {
  if (!value) return "Données sportives non renseignées";
  const age = value.birth_date ? calculateAge(value.birth_date) : null;
  const gender = value.gender ? ({ male: "Homme", female: "Femme", other: "Autre", prefer_not_to_say: "Non précisé" } as const)[value.gender] : null;
  const parts = [age !== null ? age + " ans" : null, gender, value.height_cm ? value.height_cm + " cm" : null, value.weight_kg ? Number(value.weight_kg) + " kg" : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Données sportives non renseignées";
}

function territoryLine(profile: MyProfile): string {
  const parts = [profile.city, profile.region, profile.country].map((p) => (p ?? "").trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : "Territoire non renseigné";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

export default function ProfileScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [privateProfile, setPrivateProfile] = useState<MyPrivateProfile | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);
  const [records, setRecords] = useState<Records>({});
  const [moderator, setModerator] = useState(false);
  const [editing, setEditing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    setError(null);
    await ensurePlayer();
    const [profileRes, statsRes, privateRes, attemptsRes, mod, best1, best2] = await Promise.all([
      getMyProfile(),
      getMyStats(),
      getMyPrivateProfile(),
      listMyAttempts(30),
      isModerator().catch(() => false),
      getMyBest("pushups_60s"),
      getMyBest("pullups_max"),
    ]);
    if (profileRes.error) setError(profileRes.error);
    setProfile(profileRes.data);
    setStats(statsRes.data);
    setPrivateProfile(privateRes.data);
    setAttempts(attemptsRes.data ?? []);
    setAttemptsError(attemptsRes.error);
    setRecords({ pushups_60s: best1, pullups_max: best2 });
    setModerator(mod);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const signOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const needsSetup = !loading && !error && profile !== null && !(profile.pseudo ?? "").trim();
  const missingProfile = !loading && !error && profile === null;
  const badges = computeBadges(attempts);

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.primary} />}
      >
        {loading ? (
          <View style={styles.center} accessibilityLabel="Chargement du profil">
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : error ? (
          <ErrorState message={error} onRetry={() => load()} />
        ) : needsSetup || missingProfile ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle} accessibilityRole="header">
              Termine ton profil
            </Text>
            <ProfileSetupForm
              intro="Choisis ton pseudo public et indique ton territoire pour apparaître dans les records."
              initialPrivateProfile={privateProfile}
              initialAvatarUrl={profile?.avatar_url}
              initialTerritory={{ country: profile?.country ?? "", region: profile?.region ?? "", city: profile?.city ?? "" }}
              submitLabel="Enregistrer mon profil"
              onSaved={() => load()}
            />
            <ActionButton label="Me déconnecter" variant="link" onPress={signOut} loading={signingOut} />
          </View>
        ) : profile ? (
          <>
            <View style={styles.card}>
              {editing ? (
                <>
                  <Text style={styles.cardTitle} accessibilityRole="header">
                    Modifier mon profil
                  </Text>
                  <ProfileSetupForm
                    initialPseudo={profile.pseudo}
                    initialPrivateProfile={privateProfile}
                    initialAvatarUrl={profile.avatar_url}
                    initialTerritory={{ country: profile.country ?? "", region: profile.region ?? "", city: profile.city ?? "" }}
                    submitLabel="Enregistrer"
                    onSaved={() => {
                      setEditing(false);
                      load("refresh");
                    }}
                    onCancel={() => setEditing(false)}
                  />
                </>
              ) : (
                <>
                  <View style={styles.identity}>
                    <UserAvatar uri={profile.avatar_url} label={profile.pseudo ?? "?"} size={64} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.pseudo} numberOfLines={1} accessibilityRole="header">
                        {profile.pseudo}
                      </Text>
                      <Text style={styles.muted}>{territoryLine(profile)}</Text>
                      <Text style={styles.tiny}>Territoire déclaré, non vérifié</Text>
                      <Text style={styles.tiny}>Privé · {privateProfileLine(privateProfile)}</Text>
                    </View>
                  </View>
                  <ActionButton label="Modifier mon profil" variant="ghost" onPress={() => setEditing(true)} />
                </>
              )}
            </View>

            <View style={styles.statsRow}>
              <Stat value={stats ? String(stats.level) : "-"} label="Niveau" />
              <Stat value={stats ? String(stats.points) : "-"} label="Points" />
              <Stat value={stats ? String(stats.validated_count) : "-"} label="Validées" />
            </View>
            <Text style={styles.tiny}>Niveau et points sont calculés par le serveur à partir de tes performances validées.</Text>

            <Text style={styles.section} accessibilityRole="header">
              Records personnels
            </Text>
            {FALLBACK_FORMATS.map((format) => {
              const best = records[format.key] ?? null;
              return (
                <View key={format.key} style={styles.card}>
                  <Text style={styles.cardTitle}>{format.label_fr}</Text>
                  <View style={styles.recordRow}>
                    <Text style={[styles.recordValue, best === null ? { color: COLORS.textMuted } : null]}>{best ?? "-"}</Text>
                    <Text style={styles.muted}>{best === null ? "Aucune performance validée" : "meilleur score validé"}</Text>
                  </View>
                  <View style={styles.objective}>
                    <FontAwesome5 name="bullseye" size={13} color={COLORS.primary} />
                    <Text style={styles.objectiveText}>Prochain objectif : {nextObjective(best)}</Text>
                  </View>
                </View>
              );
            })}

            <Text style={styles.section} accessibilityRole="header">
              Badges
            </Text>
            <View style={styles.badges}>
              {badges.map((badge) => (
                <View
                  key={badge.key}
                  accessible
                  accessibilityLabel={`${badge.label}. ${badge.earned ? "Obtenu" : "Pas encore obtenu"}. ${badge.description}`}
                  style={[styles.badge, badge.earned ? styles.badgeOn : null]}
                >
                  <FontAwesome5 name={badge.earned ? "check-circle" : "circle"} size={16} color={badge.earned ? COLORS.primary : COLORS.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.badgeLabel, !badge.earned ? { color: COLORS.textMuted } : null]}>{badge.label}</Text>
                    <Text style={styles.tiny}>{badge.earned ? "Obtenu" : badge.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.section} accessibilityRole="header">
              Mes performances
            </Text>
            {attemptsError ? (
              <ErrorState message={attemptsError} onRetry={() => load("refresh")} />
            ) : attempts.length === 0 ? (
              <EmptyState
                title="Aucune performance pour l'instant"
                message="Lance un défi ou réponds à un défi : ta performance apparaîtra ici avec son statut."
                actionLabel="Lancer un défi"
                onAction={() => navigation.navigate("CreateChallenge")}
              />
            ) : (
              attempts.map((attempt) => (
                <View key={attempt.id} style={styles.card}>
                  <View style={styles.attemptHead}>
                    <Text style={styles.attemptTitle} numberOfLines={2}>
                      {formatLabel(attempt.format_key)}
                    </Text>
                    <StatusBadge status={attempt.status} compact />
                  </View>
                  <Text style={styles.muted}>
                    Score déclaré : {attempt.declared_score}
                    {attempt.status === "validated" && attempt.decided_score !== null ? `  ·  Score retenu : ${attempt.decided_score}` : ""}
                  </Text>
                  {attempt.status === "rejected" && attempt.decision_reason ? <Text style={styles.reason}>Motif : {attempt.decision_reason}</Text> : null}
                  {attempt.video_removed ? <Text style={styles.reason}>Vidéo retirée par la modération.</Text> : null}
                  <Text style={styles.tiny}>{formatDate(attempt.created_at)}</Text>
                </View>
              ))
            )}

            <View style={styles.actions}>
              {moderator ? (
                <MenuRow icon="shield-alt" label="Modération" hint="Valider ou rejeter des performances" onPress={() => navigation.navigate("Moderation")} />
              ) : null}
              <MenuRow icon="crown" label="IMMORTAL Pro" hint="Voir ce que comprend l'offre" onPress={() => navigation.navigate("Pro")} />
              <ActionButton label="Me déconnecter" variant="danger" onPress={signOut} loading={signingOut} />
              <ActionButton label="Supprimer mon compte" variant="link" onPress={() => setDeleting(true)} accessibilityHint="Supprime définitivement ton compte et tes données" />
            </View>
          </>
        ) : null}
      </ScrollView>
      <DeleteAccountFlow visible={deleting} onClose={() => setDeleting(false)} onDeleted={() => setDeleting(false)} />
    </ScreenContainer>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} : ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({ icon, label, hint, onPress }: { icon: string; label: string; hint: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={[styles.menuRow, Platform.OS === "web" ? ({ cursor: "pointer" } as object) : null]}
    >
      <FontAwesome5 name={icon as any} size={16} color={COLORS.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        <Text style={styles.tiny}>{hint}</Text>
      </View>
      <FontAwesome5 name="chevron-right" size={12} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40, gap: 12, width: "100%", maxWidth: 720, alignSelf: "center" },
  center: { paddingVertical: 60, alignItems: "center" },
  card: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16, gap: 10 },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  identity: { flexDirection: "row", alignItems: "center", gap: 14 },
  pseudo: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  muted: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
  tiny: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  statsRow: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 14, alignItems: "center" },
  statValue: { color: COLORS.primary, fontSize: 26, fontWeight: "900" },
  statLabel: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  section: { color: COLORS.primary, fontSize: 13, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase", marginTop: 12 },
  recordRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  recordValue: { color: COLORS.text, fontSize: 34, fontWeight: "900" },
  objective: { flexDirection: "row", alignItems: "center", gap: 8 },
  objectiveText: { color: COLORS.text, fontSize: 14, flex: 1 },
  badges: { gap: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  badgeOn: { borderColor: "rgba(212,175,55,0.5)", backgroundColor: "rgba(212,175,55,0.08)" },
  badgeLabel: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  attemptHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  attemptTitle: { color: COLORS.text, fontSize: 15, fontWeight: "800", flex: 1 },
  reason: { color: "#F87171", fontSize: 13, lineHeight: 18 },
  actions: { gap: 10, marginTop: 16 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 56, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  menuLabel: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
});
