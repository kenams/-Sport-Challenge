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
                    const placeholders = { day: "JJ", month: "MM", year: "AAAA", hour: "HH", minute: "MM" };
                    return <Field key={key} label={labels[key]} value={fieldRows[index]?.[key] ?? ""} onChange={(v) => setFieldRows((rows) => rows.map((row, i) => i === index ? { ...row, [key]: v } : row))} placeholder={placeholders[key]} max={key === "year" ? 4 : 2} wide={key === "year"} />;
                  })}
                </View>
              )}
              {slotResults[index]?.ok ? <Text style={styles.preview}>{formatTimeFr(slotResults[index].iso, timezone.trim())}</Text> : slotResults[index] && !slotResults[index]!.ok ? <Text style={styles.error}>{(slotResults[index] as { ok: false; error: string }).error}</Text> : null}
            </View>
          ))}
          {slotParts.length < 3 ? <Pressable accessibilityRole="button" onPress={() => {
            if (Platform.OS === "web") setWebValues((values) => [...values, ""]);
            else setFieldRows((rows) => [...rows, { day: "", month: "", year: "", hour: "", minute: "" }]);
          }}><Text style={styles.addSlot}>+ Ajouter un créneau</Text></Pressable> : null}
          <Text style={styles.label}>Ton fuseau horaire pour choisir l’heure</Text>
          <TextInput
            value={timezone}
            onChangeText={setTimezone}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Fuseau horaire"
            placeholder="Europe/Paris"
            placeholderTextColor={COLORS.textMuted}
            style={[styles.input, !tzOk ? styles.inputError : null]}
          />
          {dateError ? <Text style={styles.error}>{dateError}</Text> : null}
          <Text style={styles.hint}>Chaque heure est enregistrée comme un instant unique et convertie dans le fuseau de ton adversaire.</Text>
        </Section>

        {needAuth || (ready && !uid && formError) ? (
          <EventAuthPrompt reason="Connecte-toi pour envoyer ta proposition." onLogin={() => navigation.navigate("Login")} onRegister={() => navigation.navigate("Register")} />
        ) : null}
        {formError ? (
          <Text style={styles.error} accessibilityRole="alert">
            {formError}
          </Text>
        ) : null}
        {!ready ? <ActivityIndicator color={COLORS.primary} /> : null}
        <EventAction label="Envoyer la proposition" onPress={submit} busy={submitting} disabled={!ready} />
      </ScrollView>
    </ScreenContainer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Choice({ selected, title, subtitle, onPress }: { selected: boolean; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      style={[styles.choice, selected ? styles.choiceOn : null, Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null]}
    >
      <Text style={styles.name}>{title}</Text>
      <Text style={styles.hint}>{subtitle}</Text>
    </Pressable>
  );
}

function Field({ label, value, onChange, placeholder, max, wide }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; max: number; wide?: boolean }) {
  return (
    <View style={{ flexGrow: wide ? 1.4 : 1, flexBasis: wide ? 76 : 54 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, "").slice(0, max))}
        keyboardType="number-pad"
        maxLength={max}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        accessibilityLabel={label}
        style={[styles.input, { textAlign: "center", paddingHorizontal: 4 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 90, gap: 14 },
  title: { ...TYPO.display, color: COLORS.text, fontSize: 24 },
  hint: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  text: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, gap: 10 },
  cardTitle: { color: COLORS.primary, fontSize: 13, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  choice: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, gap: 2, minHeight: 56 },
  choiceOn: { borderColor: COLORS.primary, backgroundColor: "rgba(212,175,55,0.1)", borderWidth: 2 },
  name: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  chosen: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, color: COLORS.text, paddingHorizontal: 12, fontSize: 16 },
  inputError: { borderColor: "#F87171" },
  result: { minHeight: 52, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, justifyContent: "center" },
  dateRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  slotBlock: { gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  slotHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  removeSlot: { color: "#F87171", fontSize: 13, fontWeight: "700" },
  addSlot: { color: COLORS.primary, fontSize: 14, fontWeight: "800", paddingVertical: 4 },
  label: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  preview: { color: COLORS.success, fontSize: 14, fontWeight: "700" },
  error: { color: "#F87171", fontSize: 14, lineHeight: 20 },
  success: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "rgba(52,211,153,0.4)", backgroundColor: "rgba(52,211,153,0.08)", gap: 6 },
  successTitle: { color: COLORS.success, fontSize: 17, fontWeight: "900" },
});
