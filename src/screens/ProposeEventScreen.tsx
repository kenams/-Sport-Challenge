import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import EventAction from "../components/immortal/EventAction";
import EventAuthPrompt from "../components/immortal/EventAuthPrompt";
import EventShareButton from "../components/immortal/EventShareButton";
import { COLORS, TYPO } from "../theme";
import { getMyProfile, getMyStats, getPlayerLevel, listFormats, proposeEventSlots, searchPlayers } from "../services/api";
import { deviceTimezone, FALLBACK_FORMATS, formatTimeFr } from "../domain/formats";
import type { ChallengeFormat, FormatKey } from "../domain/types";
import { exceedsDirectLevelGap, MAX_DIRECT_LEVEL_GAP } from "../domain/challengeRules";
import { supabase } from "../supabase";
import type { ShareableEvent } from "../services/share";
import { DEFAULT_TIMEZONE, isValidTimezone, parseDatetimeLocal, partsToIso, toInt, type LocalParts } from "./helpers/eventTime";
import { useSessionUser } from "./helpers/useSessionUser";

type Opponent = { id: string; pseudo: string | null; city: string | null; level: number | null };

export default function ProposeEventScreen({ navigation, route }: any) {
  const preset = route?.params as { opponentId?: string; opponentPseudo?: string } | undefined;
  const { uid, ready } = useSessionUser();

  const [formats, setFormats] = useState<ChallengeFormat[]>(FALLBACK_FORMATS);
  const [formatKey, setFormatKey] = useState<FormatKey>("pushups_60s");
  const [opponent, setOpponent] = useState<Opponent | null>(preset?.opponentId ? { id: preset.opponentId, pseudo: preset.opponentPseudo ?? null, city: null, level: null } : null);
  const [myLevel, setMyLevel] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Opponent[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [webValues, setWebValues] = useState([""]);
  const [fieldRows, setFieldRows] = useState([{ day: "", month: "", year: "", hour: "", minute: "" }]);
  const [timezone, setTimezone] = useState(deviceTimezone() || DEFAULT_TIMEZONE);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [needAuth, setNeedAuth] = useState(false);
  const [created, setCreated] = useState<{ id: string; share: ShareableEvent | null } | null>(null);

  useEffect(() => {
    listFormats().then(setFormats).catch(() => undefined);
    getMyStats().then((result) => { if (result.data) setMyLevel(result.data.level); });
  }, []);

  useEffect(() => {
    if (opponent?.id && opponent.level == null) getPlayerLevel(opponent.id).then((level) => setOpponent((current) => current?.id === opponent.id ? { ...current, level } : current));
  }, [opponent?.id]);

  const tzOk = isValidTimezone(timezone);
  const slotParts: (LocalParts | null)[] = Platform.OS === "web"
    ? webValues.map(parseDatetimeLocal)
    : fieldRows.map((f) => Object.values(f).every((value) => !value) ? null : ({ year: toInt(f.year), month: toInt(f.month), day: toInt(f.day), hour: toInt(f.hour), minute: toInt(f.minute) }));
  const slotResults = slotParts.map((parts) => parts ? partsToIso(parts, timezone) : null);
  const validSlots = slotResults.filter((r): r is { ok: true; iso: string } => !!r?.ok).map((r) => r.iso);
  const touchedDate = Platform.OS === "web" ? webValues.some(Boolean) : fieldRows.some((f) => Object.values(f).some(Boolean));
  const dateError = !tzOk ? "Fuseau horaire inconnu (exemple : Europe/Paris)." : touchedDate && slotResults.some((r) => r && !r.ok) ? (slotResults.find((r) => r && !r.ok) as { ok: false; error: string }).error : null;

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchError("Saisis au moins 2 caractères du pseudo.");
      return;
    }
    setSearching(true);
    setSearchError(null);
    const result = await searchPlayers(q);
    setSearching(false);
    if (result.error || !result.data) {
      setSearchError(result.error ?? "Recherche impossible.");
      setResults(null);
      return;
    }
    setResults(result.data.filter((p) => p.user_id !== uid).map((p) => ({ id: p.user_id, pseudo: p.pseudo, city: p.city, level: p.level })));
  };

  const submit = async () => {
    setFormError(null);
    if (!uid) return setNeedAuth(true);
    if (!opponent) return setFormError("Choisis ton adversaire.");
    if (opponent.id === uid) return setFormError("Tu ne peux pas t'affronter toi-même.");
    if (exceedsDirectLevelGap(myLevel, opponent.level)) return setFormError("Écart de niveau trop important : limite de " + MAX_DIRECT_LEVEL_GAP + " niveaux.");
    if (validSlots.length === 0) return setFormError("Renseigne au moins un créneau valide.");
    if (dateError) return setFormError(dateError);
    if (new Set(validSlots).size !== validSlots.length) return setFormError("Retire les créneaux identiques.");
    setSubmitting(true);
    const tz = timezone.trim();
    const result = await proposeEventSlots(opponent.id, formatKey, validSlots, tz);
    if (result.error || !result.data) {
      setSubmitting(false);
      return setFormError(result.error ?? "La proposition a échoué.");
    }
    const eventId = result.data;
    let share: ShareableEvent | null = null;
    try {
      const [{ data: row }, me] = await Promise.all([supabase.from("duel_events").select("slug,status").eq("id", eventId).maybeSingle(), getMyProfile()]);
      if (row?.slug) {
        share = {
          slug: row.slug as string,
          status: (row.status as ShareableEvent["status"]) ?? "proposed",
          scheduled_at: validSlots[0],
          timezone: tz,
          formatKey,
          playerA: { pseudo: me.data?.pseudo ?? null, city: me.data?.city ?? null },
          playerB: { pseudo: opponent.pseudo, city: opponent.city },
        };
      }
    } catch {
      share = null;
    }
    setSubmitting(false);
    setCreated({ id: eventId, share });
  };

  if (created) {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.success} accessibilityRole="alert">
            <Text style={styles.successTitle}>Proposé : ton adversaire doit accepter</Text>
            <Text style={styles.text}>
              Le duel n'est pas confirmé. Il ne le sera qu'après l'accord de {opponent?.pseudo ?? "ton adversaire"}. Tant qu'il n'a pas accepté, les soutiens sont fermés.
            </Text>
          </View>
          {created.share ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Prévenir tes proches</Text>
              <Text style={styles.hint}>Le texte partagé précise que le duel est proposé et en attente d'accord.</Text>
              <EventShareButton event={created.share} label="Partager le lien" />
            </View>
          ) : (
            <Text style={styles.hint}>Le lien de partage sera disponible dans le détail du duel.</Text>
          )}
          <EventAction label="Voir le duel" onPress={() => navigation.replace("EventDetail", { eventId: created.id })} />
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title} accessibilityRole="header">
          Proposer un duel
        </Text>
          <Text style={styles.hint}>Choisis une heure précise dans les 14 prochains jours. L’invitation expire après 48 h sans réponse, sans défaite ni perte de points.</Text>

        <Section title="1. Format">
          <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
            {formats.map((f) => (
              <Choice
                key={f.key}
                selected={formatKey === f.key}
                title={f.label_fr}
                subtitle={f.description_fr}
                onPress={() => setFormatKey(f.key)}
              />
            ))}
          </View>
        </Section>

        <Section title="2. Adversaire">
          {opponent ? (
            <View style={styles.chosen}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{opponent.pseudo ?? "Joueur"}</Text>
                {opponent.city ? <Text style={styles.hint}>{opponent.city}</Text> : null}
              </View>
              <View style={{ minWidth: 120 }}>
                <EventAction label="Changer" variant="ghost" onPress={() => setOpponent(null)} />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.searchRow}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Pseudo de l'adversaire"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={runSearch}
                  accessibilityLabel="Pseudo de l'adversaire"
                  style={[styles.input, { flex: 1 }]}
                />
                <View style={{ width: 130 }}>
                  <EventAction label="Chercher" variant="ghost" onPress={runSearch} busy={searching} />
                </View>
              </View>
              {searchError ? <Text style={styles.error}>{searchError}</Text> : null}
              {results && results.length === 0 ? <Text style={styles.hint}>Aucun joueur trouvé avec ce pseudo.</Text> : null}
              {results?.map((p) => (
                <Pressable
                  key={p.id}
                  disabled={exceedsDirectLevelGap(myLevel, p.level)}
                  onPress={() => setOpponent(p)}
                  accessibilityRole="button"
                  accessibilityLabel={`Choisir ${p.pseudo ?? "ce joueur"}${p.city ? `, ${p.city}` : ""}`}
                  style={({ pressed }) => [styles.result, pressed ? { opacity: 0.8 } : null]}
                >
                  <Text style={styles.name}>{p.pseudo ?? "Joueur"}</Text>
                  <Text style={styles.hint}>{p.city ?? "Ville non renseignée"}</Text>
                  <Text style={styles.hint}>{p.level != null ? (exceedsDirectLevelGap(myLevel, p.level) ? "Niveau " + p.level + " · écart trop important" : "Niveau " + p.level) : "Niveau indisponible"}</Text>
                </Pressable>
              ))}
            </>
          )}
        </Section>

        <Section title="3. Date et heure">
          <Text style={styles.hint}>Propose un à trois créneaux. Ton adversaire choisira celui qui lui convient.</Text>
          {slotParts.map((parts, index) => (
            <View key={index} style={styles.slotBlock}>
              <View style={styles.slotHeader}>
                <Text style={styles.label}>Créneau {index + 1}</Text>
                {slotParts.length > 1 ? <Pressable accessibilityRole="button" onPress={() => {
                  if (Platform.OS === "web") setWebValues((values) => values.filter((_, i) => i !== index));
                  else setFieldRows((rows) => rows.filter((_, i) => i !== index));
                }}><Text style={styles.removeSlot}>Supprimer</Text></Pressable> : null}
              </View>
              {Platform.OS === "web" ? React.createElement("input", {
                type: "datetime-local",
                value: webValues[index] ?? "",
                onChange: (e: any) => setWebValues((values) => values.map((value, i) => i === index ? e.target.value : value)),
                "aria-label": `Date et heure du créneau ${index + 1}`,
                style: { minHeight: 48, padding: "10px 12px", borderRadius: 12, border: `1px solid ${COLORS.border}`, background: COLORS.surface, color: COLORS.text, fontSize: 16, colorScheme: "dark", width: "100%", boxSizing: "border-box" },
              }) : (
                <View style={styles.dateRow}>
                  {(["day", "month", "year", "hour", "minute"] as const).map((key) => {
                    const labels = { day: "Jour", month: "Mois", year: "Année", hour: "Heure", minute: "Min" };
                    const placeholders = { day: "JJ", month: "MM…4939 tokens truncated…ok: false; error: string };

export function partsToIso(parts: LocalParts, tz: string, now: number = Date.now()): ParseResult {
  const { year, month, day, hour, minute } = parts;
  const all = [year, month, day, hour, minute];
  if (all.some((n) => !Number.isInteger(n))) return { ok: false, error: "Renseigne tous les champs de date et d'heure avec des nombres." };
  if (year < 2020 || year > 2100) return { ok: false, error: "Année invalide." };
  if (month < 1 || month > 12) return { ok: false, error: "Mois invalide (1 à 12)." };
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return { ok: false, error: "Heure invalide (0 à 23 h, 0 à 59 min)." };
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return { ok: false, error: "Ce jour n'existe pas dans ce mois." };
  if (!isValidTimezone(tz)) return { ok: false, error: "Fuseau horaire inconnu (exemple : Europe/Paris)." };
  const zone = tz.trim();
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let ts = guess - tzOffsetMs(guess, zone);
  ts = guess - tzOffsetMs(ts, zone);
  // Vérification aller-retour : au passage à l'heure d'été, certaines heures n'existent pas.
  if (ts + tzOffsetMs(ts, zone) !== guess) {
    return { ok: false, error: "Cette heure n'existe pas dans ce fuseau à cause du changement d'heure. Choisis une autre heure." };
  }
  // Une heure répétée en automne désigne deux instants : demander une heure non ambiguë.
  const offsets = new Set([-86400000, 0, 86400000].map((delta) => tzOffsetMs(ts + delta, zone)));
  const matches = [...offsets].filter((offset) => {
    const candidate = guess - offset;
    return candidate + tzOffsetMs(candidate, zone) === guess;
  });
  if (matches.length > 1) return { ok: false, error: "Cette heure se produit deux fois lors du changement d'heure. Choisis une autre heure pour éviter toute confusion." };
  if (ts < now + 30 * 60 * 1000) return { ok: false, error: "Choisis un créneau au moins 30 minutes à l'avance." };
  if (ts > now + 14 * 24 * 60 * 60 * 1000) return { ok: false, error: "Un duel direct doit être programmé dans les 14 prochains jours." };
  return { ok: true, iso: new Date(ts).toISOString() };
}

/** Valeur d'un champ datetime-local : "AAAA-MM-JJTHH:mm". */
export function parseDatetimeLocal(value: string): LocalParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  return { year: +m[1], month: +m[2], day: +m[3], hour: +m[4], minute: +m[5] };
}

export function toInt(text: string): number {
  return /^\d{1,4}$/.test(text.trim()) ? parseInt(text.trim(), 10) : NaN;
}
