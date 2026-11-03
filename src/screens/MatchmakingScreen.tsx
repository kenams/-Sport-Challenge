import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import EventAction from "../components/immortal/EventAction";
import EventAuthPrompt from "../components/immortal/EventAuthPrompt";
import { COLORS, TYPO } from "../theme";
import { FALLBACK_FORMATS, deviceTimezone } from "../domain/formats";
import type { ChallengeFormat, FormatKey } from "../domain/types";
import { getDuelMatchmakingStatus, joinDuelMatchmaking, leaveDuelMatchmaking, listFormats } from "../services/api";
import { getMyProfile } from "../services/api";
import { useSessionUser } from "./helpers/useSessionUser";

type QueueStatus = "idle" | "waiting" | "matched" | "cancelled" | "expired";

export default function MatchmakingScreen({ navigation }: any) {
  const { uid, ready } = useSessionUser();
  const [formats, setFormats] = useState<ChallengeFormat[]>(FALLBACK_FORMATS);
  const [format, setFormat] = useState<FormatKey>("pushups_60s");
  const [localOnly, setLocalOnly] = useState(false);
  const [status, setStatus] = useState<QueueStatus>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openedEvent = useRef<string | null>(null);

  useEffect(() => { listFormats().then(setFormats).catch(() => undefined); }, []);

  const openMatched = useCallback((id: string) => {
    if (openedEvent.current === id) return;
    openedEvent.current = id;
    setStatus("matched");
    navigation.replace("EventDetail", { eventId: id });
  }, [navigation]);

  const refreshStatus = useCallback(async () => {
    if (!uid) return;
    const result = await getDuelMatchmakingStatus();
    if (result.error) return;
    const row = result.data?.[0];
    if (!row) return;
    setStatus(row.status);
    if (row.status === "matched" && row.matched_event_id) openMatched(row.matched_event_id);
  }, [uid, openMatched]);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);
  useEffect(() => {
    if (status !== "waiting") return;
    const timer = setInterval(refreshStatus, 5000);
    return () => clearInterval(timer);
  }, [status, refreshStatus]);

  const join = async () => {
    if (!uid) return;
    setBusy(true); setError(null);
    const result = await joinDuelMatchmaking(format, deviceTimezone(), localOnly);
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    if (result.data) openMatched(result.data);
    else setStatus("waiting");
  };

  const leave = async () => {
    setBusy(true); setError(null);
    const result = await leaveDuelMatchmaking();
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    setStatus("cancelled");
  };

  const local = async (value: boolean) => {
    if (value && uid) {
      const me = await getMyProfile();
      if (!me.data?.city) {
        setError("Renseigne ta ville dans ton profil pour filtrer les adversaires de ton secteur.");
        setLocalOnly(false);
        return;
      }
    }
    setLocalOnly(value); setError(null);
  };

  const searching = status === "waiting";
  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">Trouver un adversaire</Text>
        <Text style={styles.intro}>Mets-toi disponible. IMMORTAL cherche un joueur sur le même exercice avec un niveau proche.</Text>

        {!ready ? <ActivityIndicator color={COLORS.primary} /> : null}
        {ready && !uid ? <EventAuthPrompt reason="Connecte-toi pour rejoindre la recherche d'adversaire." onLogin={() => navigation.navigate("Login")} onRegister={() => navigation.navigate("Register")} /> : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Épreuve</Text>
          {formats.map((item) => (
            <Pressable key={item.key} disabled={searching || busy} onPress={() => setFormat(item.key)} accessibilityRole="radio" accessibilityState={{ selected: format === item.key, disabled: searching || busy }} style={[styles.option, format === item.key && styles.optionSelected, searching ? { opacity: 0.65 } : null]}>
              <Text style={styles.optionTitle}>{item.label_fr}</Text>
              <Text style={styles.muted}>{item.description_fr}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.cardTitle}>Près de moi</Text>
              <Text style={styles.muted}>Limite la recherche aux joueurs qui ont indiqué la même ville. Ta position précise n’est jamais utilisée.</Text>
            </View>
            <Switch value={localOnly} onValueChange={local} disabled={searching || busy} trackColor={{ true: COLORS.primary }} />
          </View>
        </View>

        {searching ? (
          <View style={styles.waiting}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.waitTitle}>Recherche en cours…</Text>
            <Text style={styles.muted}>On cherche un joueur du même format, avec un écart maximal de 10 niveaux. La recherche s’arrête au bout de 2 heures si personne n’est trouvé.</Text>
            <EventAction label="Annuler ma disponibilité" variant="ghost" onPress={leave} busy={busy} />
          </View>
        ) : (
          <EventAction label={status === "cancelled" || status === "expired" ? "Relancer la recherche" : "Trouver un adversaire"} onPress={join} busy={busy} disabled={!ready || !uid} />
        )}

        {status === "cancelled" ? <Text style={styles.muted}>Tu n’es plus dans la recherche.</Text> : null}
        {status === "expired" ? <Text style={styles.muted}>La recherche a expiré. Aucun point n’est perdu.</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Text style={styles.footnote}>Quand un adversaire est trouvé, vous avez 15 minutes pour confirmer le duel. Sans double confirmation, aucun résultat ni malus n’est attribué.</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingBottom: 28, gap: 14 },
  title: { ...TYPO.display, color: COLORS.text, fontSize: 24 },
  intro: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, gap: 10 },
  cardTitle: { color: COLORS.primary, fontSize: 13, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  option: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, gap: 4 },
  optionSelected: { borderColor: COLORS.primary, borderWidth: 2 },
  optionTitle: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  muted: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  waiting: { alignItems: "center", padding: 20, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, gap: 12 },
  waitTitle: { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  footnote: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  error: { color: "#F87171", fontSize: 14, lineHeight: 20 },
});
