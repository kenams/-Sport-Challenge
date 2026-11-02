// Modération : réservée aux modérateurs (revérifiée à l'ouverture). Le serveur décide et journalise ; le client demande.
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import EmptyState from "../components/immortal/EmptyState";
import ErrorState from "../components/immortal/ErrorState";
import ModerationCard from "../components/immortal/ModerationCard";
import { COLORS } from "../theme";
import { supabase } from "../supabase";
import ActionButton from "../components/immortal/ActionButton";
import { isModerator, listFormats, listModerationQueue, listReportedComments, moderateAttempt, moderateComment, type ReportedComment } from "../services/api";
import { FALLBACK_FORMATS, formatByKey } from "../domain/formats";
import type { ChallengeFormat, ModerationQueueItem } from "../domain/types";
import type { ModerationAction } from "./helpers/moderationInput";

type Mode = "pending" | "reported" | "comments";
type Access = "checking" | "allowed" | "denied";

const SUCCESS: Record<ModerationAction, string> = {
  validate: "Performance validée.",
  reject: "Performance rejetée.",
  remove_video: "Vidéo retirée.",
  restore_video: "Vidéo rétablie.",
  dismiss_reports: "Signalements classés sans suite.",
};

export default function ModerationScreen() {
  const [access, setAccess] = useState<Access>("checking");
  const [mode, setMode] = useState<Mode>("pending");
  const [items, setItems] = useState<ModerationQueueItem[]>([]);
  const [commentItems, setCommentItems] = useState<ReportedComment[]>([]);
  const [commentBusy, setCommentBusy] = useState<number | null>(null);
  const [formats, setFormats] = useState<ChallengeFormat[]>(FALLBACK_FORMATS);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ok, session, list] = await Promise.all([isModerator().catch(() => false), supabase.auth.getSession(), listFormats()]);
      if (!alive) return;
      setUid(session.data.session?.user?.id ?? null);
      setFormats(list);
      setAccess(ok ? "allowed" : "denied");
    })();
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(
    async (which: Mode, refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      if (which === "comments") {
        const res = await listReportedComments();
        if (res.error) setError(res.error);
        setCommentItems(res.data ?? []);
        setItems([]);
      } else {
        const result = await listModerationQueue(which);
        if (result.error) setError(result.error);
        setItems(result.data ?? []);
      }
      setLoading(false);
      setRefreshing(false);
    },
    []
  );

  useEffect(() => {
    if (access === "allowed") load(mode);
  }, [access, mode, load]);

  const decide = useCallback(
    async (item: ModerationQueueItem, action: ModerationAction, score: number | null, reason: string | null) => {
      const result = await moderateAttempt(item.id, action, score, reason);
      if (result.error) return result.error;
      setNotice(SUCCESS[action]);
      await load(mode, true);
      return null;
    },
    [load, mode]
  );

  const decideComment = async (item: ReportedComment, action: "hide" | "dismiss_reports") => {
    if (commentBusy !== null) return;
    setCommentBusy(item.id);
    const res = await moderateComment(item.id, action, null);
    setCommentBusy(null);
    if (res.error) {
      setNotice(res.error);
      return;
    }
    setNotice(action === "hide" ? "Commentaire masqué." : "Signalements classés sans suite.");
    await load("comments", true);
  };

  if (access === "checking") {
    return (
      <ScreenContainer>
        <View style={styles.center} accessibilityLabel="Vérification de l'accès">
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  if (access === "denied") {
    return (
      <ScreenContainer>
        <View style={styles.column}>
          <EmptyState title="Accès réservé" message="Cet espace est réservé aux modérateurs d'IMMORTAL." />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(mode, true)} tintColor={COLORS.primary} />}
      >
        <View style={styles.tabs} accessibilityRole="tablist">
          <Tab label="À valider" selected={mode === "pending"} onPress={() => { setNotice(null); setMode("pending"); }} />
          <Tab label="Signalées" selected={mode === "reported"} onPress={() => { setNotice(null); setMode("reported"); }} />
          <Tab label="Commentaires" selected={mode === "comments"} onPress={() => { setNotice(null); setMode("comments"); }} />
        </View>
        <Text style={styles.help}>
          Compte les répétitions sur la vidéo, selon les règles du format. Chaque décision est enregistrée dans le journal de modération.
        </Text>
        {notice ? (
          <Text style={styles.notice} accessibilityRole="alert">
            {notice}
          </Text>
        ) : null}

        {loading && !refreshing ? (
          <View style={styles.center} accessibilityLabel="Chargement de la file">
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : error ? (
          <ErrorState message={error} onRetry={() => load(mode)} />
        ) : mode === "comments" ? (
          commentItems.length === 0 ? (
            <EmptyState title="Aucun commentaire signalé" message="Aucun signalement de commentaire à examiner pour le moment." />
          ) : (
            commentItems.map((c) => (
              <View key={c.id} style={styles.commentCard}>
                <Text style={styles.commentAuthor}>{c.pseudo ?? "Joueur"}  ·  {c.open_reports} signalement(s)</Text>
                <Text style={styles.commentBody}>{c.body}</Text>
                <ActionButton label="Masquer le commentaire" variant="danger" loading={commentBusy === c.id} onPress={() => decideComment(c, "hide")} />
                <ActionButton label="Classer sans suite" variant="ghost" disabled={commentBusy !== null} onPress={() => decideComment(c, "dismiss_reports")} />
              </View>
            ))
          )
        ) : items.length === 0 ? (
          <EmptyState
            title={mode === "pending" ? "Rien à valider" : "Aucune performance signalée"}
            message={mode === "pending" ? "Toutes les performances reçues ont été traitées." : "Aucun signalement à examiner pour le moment."}
          />
        ) : (
          items.map((item) => (
            <ModerationCard
              key={item.id}
              item={item}
              format={formatByKey(formats, item.format_key) ?? FALLBACK_FORMATS[0]}
              isOwn={!!uid && item.user_id === uid}
              onDecide={decide}
            />
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function Tab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.tab, selected ? styles.tabOn : null, Platform.OS === "web" ? ({ cursor: "pointer" } as object) : null]}
    >
      <Text style={[styles.tabText, selected ? styles.tabTextOn : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40, gap: 14, width: "100%", maxWidth: 720, alignSelf: "center" },
  column: { width: "100%", maxWidth: 720, alignSelf: "center" },
  center: { paddingVertical: 60, alignItems: "center" },
  tabs: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, minHeight: 46, borderRadius: 23, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface },
  tabOn: { borderColor: COLORS.primary, backgroundColor: "rgba(212,175,55,0.16)" },
  tabText: { color: COLORS.textMuted, fontSize: 14, fontWeight: "600" },
  tabTextOn: { color: COLORS.primary, fontWeight: "800" },
  commentCard: { gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  commentAuthor: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
  commentBody: { color: COLORS.text, fontSize: 15, lineHeight: 21, ...(Platform.OS === "web" ? ({ overflowWrap: "anywhere" } as object) : null) },
  help: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19 },
  notice: { color: COLORS.success, fontSize: 14, fontWeight: "700" },
});
