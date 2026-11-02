import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { FontAwesome5 } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import UserAvatar from "../components/UserAvatar";
import { FALLBACK_FORMATS, formatLabel } from "../domain/formats";
import type { Attempt, FormatKey } from "../domain/types";
import { supabase } from "../supabase";
import { COLORS } from "../theme";

type Group = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  description: string | null;
  recruiting_scope: "private" | "city" | "region";
  recruiting_city: string | null;
  recruiting_region: string | null;
  created_at: string;
};
type Member = { user_id: string; pseudo: string | null; avatar_url: string | null; is_owner: boolean; joined_at: string };
type Discovery = { group_id: string; group_name: string; group_description: string | null; recruiting_scope: "city" | "region"; territory: string | null; owner_pseudo: string | null; member_count: number; created_at: string };
type GroupChallenge = {
  id: string; challenger_group_id: string; challenger_group_name: string;
  challenged_group_id: string; challenged_group_name: string; created_by_pseudo: string | null;
  format_key: FormatKey; participant_count: number; status: "proposed" | "accepted" | "declined" | "finished"; created_at: string;
};
type TeamLine = { group_id: string; group_name: string; required_count: number; joined_count: number; submitted_count: number; total_score: number; complete: boolean };
type Participation = { group_id: string; attempt_id: string | null } | null;

function errorMessage(error: any): string {
  const raw = String(error?.message ?? "");
  const messages: Record<string, string> = {
    pro_required: "La création d’un groupe est disponible pour tous les joueurs.",
    group_limit: "Tu as atteint ta limite de groupes créés.",
    group_city_required: "Ajoute ta ville dans ton profil pour recruter dans ta ville.",
    group_region_required: "Ajoute ta région dans ton profil pour recruter dans ta région.",
    group_full: "Ce groupe est complet.",
    invalid_code: "Code d’invitation invalide.",
    group_recruitment_not_available: "Ce groupe ne recrute pas dans le secteur choisi.",
    group_territory_mismatch: "Ton secteur de profil ne correspond pas à celui du groupe.",
    group_roster_too_small: "Ton groupe n’a pas encore assez de membres.",
    opponent_roster_too_small: "Le groupe adverse n’a pas assez de membres pour ce format.",
    group_challenge_full: "Toutes les places de cette équipe sont prises.",
    group_challenge_not_open: "Ce défi de groupe n’accepte plus de participants.",
    invalid_group_attempt: "Choisis une performance validée dans le même format.",
    forbidden: "Cette action est réservée aux membres ou au responsable du groupe.",
    rate_limited: "Trop d’essais. Réessaie un peu plus tard.",
  };
  for (const [key, value] of Object.entries(messages)) if (raw.includes(key)) return value;
  return error?.message || "Une erreur est survenue. Réessaie.";
}

function Action({ label, onPress, disabled = false, secondary = false, icon }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; icon?: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[styles.action, secondary ? styles.actionSecondary : null, disabled ? styles.disabled : null]}>
      {icon ? <FontAwesome5 name={icon as any} size={13} color={secondary ? COLORS.text : COLORS.background} /> : null}
      <Text style={[styles.actionText, secondary ? styles.actionTextSecondary : null]}>{label}</Text>
    </Pressable>
  );
}

function Field({ value, onChangeText, placeholder, multiline = false, autoCapitalize = "sentences" }: { value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; autoCapitalize?: "none" | "sentences" | "words" | "characters" }) {
  return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#78838D" autoCapitalize={autoCapitalize} multiline={multiline} style={[styles.input, multiline ? styles.textarea : null]} />;
}

