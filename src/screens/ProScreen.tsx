import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import ErrorState from "../components/immortal/ErrorState";
import EventAction from "../components/immortal/EventAction";
import EventAuthPrompt from "../components/immortal/EventAuthPrompt";
import ProBlock from "../components/immortal/ProBlock";
import { COLORS, TYPO } from "../theme";
import { createGroup, groupLeaderboard, getMyEntitlement, getMyProfile, isPro, joinGroup, myGroups, myProgress, setCardTheme } from "../services/api";
import { FALLBACK_FORMATS } from "../domain/formats";
import type { Entitlement, FormatKey } from "../domain/types";
import { CARD_THEMES, barRatio, describeEntitlement, subscribeCta, type CardThemeKey } from "./helpers/proStatus";
import { useSessionUser } from "./helpers/useSessionUser";

type Progress = Array<{ week_start: string; best_score: number; validated_count: number }>;
type Group = { id: string; name: string; invite_code: string; owner_id: string };
type Board = Array<{ rank: number; user_id: string; pseudo: string | null; best_score: number; achieved_at: string }>;
type Msg = { text: string; error: boolean } | null;

const FREE_LIST = [
  "Créer et relever des défis",
  "Records et classements",
  "Partage de tes performances et des duels",
  "Soutenir un joueur lors d'un duel",
  "Preuves vidéo et décisions de modération visibles",
];

const TONE_COLOR = { success: COLORS.success, warning: "#FACC15", danger: "#F87171", muted: COLORS.textMuted } as const;

export default function ProScreen({ navigation }: any) {
  const { uid, ready } = useSessionUser();
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [pro, setPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iapNote, setIapNote] = useState(false);
  const cta = subscribeCta(process.env.EXPO_PUBLIC_IAP_ENABLED);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ent, active] = await Promise.all([getMyEntitlement(), isPro()]);
      setEntitlement(ent);
      setPro(active);
      setError(null);
    } catch {
      setError("Impossible de lire ton abonnement. Vérifie ton réseau et réessaie.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, uid, load]);

  if (!ready || loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} accessibilityLabel="Chargement" />
      </ScreenContainer>
    );
  }
  if (error || !entitlement) {
    return (
      <ScreenContainer>
        <ErrorState message={error ?? "Chargement impossible."} onRetry={load} />
      </ScreenContainer>
    );
  }

  const state = describeEntitlement(entitlement, pro);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title} accessibilityRole="header">
          IMMORTAL Pro
        </Text>
        <Text style={styles.sub}>Des outils en plus pour suivre ta progression et jouer entre amis. Aucun paiement n'achète de points, de validation prioritaire, de meilleur classement ni de titre.</Text>

        <View style={styles.card} accessible accessibilityLabel={`Ton abonnement : ${state.label}. ${state.detail}`}>
          <Text style={styles.cardTitle}>Ton abonnement</Text>
          <Text style={[styles.state, { color: TONE_COLOR[state.tone] }]}>{state.label}</Text>
          <Text style={styles.sub}>{state.detail}</Text>
        </View>

        {ready && !uid ? (
          <EventAuthPrompt reason="Connecte-toi pour voir ton abonnement et utiliser les groupes." onLogin={() => navigation.navigate("Login")} onRegister={() => navigation.navigate("Register")} />
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Toujours gratuit</Text>
          {FREE_LIST.map((item) => (
            <Text key={item} style={styles.free}>
              · {item}
            </Text>
          ))}
        </View>

        <ProBlock
          title="Statistiques de progression"
          description="Ton meilleur score et le nombre de performances validées, semaine par semaine."
          locked={!pro}
          lockedText="Avec Pro, tu verrais ta courbe hebdomadaire par format (meilleur score, performances validées)."
        >
          <ProgressBlock />
        </ProBlock>

        <ProBlock
          title="Cartes de partage personnalisées"
          description="Choisis la couleur de ta carte de partage."
          locked={!pro}
          lockedText="Avec Pro, tu pourrais choisir parmi quatre thèmes : or, acier, carmin, émeraude."
        >
          <ThemeBlock />
        </ProBlock>

        <ProBlock
          title="Groupes privés et classements entre amis"
          description="Rejoindre un groupe avec un code est gratuit. Créer un groupe et inviter est réservé à Pro."
          locked={false}
          badge={pro ? "Pro actif" : "Rejoindre gratuit · Créer Pro"}
        >
          <GroupsBlock pro={pro} signedIn={!!uid} />
        </ProBlock>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tarifs envisagés</Text>
          <Text style={styles.sub}>Hypothèse de départ, non facturable aujourd'hui : 4,99 € par mois ou 39,99 € par an. Rien n'est vendu pour le moment.</Text>
          <EventAction label={cta.label} onPress={() => setIapNote(true)} disabled={cta.disabled} />
          {iapNote ? <Text style={styles.warn}>L'achat n'est pas encore disponible dans cette version : aucun paiement n'a été effectué.</Text> : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function FormatTabs({ value, onChange }: { value: FormatKey; onChange: (k: FormatKey) => void }) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {FALLBACK_FORMATS.map((f) => (
        <View key={f.key} style={{ flexGrow: 1, flexBasis: 140 }}>
          <EventAction label={f.discipline === "pushups" ? "Pompes" : "Tractions"} variant="ghost" selected={value === f.key} onPress={() => onChange(f.key)} />
        </View>
      ))}
    </View>
  );
}

