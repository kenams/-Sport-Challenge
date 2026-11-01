import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import EventAction from "../components/immortal/EventAction";
import EventAuthPrompt from "../components/immortal/EventAuthPrompt";
import EventShareButton from "../components/immortal/EventShareButton";
import { COLORS, TYPO } from "../theme";
import { getMyProfile, listFormats, proposeEvent, searchPlayers } from "../services/api";
import { FALLBACK_FORMATS, formatTimeFr } from "../domain/formats";
import type { ChallengeFormat, FormatKey } from "../domain/types";
import { supabase } from "../supabase";
import type { ShareableEvent } from "../services/share";
import { DEFAULT_TIMEZONE, isValidTimezone, parseDatetimeLocal, partsToIso, toInt, type LocalParts } from "./helpers/eventTime";
import { useSessionUser } from "./helpers/useSessionUser";

type Opponent = { id: string; pseudo: string | null; city: string | null };

export default function ProposeEventScreen({ navigation, route }: any) {
  const preset = route?.params as { opponentId?: string; opponentPseudo?: string } | undefined;
  const { uid, ready } = useSessionUser();

  const [formats, setFormats] = useState<ChallengeFormat[]>(FALLBACK_FORMATS);
  const [formatKey, setFormatKey] = useState<FormatKey>("pushups_60s");
  const [opponent, setOpponent] = useState<Opponent | null>(preset?.opponentId ? { id: preset.opponentId, pseudo: preset.opponentPseudo ?? null, city: null } : null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Opponent[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [webValue, setWebValue] = useState("");
  const [fields, setFields] = useState({ day: "", month: "", year: "", hour: "", minute: "" });
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [needAuth, setNeedAuth] = useState(false);
  const [created, setCreated] = useState<{ id: string; share: ShareableEvent | null } | null>(null);

  useEffect(() => {
    listFormats().then(setFormats).catch(() => undefined);
  }, []);

  const parts: LocalParts | null = useMemo(() => {
    if (Platform.OS === "web") return parseDatetimeLocal(webValue);
    return { year: toInt(fields.year), month: toInt(fields.month), day: toInt(fields.day), hour: toInt(fields.hour), minute: toInt(fields.minute) };
  }, [webValue, fields]);

  const tzOk = isValidTimezone(timezone);
  const parsed = parts ? partsToIso(parts, timezone) : null;
  const touchedDate = Platform.OS === "web" ? webValue !== "" : Object.values(fields).some((v) => v !== "");
  const dateError = !tzOk ? "Fuseau horaire inconnu (exemple : Europe/Paris)." : touchedDate && parsed && !parsed.ok ? parsed.error : null;

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
    setResults(result.data.filter((p) => p.user_id !== uid).map((p) => ({ id: p.user_id, pseudo: p.pseudo, city: p.city })));
  };

  const submit = async () => {
    setFormError(null);
    if (!uid) return setNeedAuth(true);
    if (!opponent) return setFormError("Choisis ton adversaire.");
    if (opponent.id === uid) return setFormError("Tu ne peux pas t'affronter toi-même.");
    if (!parts || !parsed) return setFormError("Renseigne la date et l'heure du duel.");
    if (!parsed.ok) return setFormError(parsed.error);
    setSubmitting(true);
    const tz = timezone.trim();
    const result = await proposeEvent(opponent.id, formatKey, parsed.iso, tz);
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
          scheduled_at: parsed.iso,
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
        <Text style={styles.hint}>Pompes ou tractions, un adversaire, une date. Le duel n'est confirmé qu'après son accord.</Text>

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
                  onPress={() => setOpponent(p)}
                  accessibilityRole="button"
                  accessibilityLabel={`Choisir ${p.pseudo ?? "ce joueur"}${p.city ? `, ${p.city}` : ""}`}
                  style={({ pressed }) => [styles.result, pressed ? { opacity: 0.8 } : null]}
                >
                  <Text style={styles.name}>{p.pseudo ?? "Joueur"}</Text>
                  <Text style={styles.hint}>{p.city ?? "Ville non renseignée"}</Text>
                </Pressable>
              ))}
            </>
          )}
        </Section>

        <Section title="3. Date et heure">
          {Platform.OS === "web" ? (
            React.createElement("input", {
              type: "datetime-local",
              value: webValue,
              onChange: (e: any) => setWebValue(e.target.value),
              "aria-label": "Date et heure du duel",
              style: {
                minHeight: 48,
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.surface,
                color: COLORS.text,
                fontSize: 16,
                colorScheme: "dark",
                width: "100%",
                boxSizing: "border-box",
              },
            })
          ) : (
            <View style={styles.dateRow}>
              <Field label="Jour" value={fields.day} onChange={(v) => setFields((s) => ({ ...s, day: v }))} placeholder="JJ" max={2} />
              <Field label="Mois" value={fields.month} onChange={(v) => setFields((s) => ({ ...s, month: v }))} placeholder="MM" max={2} />
              <Field label="Année" value={fields.year} onChange={(v) => setFields((s) => ({ ...s, year: v }))} placeholder="AAAA" max={4} wide />
              <Field label="Heure" value={fields.hour} onChange={(v) => setFields((s) => ({ ...s, hour: v }))} placeholder="HH" max={2} />
              <Field label="Min" value={fields.minute} onChange={(v) => setFields((s) => ({ ...s, minute: v }))} placeholder="MM" max={2} />
            </View>
          )}
          <Text style={styles.label}>Fuseau horaire</Text>
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
          {parsed && parsed.ok && tzOk ? (
            <Text style={styles.preview} accessibilityLiveRegion="polite">
              Le duel aura lieu : {formatTimeFr(parsed.iso, timezone.trim())}
            </Text>
          ) : (
            <Text style={styles.hint}>La date doit être dans le futur. L'heure est celle du fuseau indiqué.</Text>
          )}
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
  label: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  preview: { color: COLORS.success, fontSize: 14, fontWeight: "700" },
  error: { color: "#F87171", fontSize: 14, lineHeight: 20 },
  success: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "rgba(52,211,153,0.4)", backgroundColor: "rgba(52,211,153,0.08)", gap: 6 },
  successTitle: { color: COLORS.success, fontSize: 17, fontWeight: "900" },
});