export default function GroupsScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = groups.find((group) => group.id === selectedId) ?? null;
  const [members, setMembers] = useState<Member[]>([]);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [challenges, setChallenges] = useState<GroupChallenge[]>([]);
  const [boards, setBoards] = useState<Record<string, TeamLine[]>>({});
  const [participations, setParticipations] = useState<Record<string, Participation>>({});
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"private" | "city" | "region">("private");
  const [inviteCode, setInviteCode] = useState("");
  const [discoverScope, setDiscoverScope] = useState<"city" | "region">("region");
  const [query, setQuery] = useState("");
  const [opponentId, setOpponentId] = useState("");
  const [format, setFormat] = useState<FormatKey>("pushups_60s");
  const [participantCount, setParticipantCount] = useState(1);

  const loadGroups = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    setUserId(userId ?? null);
    if (!userId) { setGroups([]); setSelectedId(null); setLoading(false); return; }
    const membership = await supabase.from("group_members").select("group_id").eq("user_id", userId);
    if (membership.error) { setError(errorMessage(membership.error)); setLoading(false); return; }
    const ids = (membership.data ?? []).map((row: { group_id: string }) => row.group_id);
    if (!ids.length) { setGroups([]); setSelectedId(null); setLoading(false); return; }
    const result = await supabase.from("groups").select("id,name,invite_code,owner_id,description,recruiting_scope,recruiting_city,recruiting_region,created_at").in("id", ids).order("created_at", { ascending: false });
    if (result.error) setError(errorMessage(result.error));
    else {
      const rows = (result.data ?? []) as Group[];
      setGroups(rows);
      setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
      setError(null);
    }
    setLoading(false);
  }, []);

  const loadDiscoveries = useCallback(async () => {
    const result = await supabase.rpc("discover_training_groups", { p_scope: discoverScope, p_query: query.trim() || null });
    if (result.error) setError(errorMessage(result.error));
    else setDiscoveries((result.data ?? []) as Discovery[]);
  }, [discoverScope, query]);

  const loadSelected = useCallback(async () => {
    if (!selectedId) { setMembers([]); setChallenges([]); return; }
    const [memberResult, challengeResult] = await Promise.all([
      supabase.rpc("training_group_members", { p_group: selectedId }),
      supabase.rpc("get_group_challenges", { p_group: selectedId }),
    ]);
    if (memberResult.error) setError(errorMessage(memberResult.error));
    else setMembers((memberResult.data ?? []) as Member[]);
    if (challengeResult.error) setError(errorMessage(challengeResult.error));
    else {
      const rows = (challengeResult.data ?? []) as GroupChallenge[];
      setChallenges(rows);
      const results = await Promise.all(rows.map(async (challenge) => {
        const [board, mine] = await Promise.all([
          supabase.rpc("get_group_challenge_board", { p_challenge: challenge.id }),
          supabase.rpc("get_group_challenge_participation", { p_challenge: challenge.id }),
        ]);
        return {
          id: challenge.id,
          board: (board.data ?? []) as TeamLine[],
          mine: ((mine.data ?? [])[0] as Participation) ?? null,
        };
      }));
      setBoards(Object.fromEntries(results.map((item) => [item.id, item.board])));
      setParticipations(Object.fromEntries(results.map((item) => [item.id, item.mine])));
    }
  }, [selectedId]);

  const loadAttempts = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user?.id) return;
    const result = await supabase.from("attempt_feed").select("*").eq("user_id", auth.user.id).eq("status", "validated").eq("video_removed", false).order("decided_at", { ascending: false }).limit(20);
    if (!result.error) setAttempts((result.data ?? []) as Attempt[]);
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadGroups(), loadDiscoveries(), loadAttempts()]);
  }, [loadGroups, loadDiscoveries, loadAttempts]);

  useFocusEffect(useCallback(() => {
    refresh();
    const timer = setInterval(() => { refresh(); loadSelected(); }, 30000);
    return () => clearInterval(timer);
  }, [refresh, loadSelected]));

  useEffect(() => { loadSelected(); }, [loadSelected]);
  useEffect(() => { loadDiscoveries(); }, [loadDiscoveries]);

  const nearbyOpponents = useMemo(() => discoveries.filter((group) => group.group_id !== selectedId), [discoveries, selectedId]);

  const createGroup = async () => {
    setBusy(true); setError(null); setNotice(null);
    const result = await supabase.rpc("create_training_group", { p_name: name.trim(), p_description: description.trim() || null, p_recruiting_scope: scope });
    setBusy(false);
    if (result.error || !result.data) { setError(errorMessage(result.error)); return; }
    setNotice("Ton groupe est prêt. Partage son code d’invitation avec tes amis.");
    setName(""); setDescription("");
    await loadGroups();
    setSelectedId(result.data as string);
  };

  const joinByCode = async () => {
    setBusy(true); setError(null); setNotice(null);
    const result = await supabase.rpc("join_group", { p_code: inviteCode.trim() });
    setBusy(false);
    if (result.error || !result.data) { setError(result.error ? errorMessage(result.error) : "Code d’invitation invalide."); return; }
    setInviteCode("");
    setNotice("Tu as rejoint le groupe.");
    await loadGroups();
    setSelectedId(result.data as string);
  };

  const joinDiscovered = async (group: Discovery) => {
    setBusy(true); setError(null); setNotice(null);
    const result = await supabase.rpc("join_discovered_group", { p_group: group.group_id });
    setBusy(false);
    if (result.error || !result.data) { setError(errorMessage(result.error)); return; }
    setNotice("Tu as rejoint " + group.group_name + ".");
    await loadGroups();
    setSelectedId(result.data as string);
  };

  const createChallenge = async () => {
    if (!selectedId || !opponentId) { setError("Choisis le groupe adverse."); return; }
    setBusy(true); setError(null); setNotice(null);
    const result = await supabase.rpc("create_group_challenge", { p_challenger_group: selectedId, p_challenged_group: opponentId, p_format_key: format, p_participant_count: participantCount });
    setBusy(false);
    if (result.error) { setError(errorMessage(result.error)); return; }
    setNotice("Défi envoyé. Le responsable du groupe adverse doit l’accepter.");
    await loadSelected();
  };

  const respondChallenge = async (id: string, accept: boolean) => {
    setBusy(true); setError(null);
    const result = await supabase.rpc("respond_group_challenge", { p_challenge: id, p_accept: accept });
    setBusy(false);
    if (result.error) setError(errorMessage(result.error));
    else setNotice(accept ? "Défi accepté. Les membres peuvent rejoindre les équipes." : "Défi refusé.");
    await loadSelected();
  };

  const joinChallenge = async (id: string) => {
    setBusy(true); setError(null);
    const result = await supabase.rpc("join_group_challenge", { p_challenge: id });
    setBusy(false);
    if (result.error) setError(errorMessage(result.error));
    else setNotice("Tu es inscrit dans l’équipe. Ta place est réservée.");
    await loadSelected();
  };

  const linkAttempt = async (id: string, attemptId: string) => {
    setBusy(true); setError(null);
    const result = await supabase.rpc("set_group_challenge_attempt", { p_challenge: id, p_attempt: attemptId });
    setBusy(false);
    if (result.error) setError(errorMessage(result.error));
    else setNotice("Performance ajoutée au défi intergroupes.");
    await loadSelected();
  };

  const scopeName = (group: Group | Discovery) => {
    if (group.recruiting_scope === "private") return "Sur invitation";
    if ("territory" in group) return group.territory || (group.recruiting_scope === "city" ? "Ville" : "Région");
    return group.recruiting_scope === "city" ? group.recruiting_city || "Ville" : group.recruiting_region || "Région";
  };
  const groupLabel = (id: string) => groups.find((g) => g.id === id)?.name ?? discoveries.find((g) => g.group_id === id)?.group_name ?? "Groupe";
  const scopeChoices: Array<{ key: "private" | "city" | "region"; label: string; icon: string }> = [
    { key: "private", label: "Privé", icon: "lock" }, { key: "city", label: "Ma ville", icon: "map-marker-alt" }, { key: "region", label: "Ma région", icon: "map" },
  ];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <View style={styles.headingIcon}><FontAwesome5 name="users" size={20} color={COLORS.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Groupes d’entraînement</Text>
            <Text style={styles.subtitle}>Recrute près de chez toi et défie une autre équipe.</Text>
          </View>
          <Pressable onPress={refresh} accessibilityRole="button" accessibilityLabel="Actualiser les groupes" style={styles.refresh}><FontAwesome5 name="sync-alt" size={15} color={COLORS.primary} /></Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Créer ton groupe</Text>
          <Field value={name} onChangeText={setName} placeholder="Nom du groupe (ex. Les Warriors de Launaguet)" />
          <Field value={description} onChangeText={setDescription} placeholder="Votre esprit d’équipe (facultatif)" multiline />
          <Text style={styles.hint}>Recrutement local : seules la ville ou la région de ton profil seront utilisées. Aucun emplacement GPS.</Text>
          <View style={styles.chips}>
            {scopeChoices.map((choice) => (
              <Pressable key={choice.key} onPress={() => setScope(choice.key)} accessibilityRole="button" style={[styles.chip, scope === choice.key ? styles.chipSelected : null]}>
                <FontAwesome5 name={choice.icon} size={12} color={scope === choice.key ? COLORS.primary : COLORS.textMuted} />
                <Text style={[styles.chipText, scope === choice.key ? styles.chipTextSelected : null]}>{choice.label}</Text>
              </Pressable>
            ))}
          </View>
          <Action label={busy ? "Création…" : "Créer un groupe gratuit"} icon="plus" disabled={busy || name.trim().length < 2} onPress={createGroup} />
          <Text style={styles.hint}>Un groupe créé gratuitement par compte. Les amis peuvent ensuite rejoindre par code.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Rejoindre avec un code</Text>
          <View style={styles.inline}>
            <Field value={inviteCode} onChangeText={setInviteCode} placeholder="Code d’invitation" autoCapitalize="characters" />
            <Action label="Rejoindre" disabled={busy || !inviteCode.trim()} onPress={joinByCode} />
          </View>
        </View>

        {loading ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} /> : null}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Mes groupes</Text>
          {groups.length === 0 && !loading ? <Text style={styles.hint}>Tu n’as pas encore de groupe. Crée le tien ou rejoins celui d’un ami.</Text> : null}
          {groups.map((group) => (
            <Pressable key={group.id} onPress={() => setSelectedId(group.id)} style={[styles.groupRow, selectedId === group.id ? styles.groupSelected : null]}>
              <View style={styles.groupBadge}><FontAwesome5 name="users" size={14} color={COLORS.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.hint}>{scopeName(group)} · {group.owner_id === userId ? "Responsable" : "Membre"}</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={12} color={COLORS.textMuted} />
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Trouver un groupe près de toi</Text>
          <View style={styles.chips}>
            {(["city", "region"] as const).map((key) => (
              <Pressable key={key} onPress={() => setDiscoverScope(key)} style={[styles.chip, discoverScope === key ? styles.chipSelected : null]}>
                <Text style={[styles.chipText, discoverScope === key ? styles.chipTextSelected : null]}>{key === "city" ? "Ma ville" : "Ma région"}</Text>
              </Pressable>
            ))}
          </View>
          <Field value={query} onChangeText={setQuery} placeholder="Filtrer par nom de groupe" />
          {discoveries.length === 0 ? <Text style={styles.hint}>Aucun groupe ouvert trouvé ici. Tu peux partager ton code d’invitation pour lancer le mouvement.</Text> : null}
          {discoveries.map((group) => (
            <View key={group.group_id} style={styles.groupRow}>
              <View style={styles.groupBadge}><FontAwesome5 name="map-marker-alt" size={14} color={COLORS.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupName}>{group.group_name}</Text>
                <Text style={styles.hint}>{group.territory || "Secteur"} · {group.member_count} membre{Number(group.member_count) > 1 ? "s" : ""} · par {group.owner_pseudo || "Joueur"}</Text>
              </View>
              <Action label="Rejoindre" secondary onPress={() => joinDiscovered(group)} disabled={busy} />
            </View>
          ))}
        </View>

        {selected ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{selected.name}</Text>
              {selected.description ? <Text style={styles.body}>{selected.description}</Text> : null}
              <Text style={styles.hint}>{scopeName(selected)} · {members.length} membre{members.length > 1 ? "s" : ""}</Text>
              <Text style={styles.codeLabel}>CODE D’INVITATION</Text>
              <Text selectable style={styles.inviteCode}>{selected.invite_code}</Text>
              <Text style={styles.hint}>Envoie ce code à tes amis. Ils le saisissent dans « Rejoindre avec un code ».</Text>
              <View style={styles.memberList}>
                {members.map((member) => (
                  <View key={member.user_id} style={styles.memberRow}>
                    <UserAvatar uri={member.avatar_url} label={member.pseudo || "Joueur"} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{member.pseudo || "Joueur"}</Text>
                      <Text style={styles.hint}>{member.is_owner ? "Responsable" : "Membre"}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Défier un autre groupe</Text>
              {nearbyOpponents.length === 0 ? <Text style={styles.hint}>Aucun groupe ouvert dans ce secteur. Un ami peut activer le recrutement local et apparaîtra ici.</Text> : null}
              {nearbyOpponents.map((opponent) => (
                <Pressable key={opponent.group_id} onPress={() => setOpponentId(opponent.group_id)} style={[styles.groupRow, opponentId === opponent.group_id ? styles.groupSelected : null]}>
                  <Text style={styles.groupName}>{opponent.group_name}</Text>
                  <Text style={styles.hint}>{opponent.territory || "Secteur"}</Text>
                  {opponentId === opponent.group_id ? <FontAwesome5 name="check-circle" size={16} color={COLORS.primary} /> : null}
                </Pressable>
              ))}
              <Text style={styles.hint}>Même épreuve et même nombre de participants pour les deux équipes (maximum 5).</Text>
              <View style={styles.chips}>
                {FALLBACK_FORMATS.map((item) => (
                  <Pressable key={item.key} onPress={() => setFormat(item.key)} style={[styles.chip, format === item.key ? styles.chipSelected : null]}>
                    <Text style={[styles.chipText, format === item.key ? styles.chipTextSelected : null]}>{formatLabel(item.key)}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.inline}>
                <Text style={styles.hint}>Participants par équipe</Text>
                <View style={styles.countControl}>
                  <Pressable onPress={() => setParticipantCount((n) => Math.max(1, n - 1))} style={styles.countButton}><Text style={styles.countText}>−</Text></Pressable>
                  <Text style={styles.countValue}>{participantCount}</Text>
                  <Pressable onPress={() => setParticipantCount((n) => Math.min(5, n + 1))} style={styles.countButton}><Text style={styles.countText}>+</Text></Pressable>
                </View>
              </View>
              <Action label="Envoyer le défi" icon="paper-plane" disabled={busy || !opponentId} onPress={createChallenge} />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Défis intergroupes</Text>
              {challenges.length === 0 ? <Text style={styles.hint}>Aucun défi de groupe pour l’instant.</Text> : null}
              {challenges.map((challenge) => {
                const ownSide = challenge.challenger_group_id === selected.id || challenge.challenged_group_id === selected.id;
                const isTarget = challenge.challenged_group_id === selected.id;
                const isOwner = selected.owner_id === userId;
                const mine = participations[challenge.id];
                const lines = boards[challenge.id] ?? [];
                const joined = lines.find((row) => row.group_id === selected.id)?.joined_count ?? 0;
                const submitted = lines.find((row) => row.group_id === selected.id)?.submitted_count ?? 0;
                return (
                  <View key={challenge.id} style={styles.challengeCard}>
                    <Text style={styles.challengeTitle}>{challenge.challenger_group_name} <Text style={styles.vs}>VS</Text> {challenge.challenged_group_name}</Text>
                    <Text style={styles.hint}>{formatLabel(challenge.format_key)} · {challenge.participant_count} par équipe · {challenge.status === "proposed" ? "En attente" : challenge.status === "accepted" ? "En cours" : challenge.status === "finished" ? "Terminé" : "Refusé"}</Text>
                    {challenge.status === "accepted" || challenge.status === "finished" ? (
                      <View style={styles.scoreRow}>
                        {lines.map((line) => <Text key={line.group_id} style={styles.score}>{line.group_name}: {line.total_score} pts · {line.submitted_count}/{challenge.participant_count} validés</Text>)}
                      </View>
                    ) : null}
                    {challenge.status === "proposed" && isTarget && isOwner ? (
                      <View style={styles.inline}>
                        <Action label="Accepter" onPress={() => respondChallenge(challenge.id, true)} disabled={busy} />
                        <Action label="Refuser" secondary onPress={() => respondChallenge(challenge.id, false)} disabled={busy} />
                      </View>
                    ) : null}
                    {challenge.status === "accepted" && ownSide && !mine ? <Action label={"Rejoindre l’équipe (" + joined + "/" + challenge.participant_count + ")"} onPress={() => joinChallenge(challenge.id)} disabled={busy || joined >= challenge.participant_count} /> : null}
                    {challenge.status === "accepted" && mine && !mine.attempt_id ? (
                      <View style={{ gap: 8 }}>
                        <Text style={styles.hint}>Choisis une performance validée de ce format à ajouter :</Text>
                        {attempts.filter((attempt) => attempt.format_key === challenge.format_key && attempt.status === "validated" && !attempt.video_removed).slice(0, 4).map((attempt) => (
                          <Action key={attempt.id} label={"Ajouter mon score : " + attempt.decided_score} secondary onPress={() => linkAttempt(challenge.id, attempt.id)} disabled={busy} />
                        ))}
                        {attempts.filter((attempt) => attempt.format_key === challenge.format_key).length === 0 ? <Text style={styles.hint}>Il faut d’abord envoyer une vidéo et attendre la validation du score par la modération.</Text> : null}
                      </View>
                    ) : null}
                    {challenge.status === "finished" && lines.length === 2 ? (
                      <Text style={styles.winner}>{lines[0].total_score === lines[1].total_score ? "Égalité sportive 🤝" : lines[0].total_score > lines[1].total_score ? lines[0].group_name + " remporte le défi 🏆" : lines[1].group_name + " remporte le défi 🏆"}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 44, gap: 14 },
  heading: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 2 },
  headingIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(228,188,71,0.12)", alignItems: "center", justifyContent: "center" },
  refresh: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  subtitle: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  card: { padding: 16, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: "rgba(255,255,255,0.035)", gap: 11 },
  sectionTitle: { color: COLORS.text, fontSize: 17, fontWeight: "900" },
  body: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  hint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  error: { backgroundColor: "rgba(225,109,99,0.14)", color: COLORS.danger, padding: 12, borderRadius: 12, fontSize: 13 },
  notice: { backgroundColor: "rgba(72,201,151,0.12)", color: COLORS.success, padding: 12, borderRadius: 12, fontSize: 13 },
  input: { minHeight: 46, flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, color: COLORS.text, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.surface, fontSize: 14 },
  textarea: { minHeight: 68, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 38, borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  chipSelected: { borderColor: COLORS.primary, backgroundColor: "rgba(228,188,71,0.12)" },
  chipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  chipTextSelected: { color: COLORS.primary },
  action: { minHeight: 44, borderRadius: 12, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.border },
  disabled: { opacity: 0.45 },
  actionText: { color: COLORS.background, textAlign: "center", fontSize: 12, fontWeight: "900" },
  actionTextSecondary: { color: COLORS.text },
  inline: { flexDirection: "row", alignItems: "center", gap: 8 },
  groupRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, padding: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13 },
  groupSelected: { borderColor: COLORS.primary, backgroundColor: "rgba(228,188,71,0.08)" },
  groupBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(228,188,71,0.12)" },
  groupName: { color: COLORS.text, fontSize: 14, fontWeight: "800", flexShrink: 1 },
  memberList: { gap: 7, marginTop: 4 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  memberName: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  codeLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 1.4, marginTop: 6 },
  inviteCode: { color: COLORS.primary, fontSize: 19, fontWeight: "900", letterSpacing: 1.6, padding: 12, borderWidth: 1, borderColor: "rgba(228,188,71,0.4)", borderRadius: 12, textAlign: "center" },
  countControl: { flexDirection: "row", alignItems: "center", gap: 12 },
  countButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  countText: { color: COLORS.primary, fontSize: 20, fontWeight: "700", marginTop: -2 },
  countValue: { color: COLORS.text, fontSize: 18, fontWeight: "900", minWidth: 16, textAlign: "center" },
  challengeCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 12, gap: 9, backgroundColor: COLORS.surface },
  challengeTitle: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  vs: { color: COLORS.primary, fontWeight: "900" },
  scoreRow: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8, gap: 4 },
  score: { color: COLORS.textMuted, fontSize: 12 },
  winner: { color: COLORS.primary, fontSize: 14, fontWeight: "900" },
});
