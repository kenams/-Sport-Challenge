import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme";
import { listAttemptReports } from "../../services/api";
import type { ChallengeFormat, ModerationQueueItem } from "../../domain/types";
import { ACTION_CONFIRM, ModerationAction, reasonRequired, reportReasonLabel, validateDecision } from "../../screens/helpers/moderationInput";
import ActionButton from "./ActionButton";
import AccountField from "./AccountField";
import AttemptVideo from "./AttemptVideo";
import RulesCard from "./RulesCard";
import StatusBadge from "./StatusBadge";

type Report = { id: number; reason: string; details: string | null; status: string; created_at: string };

type Props = {
  item: ModerationQueueItem;
  format: ChallengeFormat;
  isOwn: boolean;
  /** Retourne un message d'erreur, ou null si le serveur a accepté la décision. */
  onDecide: (item: ModerationQueueItem, action: ModerationAction, score: number | null, reason: string | null) => Promise<string | null>;
};

function dateLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Une performance à examiner : vidéo, règles, score déclaré, signalements, puis décision en deux temps (choix, confirmation). */
export default function ModerationCard({ item, format, isOwn, onDecide }: Props) {
  const [showVideo, setShowVideo] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [reportsError, setReportsError] = useState(false);
  const [action, setAction] = useState<ModerationAction | null>(null);
  const [score, setScore] = useState(String(Math.min(item.declared_score, format.max_score)));
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (item.report_count > 0) {
      listAttemptReports(item.id).then((res) => {
        if (!alive) return;
        if (res.error) setReportsError(true);
        else setReports(res.data ?? []);
      });
    }
    return () => {
      alive = false;
    };
  }, [item.id, item.report_count]);

  const available: ModerationAction[] = [];
  if (!isOwn) {
    if (item.status === "pending") available.push("validate");
    if (item.status === "pending" || item.status === "validated") available.push("reject");
    available.push(item.video_removed ? "restore_video" : "remove_video");
    if (item.open_reports > 0) available.push("dismiss_reports");
  }

  const choose = (next: ModerationAction) => {
    setAction(next);
    setFormError(null);
    setReason("");
  };

  const confirm = async () => {
    if (!action) return;
    const problem = validateDecision(action, score, reason, format.max_score);
    if (problem) {
      setFormError(problem);
      return;
    }
    setBusy(true);
    setFormError(null);
    const error = await onDecide(item, action, action === "validate" ? Number(score.trim()) : null, reason.trim() || null);
    setBusy(false);
    if (error) setFormError(error);
    else setAction(null);
  };

  const buttonVariant = (a: ModerationAction) => (a === "validate" ? "primary" : a === "reject" || a === "remove_video" ? "danger" : "ghost");
  const buttonLabel = (a: ModerationAction) =>
    ({ validate: "Valider", reject: "Rejeter", remove_video: "Retirer la vidéo", restore_video: "Rétablir la vidéo", dismiss_reports: "Classer les signalements sans suite" })[a];

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.player} numberOfLines={1}>
            {item.pseudo?.trim() || "Joueur"}
          </Text>
          <Text style={styles.muted}>
            {format.label_fr} · {dateLabel(item.created_at)}
          </Text>
        </View>
        <StatusBadge status={item.status} compact />
      </View>

      <View style={styles.declared} accessible accessibilityLabel={`Score déclaré : ${item.declared_score}. Maximum du format : ${format.max_score}.`}>
        <Text style={styles.declaredLabel}>Score déclaré par le joueur</Text>
        <Text style={styles.declaredValue}>{item.declared_score}</Text>
        {item.decided_score !== null ? <Text style={styles.muted}>Score retenu : {item.decided_score}</Text> : null}
      </View>
      {item.video_removed ? <Text style={styles.warn}>Vidéo retirée. Elle reste consultable par la modération.</Text> : null}
      {isOwn ? <Text style={styles.warn}>C'est ta propre performance : tu ne peux pas en décider.</Text> : null}

      {item.report_count > 0 ? (
        <View style={styles.reports}>
          <Text style={styles.reportsTitle}>
            Signalements ({item.report_count}
            {item.open_reports !== item.report_count ? `, dont ${item.open_reports} ouverts` : ""})
          </Text>
          {reports === null && !reportsError ? <ActivityIndicator color={COLORS.primary} /> : null}
          {reportsError ? <Text style={styles.muted}>Détail des signalements indisponible.</Text> : null}
          {reports?.map((r) => (
            <Text key={r.id} style={styles.reportLine}>
              {reportReasonLabel(r.reason)}
              {r.details ? ` : ${r.details}` : ""} <Text style={styles.tiny}>({dateLabel(r.created_at)})</Text>
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.toggles}>
        <ActionButton label={showVideo ? "Masquer la vidéo" : "Voir la vidéo"} variant="ghost" onPress={() => setShowVideo((v) => !v)} style={{ flex: 1 }} />
        <ActionButton label={showRules ? "Masquer les règles" : "Rappel des règles"} variant="ghost" onPress={() => setShowRules((v) => !v)} style={{ flex: 1 }} />
      </View>
      {showVideo ? <AttemptVideo path={item.video_path} removed={false} height={260} /> : null}
      {showRules ? <RulesCard format={format} /> : null}

      {available.length > 0 && !action ? (
        <View style={styles.actions}>
          {available.map((a) => (
            <ActionButton key={a} label={buttonLabel(a)} variant={buttonVariant(a)} onPress={() => choose(a)} />
          ))}
        </View>
      ) : null}

      {action ? (
        <View style={styles.confirm} accessibilityLiveRegion="polite">
          <Text style={styles.confirmTitle}>{ACTION_CONFIRM[action].title}</Text>
          {action === "validate" ? (
            <AccountField
              label={`Score retenu (entier de 0 à ${format.max_score})`}
              value={score}
              onChangeText={setScore}
              keyboardType="number-pad"
              hint={`Le joueur a déclaré ${item.declared_score}. Saisis ce que tu as compté dans la vidéo.`}
            />
          ) : null}
          {action !== "restore_video" && action !== "dismiss_reports" ? (
            <AccountField
              label={reasonRequired(action) ? "Motif (obligatoire)" : "Motif (facultatif)"}
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={300}
              style={{ minHeight: 80, paddingTop: 12, textAlignVertical: "top" }}
              hint="Le motif est communiqué au joueur et conservé dans le journal de modération."
            />
          ) : (
            <Text style={styles.muted}>Cette décision sera enregistrée dans le journal de modération.</Text>
          )}
          {formError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {formError}
            </Text>
          ) : null}
          <ActionButton label={ACTION_CONFIRM[action].button} variant={buttonVariant(action)} onPress={confirm} loading={busy} />
          <ActionButton label="Annuler" variant="link" onPress={() => setAction(null)} disabled={busy} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.card, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, padding: 16, gap: 12 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  player: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  muted: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19 },
  tiny: { color: COLORS.textMuted, fontSize: 11 },
  declared: { padding: 12, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, gap: 2 },
  declaredLabel: { color: COLORS.textMuted, fontSize: 12 },
  declaredValue: { color: COLORS.primary, fontSize: 32, fontWeight: "900" },
  warn: { color: "#FACC15", fontSize: 13, lineHeight: 18 },
  reports: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(239,68,68,0.4)", backgroundColor: "rgba(239,68,68,0.07)", gap: 6 },
  reportsTitle: { color: "#F87171", fontSize: 13, fontWeight: "800" },
  reportLine: { color: COLORS.text, fontSize: 13, lineHeight: 19 },
  toggles: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actions: { gap: 8 },
  confirm: { gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(212,175,55,0.45)", backgroundColor: "rgba(212,175,55,0.05)" },
  confirmTitle: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  error: { color: "#F87171", fontSize: 14, lineHeight: 20 },
});