function ProgressBlock() {
  const [format, setFormat] = useState<FormatKey>("pushups_60s");
  const [rows, setRows] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(null);
    myProgress(format).then((res) => {
      if (!alive) return;
      if (res.error) setError(res.error);
      else setRows(res.data ?? []);
    });
    return () => {
      alive = false;
    };
  }, [format]);

  const max = rows ? Math.max(0, ...rows.map((r) => r.best_score)) : 0;
  return (
    <View style={{ gap: 10 }}>
      <FormatTabs value={format} onChange={setFormat} />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {!rows && !error ? <ActivityIndicator color={COLORS.primary} /> : null}
      {rows && rows.length === 0 ? <Text style={styles.sub}>Pas encore de performance validée pour ce format.</Text> : null}
      {rows?.map((r) => (
        <View key={r.week_start} style={{ gap: 4 }} accessible accessibilityLabel={`Semaine du ${new Date(r.week_start).toLocaleDateString("fr-FR")} : meilleur score ${r.best_score}, ${r.validated_count} performances validées`}>
          <View style={styles.barHead}>
            <Text style={styles.free}>Semaine du {new Date(r.week_start).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</Text>
            <Text style={styles.free}>
              {r.best_score} · {r.validated_count} validée{r.validated_count > 1 ? "s" : ""}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(barRatio(r.best_score, max) * 100)}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function ThemeBlock() {
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState<CardThemeKey | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    getMyProfile().then((res) => setCurrent(res.data?.card_theme ?? "gold"));
  }, []);

  const choose = async (key: CardThemeKey) => {
    setBusy(key);
    setMsg(null);
    const res = await setCardTheme(key);
    setBusy(null);
    if (res.error) return setMsg({ text: res.error, error: true });
    setCurrent(key);
    setMsg({ text: "Thème enregistré.", error: false });
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.tabs}>
        {CARD_THEMES.map((t) => {
          const on = current === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => choose(t.key)}
              disabled={busy !== null}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, busy: busy === t.key }}
              accessibilityLabel={`Thème ${t.label}`}
              style={[styles.swatch, on ? { borderColor: COLORS.primary, borderWidth: 2 } : null]}
            >
              <View style={[styles.dot, { backgroundColor: t.color }]} />
              <Text style={styles.free}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {msg ? (
        <Text accessibilityLiveRegion="polite" style={msg.error ? styles.err : styles.ok}>
          {msg.text}
        </Text>
      ) : null}
    </View>
  );
}

function GroupsBlock({ pro, signedIn }: { pro: boolean; signedIn: boolean }) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<"join" | "create" | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [selected, setSelected] = useState<Group | null>(null);

  const reload = useCallback(async () => {
    if (!signedIn) return setGroups([]);
    const res = await myGroups();
    if (res.error) setLoadError(res.error);
    else {
      setLoadError(null);
      setGroups(res.data ?? []);
    }
  }, [signedIn]);

  useEffect(() => {
    reload();
  }, [reload]);

  const join = async () => {
    if (!signedIn) return setMsg({ text: "Connecte-toi pour rejoindre un groupe.", error: true });
    if (!code.trim()) return setMsg({ text: "Saisis le code d'invitation.", error: true });
    setBusy("join");
    setMsg(null);
    const res = await joinGroup(code.trim());
    setBusy(null);
    if (res.error) return setMsg({ text: res.error, error: true });
    setCode("");
    setMsg({ text: "Tu as rejoint le groupe.", error: false });
    reload();
  };

  const create = async () => {
    if (name.trim().length < 2) return setMsg({ text: "Donne un nom d'au moins 2 caractères.", error: true });
    setBusy("create");
    setMsg(null);
    const res = await createGroup(name.trim());
    setBusy(null);
    if (res.error) return setMsg({ text: res.error, error: true });
    setName("");
    setMsg({ text: "Groupe créé. Partage son code d'invitation avec tes amis.", error: false });
    reload();
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.label}>Rejoindre avec un code (gratuit)</Text>
      <View style={styles.inline}>
        <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} placeholder="Code d'invitation" placeholderTextColor={COLORS.textMuted} accessibilityLabel="Code d'invitation" style={[styles.input, { flex: 1 }]} />
        <View style={{ width: 130 }}>
          <EventAction label="Rejoindre" variant="ghost" onPress={join} busy={busy === "join"} />
        </View>
      </View>

      <Text style={styles.label}>Créer un groupe</Text>
      {pro ? (
        <View style={styles.inline}>
          <TextInput value={name} onChangeText={setName} placeholder="Nom du groupe" placeholderTextColor={COLORS.textMuted} accessibilityLabel="Nom du groupe" maxLength={40} style={[styles.input, { flex: 1 }]} />
          <View style={{ width: 130 }}>
            <EventAction label="Créer" onPress={create} busy={busy === "create"} />
          </View>
        </View>
      ) : (
        <Text style={styles.lock}>Créer un groupe privé est réservé à Pro. Tu peux déjà rejoindre le groupe d'un ami avec son code.</Text>
      )}

      {msg ? (
        <Text accessibilityLiveRegion="polite" style={msg.error ? styles.err : styles.ok}>
          {msg.text}
        </Text>
      ) : null}

      <Text style={styles.label}>Mes groupes</Text>
      {loadError ? <View style={{ gap: 8 }}><Text style={styles.err}>{loadError}</Text><EventAction label="Réessayer le chargement des groupes" variant="ghost" onPress={reload} /></View> : null}
      {groups?.length === 0 && !loadError ? <Text style={styles.sub}>Tu n’as pas encore rejoint de groupe. Demande un code à un ami pour commencer.</Text> : null}
      {groups === null && !loadError ? <ActivityIndicator color={COLORS.primary} /> : null}
      {groups?.map((g) => (
        <Pressable
          key={g.id}
          onPress={() => setSelected(selected?.id === g.id ? null : g)}
          accessibilityRole="button"
          accessibilityState={{ expanded: selected?.id === g.id }}
          accessibilityLabel={`Groupe ${g.name}, code ${g.invite_code}`}
          style={[styles.group, selected?.id === g.id ? { borderColor: COLORS.primary } : null]}
        >
          <Text style={styles.gName}>{g.name}</Text>
          <Text style={styles.sub}>Code d'invitation : {g.invite_code}</Text>
        </Pressable>
      ))}
      {selected ? <GroupBoard group={selected} /> : null}
    </View>
  );
}

