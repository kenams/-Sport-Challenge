import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import ScreenContainer from "../components/ScreenContainer";
import RulesCard from "../components/immortal/RulesCard";
import VideoPicker from "../components/immortal/VideoPicker";
import ErrorState from "../components/immortal/ErrorState";
import EmptyState from "../components/immortal/EmptyState";
import { ActionButton, InlineMessage, ScoreField, SubmissionSuccess, formStyles } from "../components/immortal/AttemptFormParts";
import { getAttempt, listResponses, listFormats } from "../services/api";
import type { VideoCandidate } from "../services/video";
import { FALLBACK_FORMATS, formatByKey } from "../domain/formats";
import type { Attempt, ChallengeFormat } from "../domain/types";
import { COLORS } from "../theme";
import { canRespond, challengeTitle, isNetworkMessage, parseDeclaredScore } from "./helpers/attempts";
import { sendAttempt, useUserId } from "./helpers/sendAttempt";

export default function RespondChallengeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const challengeId: string | undefined = route.params?.challengeId;
  const userId = useUserId();

  const [challenge, setChallenge] = useState<Attempt | null>(null);
  const [responses, setResponses] = useState<Attempt[]>([]);
  const [formats, setFormats] = useState<ChallengeFormat[]>(FALLBACK_FORMATS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(true);
  const [score, setScore] = useState("");
  const [video, setVideo] = useState<VideoCandidate | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [sent, setSent] = useState(false);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (!challengeId) {
      setLoading(false);
      setLoadError("Défi introuvable.");
      return;
    }
    setLoading(true);
    setLoadError(null);
    const [attempt, list, formatList] = await Promise.all([getAttempt(challengeId), listResponses(challengeId), listFormats()]);
    if (attempt.error) setLoadError(attempt.error);
    else if (!attempt.data) setLoadError("Ce défi n'existe plus ou n'est plus disponible.");
    else {
      setChallenge(attempt.data);
      setResponses(list.data ?? []);
      if (formatList.length > 0) setFormats(formatList);
    }
    setLoading(false);
  }, [challengeId]);

  useEffect(() => {
    load();
  }, [load]);

  const format = challenge ? formatByKey(formats, challenge.format_key) ?? null : null;
  const parsed = format ? parseDeclaredScore(score, format.max_score) : null;

  const submit = async () => {
    if (busy.current || !challenge || !format) return;
    setShowErrors(true);
    setSubmitError(null);
    setOffline(false);
    if (!parsed || !parsed.ok || !video) return;
    if (!userId) {
      setSubmitError("Connecte-toi pour répondre à ce défi.");
      return;
    }
    busy.current = true;
    setSubmitting(true);
    try {
      const result = await sendAttempt({ userId, format: challenge.format_key, score: parsed.value, video, challengeId: challenge.id });
      if (result.ok) setSent(true);
      else if (isNetworkMessage(result.message)) {
        setOffline(true);
        setSubmitError("Connexion perdue pendant l'envoi. Ta réponse et ta vidéo sont conservées : réessaie dès que le réseau revient.");
      } else setSubmitError(result.message);
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  const back = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("MainTabs");
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.center} accessibilityLiveRegion="polite">
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={styles.muted}>Chargement du défi…</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (loadError || !challenge || !format) {
    return (
      <ScreenContainer>
        <ErrorState message={loadError ?? "Ce défi n'est plus disponible."} onRetry={load} />
      </ScreenContainer>
    );
  }

  if (sent) {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.scroll}>
          <SubmissionSuccess
            kind="response"
            onViewChallenge={() => navigation.replace("ChallengeDetail", { challengeId: challenge.id })}
            onDone={back}
            doneLabel="Retour"
          />
        </ScrollView>
      </ScreenContainer>
    );
  }

  if (userId && !canRespond(challenge, responses, userId)) {
    const own = challenge.user_id === userId;
    const already = responses.some((response) => response.user_id === userId);
    const reserved = !!challenge.recipient_user_id && challenge.recipient_user_id !== userId;
    return (
      <ScreenContainer>
        <EmptyState
          title={own ? "Tu ne peux pas répondre à ton propre défi" : already ? "Tu as déjà répondu à ce défi" : reserved ? "Ce défi est réservé à un autre joueur" : "Ce défi n'est plus disponible"}
          message={already ? "Une seule réponse est possible par défi. Retrouve ta performance et son statut sur la page du défi." : undefined}
          actionLabel="Voir le défi"
          onAction={() => navigation.replace("ChallengeDetail", { challengeId: challenge.id })}
        />
      </ScreenContainer>
    );
  }

  const videoError = showErrors && !video ? "Ajoute la vidéo de ta performance pour répondre." : null;

  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ gap: 4 }}>
            <Text style={formStyles.heading} accessibilityRole="header">
              Répondre au défi
            </Text>
            <Text style={formStyles.lead}>Même format que le défi, mêmes règles. Ta performance sera validée par la modération.</Text>
          </View>

          <View style={formStyles.card}>
            <Text style={styles.challengeTitle}>{challengeTitle(challenge, format.label_fr)}</Text>
            <Text style={styles.formatLine}>
              {format.label_fr} · par {challenge.pseudo?.trim() || "un joueur"}
            </Text>
            <Text style={styles.muted}>Score déclaré par l'auteur : {challenge.status === "validated" && challenge.decided_score !== null ? `${challenge.decided_score} (retenu)` : `${challenge.declared_score} (non validé)`}</Text>
            <Text style={styles.muted}>Format imposé par le défi, non modifiable.</Text>
          </View>

          <View style={formStyles.card}>
            <Pressable
              onPress={() => setRulesOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: rulesOpen }}
              accessibilityLabel={rulesOpen ? "Masquer les règles" : "Afficher les règles"}
              style={styles.rulesToggle}
            >
              <Text style={[styles.challengeTitle, { flex: 1 }]}>Règles du format</Text>
              <Text style={styles.toggleText}>{rulesOpen ? "Masquer" : "Lire"}</Text>
            </Pressable>
            {rulesOpen ? <RulesCard format={format} /> : null}
          </View>

          <View style={formStyles.card}>
            <ScoreField value={score} onChange={setScore} max={format.max_score} disabled={submitting} showError={showErrors} />
          </View>

          <View style={formStyles.card}>
            <VideoPicker value={video} onChange={setVideo} maxSeconds={format.max_video_seconds} disabled={submitting} error={videoError} />
          </View>

          {submitError ? <InlineMessage tone="error">{submitError}</InlineMessage> : null}
          {submitting ? <InlineMessage tone="info">Envoi de la vidéo en cours, ne quitte pas l'écran…</InlineMessage> : null}

          <ActionButton label={offline ? "Réessayer l'envoi" : "Envoyer ma réponse"} onPress={submit} loading={submitting} disabled={submitting} />
          <Text style={styles.muted}>Une seule réponse par défi. Tu pourras la retirer tant qu'elle est en attente.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, paddingBottom: 48 },
  center: { alignItems: "center", gap: 10, paddingVertical: 60 },
  muted: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  challengeTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  formatLine: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  rulesToggle: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 },
  toggleText: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
});
