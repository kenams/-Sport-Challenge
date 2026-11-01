import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import ScreenContainer from "../components/ScreenContainer";
import UserAvatar from "../components/UserAvatar";
import RulesCard from "../components/immortal/RulesCard";
import StatusBadge from "../components/immortal/StatusBadge";
import AttemptVideo from "../components/immortal/AttemptVideo";
import ErrorState from "../components/immortal/ErrorState";
import EmptyState from "../components/immortal/EmptyState";
import { ActionButton, ConfirmModal, FieldLabel, InlineMessage, formStyles } from "../components/immortal/AttemptFormParts";
import { getAttempt, listFormats, listResponses, reportAttempt, withdrawAttempt } from "../services/api";
import { FALLBACK_FORMATS, formatByKey } from "../domain/formats";
import type { Attempt, ChallengeFormat } from "../domain/types";
import { COLORS } from "../theme";
import {
  DETAILS_MAX,
  REPORT_REASONS,
  canReport,
  canRespond,
  canWithdraw,
  challengeTitle,
  dateTimeFr,
  duelView,
  revengeOpponent,
  scoreDisplay,
  territoryLabel,
  type ReportReason,
} from "./helpers/attempts";
import { useUserId } from "./helpers/sendAttempt";

type Action = { kind: "report" | "withdraw"; attempt: Attempt } | null;

function DecisionNote({ attempt }: { attempt: Attempt }) {
  const adjusted = attempt.status === "validated" && attempt.decided_score !== null && attempt.decided_score !== attempt.declared_score;
  if (!(attempt.status === "rejected" || adjusted)) return null;
  const reason = attempt.decision_reason?.trim();
  return (
    <View style={[styles.note, attempt.status === "rejected" ? styles.noteDanger : styles.noteWarn]} accessible>
      <Text style={styles.noteTitle}>{attempt.status === "rejected" ? "Performance rejetée" : `Score ajusté : ${attempt.declared_score} déclaré, ${attempt.decided_score} retenu`}</Text>
      <Text style={styles.noteText}>{reason ? `Motif de la modération : ${reason}` : "Aucun motif n'a été renseigné."}</Text>
    </View>
  );
}

function ScoreBlock({ attempt }: { attempt: Attempt }) {
  const score = scoreDisplay(attempt);
  const retained = score.caption === "Score retenu";
  return (
    <View style={[styles.scoreBox, retained ? styles.scoreRetained : null]} accessible accessibilityLabel={`${score.caption} : ${score.value}${score.declaredNote ? `. ${score.declaredNote}` : ""}`}>
      <Text style={[styles.scoreValue, retained ? { color: COLORS.success } : null]}>{score.value}</Text>
      <Text style={[styles.scoreCaption, retained ? { color: COLORS.success } : null]}>{score.caption}</Text>
      {score.declaredNote ? <Text style={styles.scoreNote}>{score.declaredNote}</Text> : null}
    </View>
  );
}

function PerformanceCard(props: {
  attempt: Attempt;
  formatLabelText: string;
  heading: string;
  userId: string | null;
  showVideoByDefault?: boolean;
  onReport: (attempt: Attempt) => void;
  onWithdraw: (attempt: Attempt) => void;
}) {
  const { attempt, userId } = props;
  const [videoOpen, setVideoOpen] = useState(!!props.showVideoByDefault);
  const pseudo = attempt.pseudo?.trim() || "Joueur";
  const territory = territoryLabel(attempt);
  return (
    <View style={formStyles.card}>
      <Text style={styles.kicker}>{props.heading}</Text>
      <View style={styles.row}>
        <UserAvatar uri={attempt.avatar_url} label={pseudo} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.pseudo}>{pseudo}</Text>
          {territory ? <Text style={styles.muted}>{territory} (territoire déclaré)</Text> : null}
        </View>
        <ScoreBlock attempt={attempt} />
      </View>
      <View style={styles.row}>
        <StatusBadge status={attempt.status} />
        <Text style={[styles.muted, { flexShrink: 1 }]}>{dateTimeFr(attempt.created_at)}</Text>
      </View>
      {attempt.status === "pending" ? <Text style={styles.muted}>Score déclaré par le joueur, pas encore vérifié : il ne compte pas dans les records.</Text> : null}
      <DecisionNote attempt={attempt} />

      {videoOpen ? (
        <AttemptVideo path={attempt.video_path} removed={attempt.video_removed} />
      ) : (
        <ActionButton label="Voir la vidéo" variant="ghost" onPress={() => setVideoOpen(true)} hint={`Lit la vidéo de ${pseudo}`} />
      )}

      {canWithdraw(attempt, userId) || canReport(attempt, userId) ? (
        <View style={styles.actions}>
          {canWithdraw(attempt, userId) ? <ActionButton label="Retirer ma performance" variant="danger" fullWidth={false} onPress={() => props.onWithdraw(attempt)} /> : null}
          {canReport(attempt, userId) ? <ActionButton label="Signaler" variant="ghost" fullWidth={false} onPress={() => props.onReport(attempt)} hint="Signale cette performance à la modération" /> : null}
        </View>
      ) : null}
    </View>
  );
}

