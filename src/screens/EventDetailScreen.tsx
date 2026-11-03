import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import EmptyState from "../components/immortal/EmptyState";
import ErrorState from "../components/immortal/ErrorState";
import RulesCard from "../components/immortal/RulesCard";
import EventAction from "../components/immortal/EventAction";
import EventAuthPrompt from "../components/immortal/EventAuthPrompt";
import EventPoster from "../components/immortal/EventPoster";
import EventShareButton from "../components/immortal/EventShareButton";
import EventStatusBadge from "../components/immortal/EventStatusBadge";
import EventSupportPanel from "../components/immortal/EventSupportPanel";
import { COLORS, TYPO } from "../theme";
import { supabase } from "../supabase";
import { acceptEventSlot, cancelEvent, expireEventProposals, getPublicEvent, listFormats, respondEvent } from "../services/api";
import { deviceTimezone, FALLBACK_FORMATS, disciplineLabel, formatByKey, formatLabel, formatTimeFr } from "../domain/formats";
import type { ChallengeFormat, DuelEvent, PublicEvent } from "../domain/types";
import { publicEventUrl, hasShareableLink, type ShareableEvent } from "../services/share";
import { loadPlayers, playerName, playerTerritory, type PlayerInfo } from "./helpers/eventProfiles";
import { canCancel, canRespond, eventStatusInfo, roleOf } from "./helpers/eventStatus";
import { useEventEngagement } from "./helpers/useEventEngagement";
import { useSessionUser } from "./helpers/useSessionUser";

