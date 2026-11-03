import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import EmptyState from "../components/immortal/EmptyState";
import ErrorState from "../components/immortal/ErrorState";
import EventPoster from "../components/immortal/EventPoster";
import EventShareButton from "../components/immortal/EventShareButton";
import EventStatusBadge from "../components/immortal/EventStatusBadge";
import EventSupportPanel from "../components/immortal/EventSupportPanel";
import { COLORS } from "../theme";
import { supabase } from "../supabase";
import { getPublicEvent } from "../services/api";
import { deviceTimezone, disciplineLabel, formatLabel, formatTimeFr } from "../domain/formats";
import type { PublicEvent } from "../domain/types";
import { hasShareableLink, publicEventUrl } from "../services/share";
import { playerName, playerTerritory } from "./helpers/eventProfiles";
import { eventStatusInfo } from "./helpers/eventStatus";
import { useEventEngagement } from "./helpers/useEventEngagement";
import { useSessionUser } from "./helpers/useSessionUser";

/** Page publique /e/:slug. Le chargement ne dépend d'aucune session ; un compte n'est demandé que pour soutenir ou être rappelé. */
export default function PublicEventScreen({ navigation, route }: any) {
  const slug: string = route?.params?.slug ?? "";
  const { uid } = useSessionUser();
  const { width } = useWindowDimensions();

  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [errorText, setErrorText] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [idMissing, setIdMissing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setState("loading");
      const res = await getPublicEvent(slug);
      setRefreshing(false);
      if (res.error) {
        setErrorText(res.error);
        setState("error");
        return;
      }
      if (!res.data || res.data.status === "cancelled") {
        setEvent(null);
        setState("missing");
        return;
      }
      setEvent(res.data);
      setState("ready");
    },
    [slug]
  );

  useEffect(() => {
    load();
  }, [load]);

  // L'identifiant n'est nécessaire que pour soutenir / être rappelé, donc uniquement une fois connecté.
  useEffect(() => {
    let alive = true;
    setEventId(null);
    setIdMissing(false);
    if (!uid || !slug) return;
    supabase
      .from("duel_events")
      .select("id")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        if (data?.id) setEventId(data.id as string);
        else setIdMissing(true);
      });
    return () => {
      alive = false;
    };
  }, [uid, slug]);

  const reload = useCallback(() => {
    load(true);
  }, [load]);
  const engagement = useEventEngagement(eventId, uid, reload);

  const goLogin = () => navigation.navigate("Login");
  const goRegister = () => navigation.navigate("Register");

  if (state === "loading") {
    return (
      <ScreenContainer>
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} accessibilityLabel="Chargement du duel" />
      </ScreenContainer>
    );
  }
  if (state === "error") {
    return (
      <ScreenContainer>
        <ErrorState message={errorText} onRetry={() => load()} />
      </ScreenContainer>
    );
  }
  if (state === "missing" || !event) {
    return (
      <ScreenContainer>
        <EmptyState title="Cet événement n'existe plus ou a été annulé" message="Le lien est peut-être incorrect, ou le duel a été retiré." />
      </ScreenContainer>
    );
  }

  const nameA = playerName(event.player_a);
  const nameB = playerName(event.player_b);
  const when = formatTimeFr(event.scheduled_at, deviceTimezone());
  const formatKey = event.format;
  const posterWidth = Math.min(340, Math.max(220, width - 56));
  const feedback = engagement.feedback ?? (uid && idMissing ? { text: "Le soutien n'est pas disponible depuis cette page pour le moment.", error: true } : null);

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={{ alignItems: "center" }}>
          <EventPoster
            width={posterWidth}
            playerA={{ pseudo: nameA, territory: playerTerritory(event.player_a) }}
            playerB={{ pseudo: nameB, territory: playerTerritory(event.player_b) }}
            disciplineLabel={disciplineLabel(event.discipline)}
            formatLabel={formatLabel(formatKey)}
            whenText={when}
            status={event.status}
            linkText={hasShareableLink() ? publicEventUrl(event.slug) : null}
            result={event.result}
          />
        </View>

        <View style={styles.card}>
          <EventStatusBadge status={event.status} />
          <Text style={styles.when}>{when}</Text>
          <Text style={styles.sub}>{eventStatusInfo(event.status).help}</Text>
          {event.result ? (
            <Text accessibilityLabel={`Résultat : ${nameA} ${event.result.score_a}, ${nameB} ${event.result.score_b}`} style={styles.score}>
              {event.result.score_a} - {event.result.score_b}
            </Text>
          ) : null}
        </View>

        <EventSupportPanel
          status={event.status}
          a={{ id: event.player_a.id, name: nameA, supporters: event.supporters_a }}
          b={{ id: event.player_b.id, name: nameB, supporters: event.supporters_b }}
          authed={!!uid}
          viewerId={uid}
          supportedId={engagement.supportedId}
          reminderOn={engagement.reminderOn}
          busy={engagement.busy}
          feedback={feedback}
          onSupport={engagement.support}
          onToggleReminder={engagement.toggle}
          onLogin={goLogin}
          onRegister={goRegister}
        />

        <EventShareButton
          event={{
            slug: event.slug,
            status: event.status,
            scheduled_at: event.scheduled_at,
            timezone: event.timezone,
            formatKey,
            playerA: { pseudo: event.player_a.pseudo, city: event.player_a.city },
            playerB: { pseudo: event.player_b.pseudo, city: event.player_b.city },
          }}
        />
        <Text style={styles.sub}>Page publique : aucune vidéo ni donnée privée. Ceci n'est pas une diffusion en direct.</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 90, gap: 14 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, gap: 8 },
  when: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  sub: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  score: { color: COLORS.text, fontSize: 36, fontWeight: "900" },
});
