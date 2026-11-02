// Encourager + commentaires courts sur une performance validée. N'a aucun effet sur les points ni les classements.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { COLORS } from "../../theme";
import { ActionButton, ConfirmModal, InlineMessage } from "./AttemptFormParts";
import {
  deleteComment,
  getAttemptSocial,
  listComments,
  postComment,
  reportComment,
  setCheer,
  type AttemptSocial as Social,
  type CommentReportReason,
  type CommentRow,
} from "../../services/api";
import { COMMENT_MAX, COMMENT_REPORT_REASONS, checkComment, cheerLabel, commentAge, commentCountLabel, remainingChars } from "../../screens/helpers/comments";

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as object) : null;
const PAGE = 20;

type Props = { attemptId: string; ownerId: string; userId: string | null };

export default function AttemptSocial({ attemptId, ownerId, userId }: Props) {
  const [social, setSocial] = useState<Social | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentsState, setCommentsState] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [cheering, setCheering] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reporting, setReporting] = useState<CommentRow | null>(null);
  const [reportReason, setReportReason] = useState<CommentReportReason | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const loadSocial = useCallback(async () => {
    const result = await getAttemptSocial(attemptId);
    setSocial(result.data);
    setSocialError(result.error);
  }, [attemptId]);

  const loadComments = useCallback(
    async (more = false) => {
      setCommentsState((s) => (more ? s : "loading"));
      const before = more && comments.length > 0 ? comments[comments.length - 1].id : null;
      const result = await listComments(attemptId, PAGE, before);
      if (result.error || !result.data) {
        setCommentsError(result.error ?? "Impossible de charger les commentaires.");
        setCommentsState("error");
        return;
      }
      setComments((prev) => (more ? [...prev, ...result.data!.filter((c) => !prev.some((p) => p.id === c.id))] : result.data!));
      setHasMore(result.data.length === PAGE);
      setCommentsState("ready");
    },
    [attemptId, comments]
  );

  useEffect(() => {
    loadSocial();
  }, [loadSocial]);

  const toggleComments = () => {
    const next = !open;
    setOpen(next);
    if (next && commentsState === "idle") loadComments();
  };

  const toggleCheer = async () => {
    if (!social || cheering || busyRef.current) return;
    busyRef.current = true;
    setCheering(true);
    setNotice(null);
    const wantOn = !social.cheered_by_me;
    const result = await setCheer(attemptId, wantOn);
    busyRef.current = false;
    setCheering(false);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    setSocial({ ...social, cheered_by_me: wantOn, cheer_count: result.data ?? social.cheer_count });
  };

  const send = async () => {
    if (sending) return;
    const check = checkComment(draft);
    if (!check.ok) {
      setDraftError(check.message);
      return;
    }
    setSending(true);
    setDraftError(null);
    const result = await postComment(attemptId, check.text);
    setSending(false);
    if (result.error) {
      setDraftError(result.error);
      return;
    }
    setDraft("");
    setNotice(null);
    await Promise.all([loadComments(false), loadSocial()]);
  };

  const remove = async (comment: CommentRow) => {
    setNotice(null);
    const result = await deleteComment(comment.id);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== comment.id));
    loadSocial();
  };

  const confirmReport = async () => {
    if (!reporting || reportBusy) return;
    if (!reportReason) {
      setReportError("Choisis un motif.");
      return;
    }
    setReportBusy(true);
    setReportError(null);
    const result = await reportComment(reporting.id, reportReason);
    setReportBusy(false);
    if (result.error) {
      setReportError(result.error);
      return;
    }
    setReporting(null);
    setReportReason(null);
    setNotice("Merci, le commentaire a été signalé à la modération.");
  };

  if (!social && !socialError) {
    return (
      <View style={styles.loading} accessibilityLabel="Chargement des encouragements">
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }
  if (socialError) {
    return (
      <View style={styles.box}>
        <InlineMessage tone="error">{socialError}</InlineMessage>
        <ActionButton label="Réessayer" variant="ghost" onPress={loadSocial} fullWidth={false} />
      </View>
    );
  }
  if (!social) return null;

  const isOwn = !!userId && userId === ownerId;
  const left = remainingChars(draft);

  return (
    <View style={styles.box}>
      <View style={styles.bar}>
        {isOwn ? (
          <View style={styles.cheerStatic} accessible accessibilityLabel={cheerLabel(social.cheer_count)}>
            <FontAwesome5 name="hands-helping" size={14} color={COLORS.textMuted} />
            <Text style={styles.count}>{cheerLabel(social.cheer_count)}</Text>
          </View>
        ) : (
          <Pressable
            onPress={toggleCheer}
            disabled={cheering || !social.can_interact}
            accessibilityRole="button"
            accessibilityLabel={social.cheered_by_me ? "Retirer mon encouragement" : "Encourager"}
            accessibilityState={{ selected: social.cheered_by_me, busy: cheering, disabled: !social.can_interact }}
            style={[styles.cheer, social.cheered_by_me ? styles.cheerOn : null, cheering ? { opacity: 0.6 } : null, webCursor]}
          >
            <FontAwesome5 name="hands-helping" size={14} color={social.cheered_by_me ? "#0B0B0B" : COLORS.primary} />
            <Text style={[styles.cheerLabel, social.cheered_by_me ? { color: "#0B0B0B" } : null]}>{social.cheered_by_me ? "Encouragé" : "Encourager"}</Text>
          </Pressable>
        )}
        <Text style={styles.count} accessibilityLiveRegion="polite">
          {social.cheer_count > 0 ? cheerLabel(social.cheer_count) : isOwn ? "" : "Sois le premier à encourager"}
        </Text>
        <Pressable
          onPress={toggleComments}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${open ? "Masquer" : "Afficher"} les commentaires. ${commentCountLabel(social.comment_count)}`}
          style={[styles.toggle, webCursor]}
        >
          <FontAwesome5 name="comment" size={14} color={COLORS.primary} />
          <Text style={styles.toggleLabel}>{commentCountLabel(social.comment_count)}</Text>
        </Pressable>
      </View>

      {notice ? <InlineMessage tone={notice.startsWith("Merci") ? "success" : "error"}>{notice}</InlineMessage> : null}

      {open ? (
        <View style={styles.comments}>
          {userId ? (
            <View style={{ gap: 6 }}>
              <TextInput
                value={draft}
                onChangeText={(t) => {
                  setDraft(t);
                  setDraftError(null);
                }}
                multiline
                editable={!sending}
                placeholder="Écris un mot d'encouragement"
                placeholderTextColor={COLORS.textMuted}
                accessibilityLabel={`Ajouter un commentaire, ${COMMENT_MAX} caractères maximum`}
                style={[styles.input, draftError ? styles.inputError : null]}
              />
              <View style={styles.inputFooter}>
                <Text style={[styles.tiny, left < 0 ? { color: "#F87171" } : null]} accessibilityLiveRegion="polite">
                  {left < 0 ? `${-left} caractère(s) en trop` : `${left} caractères restants`}
                </Text>
                <ActionButton label="Envoyer" fullWidth={false} onPress={send} loading={sending} disabled={draft.trim() === ""} />
              </View>
              {draftError ? <InlineMessage tone="error">{draftError}</InlineMessage> : null}
            </View>
          ) : null}

          {commentsState === "loading" ? (
            <View style={styles.loading} accessibilityLabel="Chargement des commentaires">
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : commentsState === "error" ? (
            <View style={{ gap: 8 }}>
              <InlineMessage tone="error">{commentsError}</InlineMessage>
              <ActionButton label="Réessayer" variant="ghost" fullWidth={false} onPress={() => loadComments(false)} />
            </View>
          ) : comments.length === 0 ? (
            <Text style={styles.empty}>Aucun commentaire pour l'instant. Écris le premier mot d'encouragement.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {comments.map((comment) => (
                <View key={comment.id} style={[styles.comment, comment.status === "hidden" ? { opacity: 0.55 } : null]}>
                  <View style={styles.commentHead}>
                    <Text style={styles.author} numberOfLines={1}>
                      {comment.pseudo?.trim() || "Joueur"}
                      {comment.status === "hidden" ? " (masqué)" : ""}
                    </Text>
                    <Text style={styles.tiny}>{commentAge(comment.created_at)}</Text>
                  </View>
                  <Text style={styles.body}>{comment.body}</Text>
                  <View style={styles.commentActions}>
                    {comment.mine ? (
                      <Pressable onPress={() => remove(comment)} accessibilityRole="button" accessibilityLabel="Supprimer mon commentaire" style={[styles.link, webCursor]}>
                        <Text style={styles.linkText}>Supprimer</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => {
                          setReporting(comment);
                          setReportReason(null);
                          setReportError(null);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Signaler le commentaire de ${comment.pseudo ?? "ce joueur"}`}
                        style={[styles.link, webCursor]}
                      >
                        <Text style={styles.linkText}>Signaler</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
              {hasMore ? <ActionButton label="Voir plus de commentaires" variant="ghost" fullWidth={false} onPress={() => loadComments(true)} /> : null}
            </View>
          )}
        </View>
      ) : null}

      <ConfirmModal
        visible={!!reporting}
        title="Signaler ce commentaire"
        message="La modération examinera le commentaire. Choisis le motif qui correspond le mieux."
        confirmLabel="Envoyer le signalement"
        busy={reportBusy}
        error={reportError}
        onConfirm={confirmReport}
        onCancel={() => {
          if (!reportBusy) setReporting(null);
        }}
      >
        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          {COMMENT_REPORT_REASONS.map((reason) => (
            <Pressable
              key={reason.key}
              onPress={() => {
                setReportReason(reason.key);
                setReportError(null);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: reportReason === reason.key }}
              accessibilityLabel={reason.label}
              style={[styles.reason, reportReason === reason.key ? styles.reasonOn : null, webCursor]}
            >
              <Text style={styles.reasonText}>{reason.label}</Text>
            </Pressable>
          ))}
        </View>
      </ConfirmModal>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 },
  loading: { paddingVertical: 10, alignItems: "center" },
  bar: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  cheer: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: "rgba(212,175,55,0.55)", backgroundColor: "rgba(212,175,55,0.08)" },
  cheerOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  cheerStatic: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  cheerLabel: { color: COLORS.primary, fontSize: 14, fontWeight: "800" },
  count: { color: COLORS.textMuted, fontSize: 13, flexShrink: 1 },
  toggle: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, marginLeft: "auto" },
  toggleLabel: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  comments: { gap: 12 },
  input: { minHeight: 76, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, color: COLORS.text, padding: 12, fontSize: 15, textAlignVertical: "top" },
  inputError: { borderColor: "rgba(239,68,68,0.6)" },
  inputFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  tiny: { color: COLORS.textMuted, fontSize: 12 },
  empty: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
  comment: { gap: 4, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  commentHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  author: { color: COLORS.text, fontSize: 14, fontWeight: "800", flexShrink: 1 },
  body: { color: COLORS.text, fontSize: 15, lineHeight: 21 },
  commentActions: { flexDirection: "row", justifyContent: "flex-end" },
  link: { minHeight: 36, justifyContent: "center", paddingHorizontal: 6 },
  linkText: { color: COLORS.textMuted, fontSize: 13, textDecorationLine: "underline" },
  reason: { minHeight: 46, justifyContent: "center", paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  reasonOn: { borderColor: COLORS.primary, backgroundColor: "rgba(212,175,55,0.12)" },
  reasonText: { color: COLORS.text, fontSize: 15 },
});