function GroupBoard({ group }: { group: Group }) {
  const [format, setFormat] = useState<FormatKey>("pushups_60s");
  const [rows, setRows] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(null);
    groupLeaderboard(group.id, format).then((res) => {
      if (!alive) return;
      if (res.error) setError(res.error);
      else setRows(res.data ?? []);
    });
    return () => {
      alive = false;
    };
  }, [group.id, format]);

  return (
    <View style={styles.board}>
      <Text style={styles.gName}>Classement · {group.name}</Text>
      <FormatTabs value={format} onChange={setFormat} />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {!rows && !error ? <ActivityIndicator color={COLORS.primary} /> : null}
      {rows && rows.length === 0 ? <Text style={styles.sub}>Aucune performance validée dans ce groupe pour ce format.</Text> : null}
      {rows?.map((r) => (
        <View key={r.user_id} style={styles.barHead} accessible accessibilityLabel={`${r.rank}e, ${r.pseudo ?? "Joueur"}, ${r.best_score}`}>
          <Text style={styles.free}>
            {r.rank}. {r.pseudo ?? "Joueur"}
          </Text>
          <Text style={[styles.free, { color: COLORS.primary, fontWeight: "800" }]}>{r.best_score}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 90, gap: 14 },
  title: { ...TYPO.display, color: COLORS.text, fontSize: 24 },
  sub: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, gap: 8 },
  cardTitle: { color: COLORS.primary, fontSize: 13, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  state: { fontSize: 22, fontWeight: "900" },
  free: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  warn: { color: "#FACC15", fontSize: 13, lineHeight: 18 },
  tabs: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  barHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  track: { height: 10, borderRadius: 5, backgroundColor: COLORS.surface, overflow: "hidden" },
  fill: { height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  swatch: { minHeight: 48, minWidth: 96, flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  dot: { width: 18, height: 18, borderRadius: 9 },
  label: { color: COLORS.textMuted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  inline: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, color: COLORS.text, paddingHorizontal: 12, fontSize: 16 },
  lock: { color: COLORS.text, fontSize: 13, lineHeight: 18, padding: 10, borderRadius: 10, backgroundColor: COLORS.surface },
  err: { color: "#F87171", fontSize: 14, lineHeight: 20 },
  ok: { color: COLORS.success, fontSize: 14, lineHeight: 20 },
  group: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, minHeight: 52, gap: 2 },
  gName: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  board: { padding: 12, borderRadius: 12, backgroundColor: COLORS.surface, gap: 8 },
});
