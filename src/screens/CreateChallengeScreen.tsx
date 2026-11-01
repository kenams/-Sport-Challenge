import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import ScreenContainer from "../components/ScreenContainer";
import RulesCard from "../components/immortal/RulesCard";
import FormatPicker from "../components/immortal/FormatPicker";
import VideoPicker from "../components/immortal/VideoPicker";
import { ActionButton, FieldLabel, InlineMessage, ScoreField, SubmissionSuccess, formStyles } from "../components/immortal/AttemptFormParts";
import { listFormats, searchPlayers } from "../services/api";
import type { VideoCandidate } from "../services/video";
import { FALLBACK_FORMATS, formatByKey } from "../domain/formats";
import type { ChallengeFormat, FormatKey } from "../domain/types";
import { COLORS } from "../theme";
import { TITLE_MAX, cleanTitle, isNetworkMessage, parseDeclaredScore } from "./helpers/attempts";
import { sendAttempt, useUserId } from "./helpers/sendAttempt";

type Player = { user_id: string; pseudo: string | null; city: string | null };

export default function CreateChallengeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as { formatKey?: FormatKey; recipientId?: string; recipientPseudo?: string };
  const userId = useUserId();

  const [formats, setFormats] = useState<ChallengeFormat[]>(FALLBACK_FORMATS);
  const [formatKey, setFormatKey] = useState<FormatKey | null>(params.formatKey ?? null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [score, setScore] = useState("");
  const [video, setVideo] = useState<VideoCandidate | null>(null);
  const [recipient, setRecipient] = useState<{ id: string; pseudo: string | null } | null>(
    params.recipientId ? { id: params.recipientId, pseudo: params.recipientPseudo ?? null } : null
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    listFormats().then((list) => {
      if (alive && list.length > 0) setFormats(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (params.formatKey) setFormatKey(params.formatKey);
    if (params.recipientId) setRecipient({ id: params.recipientId, pseudo: params.recipientPseudo ?? null });
  }, [params.formatKey, params.recipientId, params.recipientPseudo]);

  useEffect(() => {
    const text = query.trim();
    setSearchError(null);
    if (text.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let alive = true;
    const timer = setTimeout(async () => {
      const result = await searchPlayers(text);
      if (!alive) return;
      setSearching(false);
      if (result.error) {
        setSearchError(result.error);
        setResults([]);
      } else {
        setResults((result.data ?? []).filter((player) => player.user_id !== userId));
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, userId]);

  const format = useMemo(() => (formatKey ? formatByKey(formats, formatKey) ?? null : null), [formats, formatKey]);
  const parsed = format ? parseDeclaredScore(score, format.max_score) : null;

  const reset = () => {
    setFormatKey(null);
    setTitle("");
    setScore("");
    setVideo(null);
    setRecipient(null);
    setQuery("");
    setShowErrors(false);
    setSubmitError(null);
    setOffline(false);
    setCreatedId(null);
    setRulesOpen(false);
  };

  const submit = async () => {
    if (busy.current) return;
    setShowErrors(true);
    setSubmitError(null);
    setOffline(false);
    if (!format || !parsed || !parsed.ok || !video) return;
    if (!userId) {
      setSubmitError("Connecte-toi pour lancer un défi.");
      return;
    }
    busy.current = true;
    setSubmitting(true);
    try {
      const result = await sendAttempt({
        userId,
        format: format.key,
        score: parsed.value,
        video,
        title: cleanTitle(title),
        recipientId: recipient?.id ?? null,
      });
      if (result.ok) {
        setCreatedId(result.attemptId);
      } else if (isNetworkMessage(result.message)) {
        setOffline(true);
        setSubmitError("Connexion perdue pendant l'envoi. Ton formulaire et ta vidéo sont conservés : réessaie dès que le réseau revient.");
      } else {
        setSubmitError(result.message);
      }
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  const leave = () => {
    reset();
    if (navigation.canGoBack()) navigation.goBack();
  };

  if (createdId) {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.scroll}>
          <SubmissionSuccess
            kind="challenge"
            onViewChallenge={() => {
              const id = createdId;
              reset();
              navigation.navigate("ChallengeDetail", { challengeId: id });
            }}
            onDone={leave}
            doneLabel={navigation.canGoBack() ? "Retour" : "Lancer un autre défi"}
          />
        </ScrollView>
      </ScreenContainer>
    );
  }

  const videoError = showErrors && !video ? "Ajoute la vidéo de ta performance pour envoyer le défi." : null;
  const formatError = showErrors && !format ? "Choisis un format d'épreuve." : null;

  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ gap: 4 }}>
            <Text style={formStyles.heading} accessibilityRole="header">
              Lancer un défi
            </Text>
            <Text style={formStyles.lead}>Filme ta performance, déclare ton score. Une modération humaine la valide avant qu'elle compte.</Text>
          </View>

          <View style={formStyles.card}>
            <FieldLabel>1. Format</FieldLabel>
            <FormatPicker formats={formats} value={formatKey} onChange={setFormatKey} disabled={submitting} />
            {formatError ? <InlineMessage tone="error">{formatError}</InlineMessage> : null}
          </View>

          {format ? (
            <View style={formStyles.card}>
              <Pressable
                onPress={() => setRulesOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityState={{ expanded: rulesOpen }}
                accessibilityLabel={rulesOpen ? "Masquer les règles" : "Lire les règles avant d'envoyer"}
                style={styles.rulesToggle}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rulesTitle}>Règles du format</Text>
                  <Text style={styles.rulesSub}>À lire avant de filmer : mouvement, cadrage, score retenu.</Text>
                </View>
                <Text style={styles.rulesChevron}>{rulesOpen ? "Masquer" : "Lire"}</Text>
              </Pressable>
              {rulesOpen ? <RulesCard format={format} /> : null}
            </View>
          ) : null}

          <View style={formStyles.card}>
            <FieldLabel optional>2. Titre du défi</FieldLabel>
            <TextInput
              value={title}
              onChangeText={(text) => setTitle(text.slice(0, TITLE_MAX))}
              editable={!submitting}
              maxLength={TITLE_MAX}
              placeholder="Ex. : Mon record à battre"
              placeholderTextColor={COLORS.textMuted}
              accessibilityLabel="Titre du défi, facultatif, 80 caractères maximum"
              style={styles.input}
            />
            <Text style={styles.counter}>
              {title.length}/{TITLE_MAX}
            </Text>

            {format ? (
              <ScoreField value={score} onChange={setScore} max={format.max_score} disabled={submitting} showError={showErrors} />
            ) : (
              <Text style={styles.hint}>Choisis d'abord un format pour déclarer ton score.</Text>
            )}
          </View>

          <View style={formStyles.card}>
            <VideoPicker formatKey={format?.key} value={video} onChange={setVideo} maxSeconds={format?.max_video_seconds ?? 120} disabled={submitting} error={videoError} />
          </View>

          <View style={formStyles.card}>
            <FieldLabel optional>Inviter un ami (défi nominatif)</FieldLabel>
            {recipient ? (
              <View style={styles.recipient}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipientName}>{recipient.pseudo ?? "Joueur"}</Text>
                  <Text style={styles.hint}>Défi nominatif : seul ce joueur pourra y répondre.</Text>
                </View>
                <ActionButton label="Retirer" variant="ghost" fullWidth={false} onPress={() => setRecipient(null)} disabled={submitting} hint="Rend le défi ouvert à tous" />
              </View>
            ) : (
              <>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  editable={!submitting}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Rechercher un pseudo"
                  placeholderTextColor={COLORS.textMuted}
                  accessibilityLabel="Rechercher un ami par pseudo"
                  style={styles.input}
                />
                <Text style={styles.hint}>Sans invitation, le défi est ouvert à tous les joueurs.</Text>
                {searching ? <ActivityIndicator color={COLORS.primary} /> : null}
                {searchError ? <InlineMessage tone="error">{searchError}</InlineMessage> : null}
                {!searching && !searchError && query.trim().length >= 2 && results.length === 0 ? <Text style={styles.hint}>Aucun joueur trouvé pour « {query.trim()} ».</Text> : null}
                {results.map((player) => (
                  <Pressable
                    key={player.user_id}
                    onPress={() => {
                      setRecipient({ id: player.user_id, pseudo: player.pseudo });
                      setQuery("");
                      setResults([]);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Inviter ${player.pseudo ?? "ce joueur"}${player.city ? `, ${player.city}` : ""}`}
                    style={styles.result}
                  >
                    <Text style={styles.recipientName}>{player.pseudo ?? "Joueur"}</Text>
                    {player.city ? <Text style={styles.hint}>{player.city}</Text> : null}
                  </Pressable>
                ))}
              </>
            )}
          </View>

          {submitError ? <InlineMessage tone="error">{submitError}</InlineMessage> : null}
          {submitting ? <InlineMessage tone="info">Envoi de la vidéo en cours, ne quitte pas l'écran…</InlineMessage> : null}

          <ActionButton label={offline ? "Réessayer l'envoi" : "Envoyer pour validation"} onPress={submit} loading={submitting} disabled={submitting} />
          <Text style={styles.footnote}>Aucune mise, aucun gain : seul le score validé par la modération compte.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, paddingBottom: 48 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, color: COLORS.text, paddingHorizontal: 14, fontSize: 16 },
  counter: { color: COLORS.textMuted, fontSize: 12, alignSelf: "flex-end", marginTop: -6 },
  hint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  rulesToggle: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 },
  rulesTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  rulesSub: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  rulesChevron: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
  recipient: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(212,175,55,0.45)", backgroundColor: "rgba(212,175,55,0.08)" },
  recipientName: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  result: { minHeight: 48, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  footnote: { color: COLORS.textMuted, fontSize: 12, textAlign: "center", lineHeight: 17 },
});