export default function ChallengeDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const challengeId: string | undefined = route.params?.challengeId;
  const userId = useUserId();

  const [challenge, setChallenge] = useState<Attempt | null>(null);
  const [responses, setResponses] = useState<Attempt[]>([]);
  const [responsesError, setResponsesError] = useState<string | null>(null);
  const [formats, setFormats] = useState<ChallengeFormat[]>(FALLBACK_FORMATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [reportDone, setReportDone] = useState(false);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!challengeId) {
        setLoading(false);
        setError("Défi introuvable.");
        return;
      }
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      setError(null);
      const [attempt, list, formatList] = await Promise.all([getAttempt(challengeId), listResponses(challengeId), listFormats()]);
      if (attempt.error) setError(attempt.error);
      else if (!attempt.data) setError("Ce défi n'existe plus ou n'est plus disponible.");
      else {
        setChallenge(attempt.data);
        setResponses(list.data ?? []);
        setResponsesError(list.error);
        if (formatList.length > 0) setFormats(formatList);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [challengeId]
  );

  useEffect(() => {
    load("initial");
  }, [load]);

  const closeAction = () => {
    if (actionBusy) return;
    setAction(null);
    setActionError(null);
    setReportReason(null);
    setReportDetails("");
    setReportDone(false);
  };

  const confirmWithdraw = async () => {
    if (!action || actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    const result = await withdrawAttempt(action.attempt.id);
    setActionBusy(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    const wasChallenge = action.attempt.id === challenge?.id;
    setAction(null);
    if (wasChallenge) {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate("MainTabs");
    } else {
      load("refresh");
    }
  };

  const confirmReport = async () => {
    if (!action || actionBusy) return;
    if (!reportReason) {
      setActionError("Choisis un motif de signalement.");
      return;
    }
    setActionBusy(true);
    setActionError(null);
    const result = await reportAttempt(action.attempt.id, reportReason, reportDetails.trim() || undefined);
    setActionBusy(false);
    if (result.error) setActionError(result.error);
    else setReportDone(true);
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

  if (error || !challenge) {
    return (
      <ScreenContainer>
        <ErrorState message={error ?? "Ce défi n'est plus disponible."} onRetry={() => load("initial")} />
      </ScreenContainer>
    );
  }

  const format = formatByKey(formats, challenge.format_key) ?? null;
  const formatText = format?.label_fr ?? challenge.format_key;
  const respondable = canRespond(challenge, responses, userId);
  const isAuthor = !!userId && challenge.user_id === userId;

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load("refresh")} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
      >
        <View style={{ gap: 4 }}>
          <Text style={formStyles.heading} accessibilityRole="header">
            {challengeTitle(challenge, formatText)}
          </Text>
          <Text style={styles.format}>{formatText}</Text>
          {challenge.recipient_user_id ? <Text style={styles.muted}>Défi nominatif : réservé à un joueur invité.</Text> : null}
        </View>

        <PerformanceCard
          attempt={challenge}
          formatLabelText={formatText}
          heading="Le défi"
          userId={userId}
          showVideoByDefault
          onReport={(attempt) => setAction({ kind: "report", attempt })}
          onWithdraw={(attempt) => setAction({ kind: "withdraw", attempt })}
        />

        {respondable ? <ActionButton label="Répondre au défi" onPress={() => navigation.navigate("RespondChallenge", { challengeId: challenge.id })} /> : null}
        {!isAuthor && userId && !respondable && responses.some((r) => r.user_id === userId) ? <InlineMessage tone="info">Tu as déjà répondu à ce défi.</InlineMessage> : null}

        {format ? (
          <View style={formStyles.card}>
            <Pressable
              onPress={() => setRulesOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: rulesOpen }}
              accessibilityLabel={rulesOpen ? "Masquer les règles" : "Afficher les règles du format"}
              style={styles.rulesToggle}
            >
              <Text style={[styles.sectionTitle, { flex: 1 }]}>Règles du format</Text>
              <Text style={styles.toggleText}>{rulesOpen ? "Masquer" : "Lire"}</Text>
            </Pressable>
            {rulesOpen ? <RulesCard format={format} /> : null}
          </View>
        ) : null}

        <View style={{ gap: 12 }}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Réponses {responses.length > 0 ? `(${responses.length})` : ""}
          </Text>
          {responsesError ? <InlineMessage tone="error">{`Les réponses n'ont pas pu être chargées. ${responsesError}`}</InlineMessage> : null}
          {!responsesError && responses.length === 0 ? (
            <EmptyState title="Aucune réponse pour l'instant" message={respondable ? "Sois le premier à relever ce défi." : "Les réponses validées ou en attente apparaîtront ici."} />
          ) : null}
          {responses.map((response) => {
            const duel = duelView(challenge, response);
            const opponent = revengeOpponent(challenge, response, userId);
            return (
              <View key={response.id} style={{ gap: 10 }}>
                <PerformanceCard
                  attempt={response}
                  formatLabelText={formatText}
                  heading="Réponse"
                  userId={userId}
                  onReport={(attempt) => setAction({ kind: "report", attempt })}
                  onWithdraw={(attempt) => setAction({ kind: "withdraw", attempt })}
                />
                <View style={[formStyles.card, duel.state === "decided" ? styles.duelDecided : null]} accessible accessibilityLabel="Résultat du duel">
                  <Text style={styles.kicker}>Résultat du duel</Text>
                  {duel.state === "awaiting" ? (
                    <Text style={styles.muted}>Résultat en attente de validation : il s'affichera quand les deux performances auront été validées par la modération.</Text>
                  ) : duel.state === "no_result" ? (
                    <Text style={styles.muted}>Pas de résultat : l'une des performances n'a pas été retenue par la modération.</Text>
                  ) : (
                    <>
                      <Text style={styles.duelLine}>
                        {challenge.pseudo?.trim() || "Auteur du défi"} : {duel.challengeScore} — {response.pseudo?.trim() || "Répondant"} : {duel.responseScore}
                      </Text>
                      <Text style={styles.duelOutcome}>
                        {duel.relation === "tie"
                          ? "Égalité : les deux scores retenus sont identiques."
                          : duel.relation === "challenge_higher"
                            ? `Score retenu le plus élevé : ${challenge.pseudo?.trim() || "l'auteur du défi"}.`
                            : `Score retenu le plus élevé : ${response.pseudo?.trim() || "le répondant"}.`}
                      </Text>
                      <Text style={styles.muted}>Comparaison des scores retenus par la modération.</Text>
                    </>
                  )}
                  {opponent && duel.state === "decided" && format ? (
                    <ActionButton
                      label="Revanche"
                      variant="ghost"
                      onPress={() => navigation.navigate("CreateChallenge", { formatKey: challenge.format_key, recipientId: opponent.id, recipientPseudo: opponent.pseudo ?? undefined })}
                      hint={`Lance un défi nominatif à ${opponent.pseudo ?? "ton adversaire"}`}
                    />
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <ConfirmModal
        visible={action?.kind === "withdraw"}
        title="Retirer ma performance ?"
        message="Elle ne sera plus visible ni validée. Cette action est définitive : tu devras renvoyer une nouvelle vidéo pour participer de nouveau."
        confirmLabel="Retirer"
        destructive
        busy={actionBusy}
        error={action?.kind === "withdraw" ? actionError : null}
        onConfirm={confirmWithdraw}
        onCancel={closeAction}
      />

      <Modal visible={action?.kind === "report"} transparent animationType="fade" onRequestClose={closeAction} accessibilityViewIsModal>
        <View style={styles.backdrop}>
          <ScrollView contentContainerStyle={styles.backdropScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.sheet}>
              {reportDone ? (
                <>
                  <Text style={styles.sheetTitle}>Signalement envoyé</Text>
                  <Text style={styles.muted}>Merci. La modération va examiner cette performance.</Text>
                  <ActionButton label="Fermer" onPress={closeAction} />
                </>
              ) : (
                <>
                  <Text style={styles.sheetTitle}>Signaler cette performance</Text>
                  <View accessibilityRole="radiogroup" accessibilityLabel="Motif du signalement" style={{ gap: 8 }}>
                    {REPORT_REASONS.map((reason) => {
                      const selected = reportReason === reason.key;
                      return (
                        <Pressable
                          key={reason.key}
                          onPress={() => setReportReason(reason.key)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={reason.label}
                          style={[styles.reason, selected ? styles.reasonSelected : null, Platform.OS === "web" ? ({ cursor: "pointer" } as object) : null]}
                        >
                          <View style={[styles.radio, selected ? { borderColor: COLORS.primary } : null]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                          <Text style={styles.reasonText}>{reason.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <FieldLabel optional>Précisions</FieldLabel>
                  <TextInput
                    value={reportDetails}
                    onChangeText={(text) => setReportDetails(text.slice(0, DETAILS_MAX))}
                    multiline
                    maxLength={DETAILS_MAX}
                    placeholder="Ex. : le compte s'arrête à 22 sur la vidéo"
                    placeholderTextColor={COLORS.textMuted}
                    accessibilityLabel="Précisions sur le signalement, facultatif"
                    style={styles.details}
                  />
                  {actionError ? <InlineMessage tone="error">{actionError}</InlineMessage> : null}
                  <ActionButton label="Envoyer le signalement" onPress={confirmReport} loading={actionBusy} />
                  <ActionButton label="Annuler" variant="ghost" onPress={closeAction} disabled={actionBusy} />
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, paddingBottom: 48 },
  center: { alignItems: "center", gap: 10, paddingVertical: 60 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  actions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  muted: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  format: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  kicker: { color: COLORS.primary, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  pseudo: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  rulesToggle: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 },
  toggleText: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
  scoreBox: { minWidth: 92, alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  scoreRetained: { borderColor: "rgba(52,211,153,0.45)", backgroundColor: "rgba(52,211,153,0.08)" },
  scoreValue: { color: COLORS.text, fontSize: 26, fontWeight: "900" },
  scoreCaption: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700" },
  scoreNote: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  note: { padding: 12, borderRadius: 12, borderWidth: 1, gap: 4 },
  noteDanger: { borderColor: "rgba(239,68,68,0.45)", backgroundColor: "rgba(239,68,68,0.08)" },
  noteWarn: { borderColor: "rgba(250,204,21,0.4)", backgroundColor: "rgba(250,204,21,0.08)" },
  noteTitle: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  noteText: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  duelDecided: { borderColor: "rgba(52,211,153,0.4)" },
  duelLine: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  duelOutcome: { color: COLORS.success, fontSize: 14, fontWeight: "700" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)" },
  backdropScroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  sheet: { width: "100%", maxWidth: 480, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, gap: 12 },
  sheetTitle: { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  reason: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  reasonSelected: { borderColor: COLORS.primary, backgroundColor: "rgba(212,175,55,0.10)" },
  reasonText: { color: COLORS.text, fontSize: 14, flex: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.textMuted, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.primary },
  details: { minHeight: 84, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, color: COLORS.text, padding: 12, fontSize: 15, textAlignVertical: "top" },
});