export default function EventDetailScreen({ navigation, route }: any) {
  const eventId: string = route?.params?.eventId;
  const { uid, ready } = useSessionUser();
  const { width } = useWindowDimensions();

  const [event, setEvent] = useState<DuelEvent | null>(null);
  const [pub, setPub] = useState<PublicEvent | null>(null);
  const [players, setPlayers] = useState<Record<string, PlayerInfo>>({});
  const [formats, setFormats] = useState<ChallengeFormat[]>(FALLBACK_FORMATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<"accept" | "refuse" | "cancel" | null>(null);
  const [actionMsg, setActionMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        await expireEventProposals();
        const { data, error: dbError } = await supabase.from("duel_events").select("*").eq("id", eventId).maybeSingle();
        if (dbError || !data) {
          setEvent(null);
          setError(dbError ? "Impossible de charger cet événement." : null);
          setLoading(false);
          setRefreshing(false);
          return;
        }
        const row = data as DuelEvent;
        setEvent(row);
        setSelectedSlot((current) => current && row.proposed_slots?.includes(current) ? current : row.proposed_slots?.[0] ?? row.scheduled_at);
        setError(null);
        const [pubRes, profileMap] = await Promise.all([getPublicEvent(row.slug), loadPlayers([row])]);
        setPub(pubRes.data ?? null);
        setPlayers(profileMap);
      } catch {
        setError("Connexion impossible. Vérifie ton réseau et réessaie.");
      }
      setLoading(false);
      setRefreshing(false);
    },
    [eventId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const reloadPublic = useCallback(async () => {
    if (!event) return;
    const res = await getPublicEvent(event.slug);
    if (res.data) setPub(res.data);
  }, [event]);

  const engagement = useEventEngagement(event?.id ?? null, uid, reloadPublic);

  const goLogin = () => navigation.navigate("Login");
  const goRegister = () => navigation.navigate("Register");

  const respond = async (accept: boolean) => {
    if (!event) return;
    setActionBusy(accept ? "accept" : "refuse");
    setActionMsg(null);
    const res = accept && !event.is_matchmade && selectedSlot
      ? await acceptEventSlot(event.id, selectedSlot)
      : await respondEvent(event.id, accept);
    setActionBusy(null);
    if (res.error) return setActionMsg({ text: res.error, error: true });
    setActionMsg({ text: accept ? "Tu as accepté. Le serveur confirme le duel quand les deux joueurs ont accepté." : "Tu as refusé ce duel.", error: false });
    load(true);
  };

  const doCancel = async () => {
    if (!event) return;
    setActionBusy("cancel");
    setActionMsg(null);
    const res = await cancelEvent(event.id);
    setActionBusy(null);
    setConfirmCancel(false);
    if (res.error) return setActionMsg({ text: res.error, error: true });
    setActionMsg({ text: "Le duel est annulé.", error: false });
    load(true);
  };

  if (loading && !event) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} accessibilityLabel="Chargement du duel" />
      </ScreenContainer>
    );
  }
  if (error) {
    return (
      <ScreenContainer>
        <ErrorState message={error} onRetry={() => load()} />
      </ScreenContainer>
    );
  }
  if (!event) {
    return (
      <ScreenContainer>
        <View style={{ gap: 12 }}>
          <EmptyState title="Événement introuvable" message="Cet événement n'existe plus, a été annulé ou n'est pas accessible avec ton compte." actionLabel="Retour aux événements" onAction={() => navigation.navigate("MainTabs", { screen: "Evenements" })} />
          {ready && !uid ? <EventAuthPrompt reason="Connecte-toi pour voir les événements qui te concernent." onLogin={goLogin} onRegister={goRegister} /> : null}
        </View>
      </ScreenContainer>
    );
  }

  const a = pub?.player_a ?? players[event.player_a] ?? { id: event.player_a, pseudo: null, city: null };
  const b = pub?.player_b ?? players[event.player_b] ?? { id: event.player_b, pseudo: null, city: null };
  const nameA = playerName(a);
  const nameB = playerName(b);
  const format = formatByKey(formats, event.format_key);
  const when = formatTimeFr(event.scheduled_at, deviceTimezone());
  const info = eventStatusInfo(event.status);
  const role = roleOf(event, uid);
  const url = publicEventUrl(event.slug);
  const share: ShareableEvent = {
    slug: event.slug,
    status: event.status,
    scheduled_at: event.scheduled_at,
    timezone: event.timezone,
    formatKey: event.format_key,
    playerA: { pseudo: a.pseudo, city: a.city },
    playerB: { pseudo: b.pseudo, city: b.city },
  };
  const posterWidth = Math.min(300, Math.max(220, width - 80));

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
        <View style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">
            {nameA} vs {nameB}
          </Text>
          <EventStatusBadge status={event.status} />
          <Text style={styles.sub}>{info.help}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.duel}>
            <PlayerBlock name={nameA} territory={playerTerritory(a)} />
            <Text style={styles.vs}>VS</Text>
            <PlayerBlock name={nameB} territory={playerTerritory(b)} right />
          </View>
          <Text style={styles.when}>{when}</Text>
          <Text style={styles.sub}>
            {formatLabel(event.format_key)} · Ton heure locale
            {event.is_matchmade ? " · Trouvé automatiquement" : " · Territoires déclarés par les joueurs"}
            {role !== "visitor" ? " · Tu participes à ce duel" : ""}
          </Text>
        </View>

        {(event.status === "live" || (event.status === "scheduled" && role !== "visitor")) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{event.status === "live" ? "Le duel est en direct" : "Prêts pour le face-à-face ?"}</Text>
            <Text style={styles.sub}>
              Les deux joueurs apparaissent dans le même live. Le score affiché pendant l’effort reste provisoire jusqu’à la validation humaine.
            </Text>
            <EventAction
              label={event.status === "live" ? "Rejoindre le live" : "Lancer le live"}
              onPress={() => navigation.navigate("DuelLive", { eventId: event.id })}
            />
          </View>
        ) : null}

        {event.format_key === "pushups_60s" || event.format_key === "pullups_max" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Préparer le mouvement</Text>
            <Text style={styles.sub}>Teste les repères caméra avant le duel. L’essai est local et ne crée aucun score.</Text>
            <EventAction label="Tester l’arbitre caméra" variant="ghost" onPress={() => navigation.navigate("CameraJudgeTest", { formatKey: event.format_key })} />
          </View>
        ) : null}

        {pub?.result ? (
          <View style={styles.card} accessible accessibilityLabel={`Résultat : ${nameA} ${pub.result.score_a}, ${nameB} ${pub.result.score_b}`}>
            <Text style={styles.cardTitle}>Résultat</Text>
            <Text style={styles.score}>
              {pub.result.score_a} - {pub.result.score_b}
            </Text>
            <Text style={styles.sub}>Résultat fourni par le serveur, d'après les performances validées.</Text>
          </View>
        ) : null}

        {canRespond(event, uid) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{role === "player_b" ? "On t'a défié" : "Ta réponse"}</Text>
            <Text style={styles.sub}>{event.is_matchmade ? "Un adversaire a été trouvé. Vous avez 15 minutes pour confirmer tous les deux." : "Choisis le créneau qui te convient. L'invitation expire après 48 h, sans défaite ni perte de points."}</Text>
            {!event.is_matchmade && role === "player_b" && (event.proposed_slots?.length ?? 0) > 0 ? (
              <View style={{ gap: 8 }}>
                {event.proposed_slots!.map((slot) => (
                  <Pressable key={slot} onPress={() => setSelectedSlot(slot)} accessibilityRole="radio" accessibilityState={{ selected: selectedSlot === slot }} style={[styles.slot, selectedSlot === slot ? styles.slotSelected : null]}>
                    <Text style={styles.sub}>{formatTimeFr(slot, deviceTimezone())}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={styles.row}>
              <View style={styles.cell}>
                <EventAction label="Accepter" onPress={() => respond(true)} busy={actionBusy === "accept"} disabled={actionBusy !== null || (!event.is_matchmade && role === "player_b" && !selectedSlot)} />
              </View>
              <View style={styles.cell}>
                <EventAction label="Refuser" variant="danger" onPress={() => respond(false)} busy={actionBusy === "refuse"} disabled={actionBusy !== null} />
              </View>
            </View>
          </View>
        ) : null}

        {event.status === "expired" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Invitation expirée</Text>
            <Text style={styles.sub}>Aucune défaite, aucun point perdu et aucune pénalité de fiabilité. Tu peux proposer un autre créneau.</Text>
          </View>
        ) : null}

        {event.status === "scheduled" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>En cas d’absence</Text>
            <Text style={styles.sub}>Aucune défaite n’est attribuée automatiquement pour une absence. Un score ne peut être officialisé que par la modération après examen.</Text>
          </View>
        ) : null}

        {actionMsg ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: actionMsg.error ? "#F87171" : COLORS.success, fontSize: 14, lineHeight: 20 }}>
            {actionMsg.text}
          </Text>
        ) : null}

        {pub && event.status !== "cancelled" ? (
          <EventSupportPanel
            status={event.status}
            a={{ id: a.id, name: nameA, supporters: pub.supporters_a }}
            b={{ id: b.id, name: nameB, supporters: pub.supporters_b }}
            authed={!!uid}
            viewerId={uid}
            supportedId={engagement.supportedId}
            reminderOn={engagement.reminderOn}
            busy={engagement.busy}
            feedback={engagement.feedback}
            onSupport={engagement.support}
            onToggleReminder={engagement.toggle}
            onLogin={goLogin}
            onRegister={goRegister}
          />
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Partager</Text>
          {event.status !== "cancelled" ? (
            <>
              <View style={{ alignItems: "center" }}>
                <EventPoster
                  width={posterWidth}
                  playerA={{ pseudo: nameA, territory: playerTerritory(a) }}
                  playerB={{ pseudo: nameB, territory: playerTerritory(b) }}
                  disciplineLabel={disciplineLabel(event.discipline)}
                  formatLabel={formatLabel(event.format_key)}
                  whenText={when}
                  status={event.status}
                  linkText={hasShareableLink() ? url : null}
                  result={pub?.result ?? null}
                />
              </View>
              <EventShareButton event={share} />
              <Text style={styles.sub}>Le lien ouvre une page publique sans vidéo ni donnée privée.</Text>
            </>
          ) : (
            <Text style={styles.sub}>Un duel annulé ne se partage plus.</Text>
          )}
        </View>

        {format ? <RulesCard format={format} /> : null}

        {canCancel(event, uid) ? (
          <View style={styles.card}>
            {confirmCancel ? (
              <>
                <Text style={styles.text}>Annuler ce duel ? Les deux joueurs et les supporters verront qu'il est annulé.</Text>
                <View style={styles.row}>
                  <View style={styles.cell}>
                    <EventAction label="Oui, annuler le duel" variant="danger" onPress={doCancel} busy={actionBusy === "cancel"} disabled={actionBusy !== null} />
                  </View>
                  <View style={styles.cell}>
                    <EventAction label="Non, garder" variant="ghost" onPress={() => setConfirmCancel(false)} disabled={actionBusy !== null} />
                  </View>
                </View>
              </>
            ) : (
              <EventAction label="Annuler le duel" variant="danger" onPress={() => setConfirmCancel(true)} />
            )}
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function PlayerBlock({ name, territory, right }: { name: string; territory: string; right?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: right ? "flex-end" : "flex-start" }}>
      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.territory}>{territory || "Territoire non renseigné"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 90, gap: 14 },
  head: { gap: 8 },
  title: { ...TYPO.display, color: COLORS.text, fontSize: 22 },
  sub: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  text: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, gap: 10 },
  cardTitle: { color: COLORS.primary, fontSize: 13, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  duel: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  territory: { color: COLORS.textMuted, fontSize: 13 },
  vs: { color: COLORS.primary, fontWeight: "900" },
  when: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  score: { color: COLORS.text, fontSize: 36, fontWeight: "900" },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  cell: { flexGrow: 1, flexBasis: 150 },
  slot: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  slotSelected: { borderColor: COLORS.primary, borderWidth: 2 },
});
