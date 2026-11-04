import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import { FontAwesome5 } from "@expo/vector-icons";
import { AudioSession, LiveKitRoom, VideoTrack, isTrackReference, registerGlobals, useParticipants, useRoomContext, useTracks } from "@livekit/react-native";
import { RoomEvent, Track } from "livekit-client";
import ScreenContainer from "../components/ScreenContainer";
import UserAvatar from "../components/UserAvatar";
import { COLORS, TYPO } from "../theme";
import { supabase } from "../supabase";
import { liveVideoErrorMessage } from "../domain/liveVideoErrors";

registerGlobals();

type EventRow = { id: string; slug: string; status: string; format_key: string; player_a: string; player_b: string; scheduled_at: string | null };
type PlayerScore = { event_id: string; user_id: string; repetitions: number; updated_at: string };
type PlayerCard = { pseudo: string | null; avatar_url: string | null };
type OfficialResult = { event_id: string; score_a: number; score_b: number; note: string | null };
type Credentials = { serverUrl: string; token: string };

const TARGETS: Record<string, number> = { pushups_60s: 60, pullups_max: 10 };
const REACTIONS = ["🔥", "💪", "👏", "😂"];

export default function DuelLiveScreen({ navigation }: any) {
  const route = useRoute<any>();
  const eventId = String(route.params?.eventId ?? "");
  const [event, setEvent] = useState<EventRow | null>(null);
  const [scores, setScores] = useState<Record<string, PlayerScore>>({});
  const [players, setPlayers] = useState<Record<string, PlayerCard>>({});
  const [uid, setUid] = useState<string | null>(null);
  const [isPlayer, setIsPlayer] = useState(false);
  const [moderator, setModerator] = useState(false);
  const [officialResult, setOfficialResult] = useState<OfficialResult | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busyRep, setBusyRep] = useState(false);
  const [reviewA, setReviewA] = useState("");
  const [reviewB, setReviewB] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const requestRef = useRef(false);

  const loadScores = useCallback(async () => {
    if (!eventId) return;
    const { data } = await supabase.from("duel_live_scores").select("event_id,user_id,repetitions,updated_at").eq("event_id", eventId);
    setScores(Object.fromEntries(((data ?? []) as PlayerScore[]).map((score) => [score.user_id, score])));
  }, [eventId]);

  useEffect(() => {
    let alive = true;
    const connect = async () => {
      if (!eventId) { setMessage("Duel introuvable."); setLoading(false); return; }
      try {
        const [{ data: session }, { data: row, error }] = await Promise.all([
          supabase.auth.getSession(),
          supabase.from("duel_events").select("id,slug,status,format_key,player_a,player_b,scheduled_at").eq("id", eventId).maybeSingle(),
        ]);
        const userId = session.session?.user.id ?? null;
        if (!alive) return;
        setUid(userId);
        if (error || !row || !userId) {
          setMessage(!userId ? "Connecte-toi pour rejoindre ce live." : "Ce duel est introuvable.");
          setLoading(false);
          return;
        }
        const duel = row as EventRow;
        const participant = userId === duel.player_a || userId === duel.player_b;
        setEvent(duel);
        setIsPlayer(participant);
        const [{ data: moderatorFlag }, { data: profiles }, { data: finalResult }] = await Promise.all([
          supabase.rpc("is_moderator"),
          supabase.from("profiles").select("user_id,pseudo,avatar_url").in("user_id", [duel.player_a, duel.player_b]),
          supabase.from("duel_live_results").select("event_id,score_a,score_b,note").eq("event_id", eventId).maybeSingle(),
        ]);
        if (!alive) return;
        setModerator(moderatorFlag === true);
        setPlayers(Object.fromEntries((profiles ?? []).map((profile: any) => [profile.user_id, { pseudo: profile.pseudo, avatar_url: profile.avatar_url }])));
        if (finalResult) setOfficialResult(finalResult as OfficialResult);
        if (duel.status !== "live" && !(duel.status === "scheduled" && participant)) {
          setMessage("Le duel n’est pas encore en direct.");
          setLoading(false);
          return;
        }
        await loadScores();
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke("duel-live-token", { body: { event_id: eventId } });
        if (!alive) return;
        if (tokenError || !tokenData?.server_url || !tokenData?.participant_token) {
          let errorCode = tokenData?.error as string | undefined;
          const response = (tokenError as unknown as { context?: Response } | null)?.context;
          if (!errorCode && response && typeof response.clone === "function") {
            const body = await response.clone().json().catch(() => null) as { error?: string } | null;
            errorCode = body?.error;
          }
          setMessage(liveVideoErrorMessage(errorCode));
          setLoading(false);
          return;
        }
        if (duel.status === "scheduled" && participant) {
          const { error: startError } = await supabase.rpc("start_duel_live", { p_event_id: eventId });
          if (startError) {
            setMessage(startError.message.includes("outside_live_window") ? "Le live ouvrira 30 minutes avant l’heure prévue." : "Impossible de démarrer ce duel.");
            setLoading(false);
            return;
          }
          duel.status = "live";
          setEvent({ ...duel });
        }
        await AudioSession.startAudioSession();
        if (!alive) { await AudioSession.stopAudioSession(); return; }
        setCredentials({ serverUrl: tokenData.server_url, token: tokenData.participant_token });
        setLoading(false);
      } catch {
        if (!alive) return;
        setMessage("Connexion impossible. Vérifie ton réseau et réessaie.");
        setLoading(false);
      }
    };
    void connect();
    return () => { alive = false; void AudioSession.stopAudioSession(); };
  }, [eventId, loadScores]);

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase.channel(`duel-mobile-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "duel_live_scores", filter: `event_id=eq.${eventId}` }, (payload: any) => {
        const score = (payload.new ?? payload.old) as PlayerScore;
        if (score?.user_id) setScores((current) => ({ ...current, [score.user_id]: score }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "duel_live_results", filter: `event_id=eq.${eventId}` }, (payload: any) => setOfficialResult(payload.new as OfficialResult))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "duel_events", filter: `id=eq.${eventId}` }, (payload: any) => setEvent((current) => current ? { ...current, status: payload.new.status } : current))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  const countFor = (playerId?: string) => scores[playerId ?? ""]?.repetitions ?? 0;
  const leaders = useMemo(() => {
    if (!event) return [] as string[];
    const a = countFor(event.player_a), b = countFor(event.player_b);
    return a === b ? [] : [a > b ? event.player_a : event.player_b];
  }, [event, scores]);

  const addRep = useCallback(async () => {
    if (!event || !isPlayer || busyRep || requestRef.current) return;
    requestRef.current = true;
    setBusyRep(true);
    const { data, error } = await supabase.rpc("increment_duel_live_rep", { p_event_id: event.id });
    requestRef.current = false;
    setBusyRep(false);
    if (error) { setMessage("Répétition non ajoutée. Attends un instant et réessaie."); return; }
    setScores((current) => ({ ...current, [uid!]: { event_id: event.id, user_id: uid!, repetitions: Number(data), updated_at: new Date().toISOString() } }));
  }, [busyRep, event, isPlayer, uid]);

  const finalize = async () => {
    if (!event || reviewBusy || !/^\d{1,3}$/.test(reviewA) || !/^\d{1,3}$/.test(reviewB) || Number(reviewA) > 200 || Number(reviewB) > 200) {
      setMessage("Saisis deux scores compris entre 0 et 200 répétitions."); return;
    }
    setReviewBusy(true);
    const { error } = await supabase.rpc("moderate_live_duel", { p_event_id: event.id, p_score_a: Number(reviewA), p_score_b: Number(reviewB), p_note: reviewNote.trim() || null });
    setReviewBusy(false);
    if (error) { setMessage("La validation n’a pas abouti. Vérifie les scores et réessaie."); return; }
    setOfficialResult({ event_id: event.id, score_a: Number(reviewA), score_b: Number(reviewB), note: reviewNote.trim() || null });
    setMessage(null);
  };

  if (loading) return <ScreenContainer><View style={styles.center}><ActivityIndicator color={COLORS.primary} /><Text style={styles.help}>Connexion à l’arène…</Text></View></ScreenContainer>;
  if (!event || !credentials) return <ScreenContainer><View style={styles.center}><Text style={styles.error}>{message ?? "Live indisponible."}</Text><Pressable onPress={() => navigation.goBack()} style={styles.action}><Text style={styles.actionText}>Retour au duel</Text></Pressable></View></ScreenContainer>;

  const a = players[event.player_a] ?? { pseudo: "Joueur 1", avatar_url: null };
  const b = players[event.player_b] ?? { pseudo: "Joueur 2", avatar_url: null };
  const target = TARGETS[event.format_key] ?? 60;
  const p1 = countFor(event.player_a), p2 = countFor(event.player_b);

  return (
    <LiveKitRoom
      key={credentials.token}
      serverUrl={credentials.serverUrl}
      token={credentials.token}
      connect={event.status !== "finished"}
      audio={isPlayer}
      video={isPlayer}
      options={{ adaptiveStream: true, dynacast: true }}
      onConnected={() => { setConnected(true); setMessage(null); }}
      onDisconnected={() => setConnected(false)}
      onError={() => { setConnected(false); setMessage("Connexion vidéo interrompue. Vérifie ta connexion et rejoins à nouveau le live."); }}
      onMediaDeviceFailure={() => setMessage("Autorise la caméra et le micro dans les réglages du téléphone pour participer au duel.")}
    >
      <NativeRoomScreen
        navigation={navigation}
        event={event}
        a={a}
        b={b}
        uid={uid}
        isPlayer={isPlayer}
        moderator={moderator}
        connected={connected}
        target={target}
        p1={p1}
        p2={p2}
        leaderA={leaders.includes(event.player_a)}
        leaderB={leaders.includes(event.player_b)}
        officialResult={officialResult}
        busyRep={busyRep}
        onAddRep={addRep}
        reviewA={reviewA}
        reviewB={reviewB}
        reviewNote={reviewNote}
        onReviewA={setReviewA}
        onReviewB={setReviewB}
        onReviewNote={setReviewNote}
        onFinalize={finalize}
        reviewBusy={reviewBusy}
        message={message}
      />
    </LiveKitRoom>
  );
}

function NativeRoomScreen(props: {
  navigation: any; event: EventRow; a: PlayerCard; b: PlayerCard; uid: string | null; isPlayer: boolean; moderator: boolean; connected: boolean;
  target: number; p1: number; p2: number; leaderA: boolean; leaderB: boolean; officialResult: OfficialResult | null; busyRep: boolean; onAddRep: () => void;
  reviewA: string; reviewB: string; reviewNote: string; onReviewA: (v: string) => void; onReviewB: (v: string) => void; onReviewNote: (v: string) => void;
  onFinalize: () => void; reviewBusy: boolean; message: string | null;
}) {
  const { event, a, b } = props;
  const tracks = useTracks([Track.Source.Camera]);
  const participants = useParticipants();
  const room = useRoomContext();
  const [reactions, setReactions] = useState<Array<{ id: number; emoji: string }>>([]);

  useEffect(() => {
    const receive = (payload: Uint8Array) => {
      try {
        const emoji = new TextDecoder().decode(payload);
        if (!REACTIONS.includes(emoji)) return;
        setReactions((current) => [...current.slice(-4), { id: Date.now() + Math.random(), emoji }]);
        setTimeout(() => setReactions((current) => current.slice(1)), 2200);
      } catch { /* Ignore unrelated room packets. */ }
    };
    room.on(RoomEvent.DataReceived, receive);
    return () => { room.off(RoomEvent.DataReceived, receive); };
  }, [room]);

  const sendReaction = async (emoji: string) => {
    try { await room.localParticipant.publishData(new TextEncoder().encode(emoji), { reliable: true }); } catch { return; }
    setReactions((current) => [...current.slice(-4), { id: Date.now() + Math.random(), emoji }]);
  };

  const refFor = (id: string) => tracks.find((item) => isTrackReference(item) && item.participant.identity === id);
  const connectedIds = new Set(tracks.filter(isTrackReference).map((item) => item.participant.identity));

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <View style={styles.topline}>
          <Pressable onPress={() => props.navigation.goBack()} accessibilityRole="button" accessibilityLabel="Retour" style={styles.back}><FontAwesome5 name="arrow-left" size={14} color={COLORS.text} /></Pressable>
          <View style={event.status === "live" ? styles.liveTag : styles.finishedTag}>{event.status === "live" ? <View style={styles.dot} /> : null}<Text style={event.status === "live" ? styles.liveText : styles.finishedText}>{event.status === "live" ? "EN DIRECT" : "TERMINÉ"}</Text></View>
          <Text style={styles.viewers}><FontAwesome5 name="eye" size={12} color={COLORS.textMuted} /> {participants.length}</Text>
        </View>
        <Text style={styles.heading}>Le duel est lancé</Text>
        <Text style={styles.subheading}>{event.format_key === "pushups_60s" ? "Pompes" : "Tractions"} · caméra en direct · score provisoire</Text>

        <View style={styles.videoGrid}>
          <NativeVideoCard label={a.pseudo ?? "Joueur 1"} avatar={a.avatar_url} count={props.p1} target={props.target} leader={props.leaderA} track={refFor(event.player_a)} connected={connectedIds.has(event.player_a)} local={props.uid === event.player_a} />
          <NativeVideoCard label={b.pseudo ?? "Joueur 2"} avatar={b.avatar_url} count={props.p2} target={props.target} leader={props.leaderB} track={refFor(event.player_b)} connected={connectedIds.has(event.player_b)} local={props.uid === event.player_b} />
          <View pointerEvents="none" style={styles.reactionFloat}>{reactions.slice(-3).map((item) => <Text key={item.id} style={styles.reaction}>{item.emoji}</Text>)}</View>
        </View>
        {!props.connected ? <Text style={styles.help}>Connexion vidéo… Si elle échoue, vérifie les autorisations caméra/micro et le réseau.</Text> : null}

        <View style={styles.progressCard}>
          <View style={styles.progressHeading}><Text style={styles.progressTitle}>LA COURSE</Text><Text style={styles.targetLabel}>Repère : {props.target} répétitions</Text></View>
          <ProgressLane name={a.pseudo ?? "Joueur 1"} count={props.p1} target={props.target} color="#D7A72F" />
          <ProgressLane name={b.pseudo ?? "Joueur 2"} count={props.p2} target={props.target} color="#38BDF8" />
          <Text style={styles.leaderText}>{props.p1 === props.p2 ? "À égalité" : `${props.p1 > props.p2 ? a.pseudo ?? "Joueur 1" : b.pseudo ?? "Joueur 2"} mène provisoirement`}</Text>
          {props.officialResult ? <View style={styles.officialBox}><Text style={styles.officialLabel}>RÉSULTAT VALIDÉ PAR UN MODÉRATEUR</Text><Text style={styles.officialScore}>{props.officialResult.score_a} — {props.officialResult.score_b}</Text>{props.officialResult.note ? <Text style={styles.note}>{props.officialResult.note}</Text> : null}</View> : <Text style={styles.note}>Le score reste provisoire jusqu’à la validation humaine.</Text>}
        </View>

        {props.isPlayer && event.status === "live" && !props.officialResult ? (
          <View style={styles.cameraJudgeCard}>
            <Text style={styles.cameraJudgeTitle}>COMPTEUR DE RÉPÉTITIONS</Text>
            <Text style={styles.note}>En mobile, le compteur caméra n’est pas disponible. Appuie après chaque répétition ; le modérateur valide le score officiel.</Text>
            <Pressable onPress={props.onAddRep} disabled={props.busyRep} accessibilityRole="button" accessibilityLabel="Ajouter une répétition provisoire" style={[styles.repButton, props.busyRep ? { opacity: 0.65 } : null]}>
              <FontAwesome5 name="plus" size={16} color={COLORS.background} /><Text style={styles.repButtonText}>{props.busyRep ? "Ajout…" : "+1 répétition"}</Text>
            </Pressable>
          </View>
        ) : null}

        {props.moderator && event.status === "live" && !props.officialResult ? (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>VALIDER LE DUEL</Text>
            <Text style={styles.note}>Après avoir regardé les deux flux, saisis les répétitions complètes retenues.</Text>
            <View style={styles.reviewRow}>
              <TextInput value={props.reviewA} onChangeText={props.onReviewA} keyboardType="number-pad" placeholder={a.pseudo ?? "Joueur 1"} placeholderTextColor={COLORS.textMuted} accessibilityLabel={`Score validé de ${a.pseudo ?? "joueur 1"}`} style={styles.reviewInput} />
              <Text style={styles.reviewDash}>—</Text>
              <TextInput value={props.reviewB} onChangeText={props.onReviewB} keyboardType="number-pad" placeholder={b.pseudo ?? "Joueur 2"} placeholderTextColor={COLORS.textMuted} accessibilityLabel={`Score validé de ${b.pseudo ?? "joueur 2"}`} style={styles.reviewInput} />
            </View>
            <TextInput value={props.reviewNote} onChangeText={props.onReviewNote} placeholder="Note facultative" placeholderTextColor={COLORS.textMuted} maxLength={500} style={styles.reviewNote} />
            <Pressable onPress={props.onFinalize} disabled={props.reviewBusy} accessibilityRole="button" style={[styles.repButton, props.reviewBusy ? { opacity: 0.65 } : null]}><Text style={styles.repButtonText}>{props.reviewBusy ? "Validation…" : "Valider le résultat"}</Text></Pressable>
          </View>
        ) : null}

        {event.status === "live" ? <View style={styles.reactionRow}>{REACTIONS.map((emoji) => <Pressable key={emoji} onPress={() => void sendReaction(emoji)} accessibilityRole="button" accessibilityLabel={`Envoyer ${emoji}`} style={styles.reactionButton}><Text style={styles.reactionButtonText}>{emoji}</Text></Pressable>)}</View> : null}
        {props.message ? <Text style={styles.error}>{props.message}</Text> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function NativeVideoCard({ label, avatar, count, target, leader, track, connected, local }: { label: string; avatar: string | null; count: number; target: number; leader: boolean; track: any; connected: boolean; local: boolean }) {
  const ready = !!track && connected;
  return (
    <View style={styles.videoCard}>
      <View style={styles.videoFrame}>
        {ready ? <VideoTrack trackRef={track} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} objectFit="cover" mirror={local} /> : null}
        {!ready ? <View style={styles.waiting}><UserAvatar uri={avatar} label={label} size={42} /><Text style={styles.waitingText}>{connected ? "Caméra en attente…" : "En attente du joueur"}</Text></View> : null}
        {local && ready ? <View style={styles.selfTag}><Text style={styles.selfTagText}>TOI</Text></View> : null}
      </View>
      <View style={styles.videoMeta}><Text numberOfLines={1} style={styles.playerLabel}>{label}</Text><Text style={[styles.videoCount, leader ? styles.leaderCount : null]}>{count}<Text style={styles.videoTarget}> / {target}</Text></Text></View>
      <View style={styles.miniTrack}><View style={[styles.miniFill, { width: `${Math.min(100, (count / target) * 100)}%`, backgroundColor: leader ? COLORS.primary : "#38BDF8" }]} /></View>
    </View>
  );
}

function ProgressLane({ name, count, target, color }: { name: string; count: number; target: number; color: string }) {
  return <View style={styles.lane}><View style={styles.laneTop}><Text style={styles.laneName} numberOfLines={1}>{name}</Text><Text style={styles.laneCount}>{count}<Text style={styles.laneTarget}> / {target}</Text></Text></View><View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, (count / target) * 100)}%`, backgroundColor: color }]} /></View></View>;
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 40, gap: 14 }, center: { flex: 1, minHeight: 360, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  topline: { flexDirection: "row", alignItems: "center", gap: 12 }, back: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.card, alignItems: "center", justifyContent: "center" },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(239,68,68,0.14)", borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7 }, finishedTag: { borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: "rgba(34,197,94,0.12)" },
  finishedText: { color: COLORS.success, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF4444" }, liveText: { color: "#F87171", fontSize: 10, fontWeight: "900", letterSpacing: 1 }, viewers: { marginLeft: "auto", color: COLORS.textMuted, fontSize: 13, fontWeight: "700" },
  heading: { ...TYPO.display, color: COLORS.text, fontSize: 24 }, subheading: { color: COLORS.textMuted, fontSize: 13, marginTop: -8 }, videoGrid: { flexDirection: "row", gap: 9, position: "relative" }, videoCard: { flex: 1, minWidth: 0, overflow: "hidden", borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  videoFrame: { width: "100%", aspectRatio: 0.72, backgroundColor: "#09090B", justifyContent: "center", alignItems: "center", overflow: "hidden" }, waiting: { position: "absolute", alignItems: "center", gap: 8 }, waitingText: { color: COLORS.textMuted, fontSize: 10, textAlign: "center" }, selfTag: { position: "absolute", top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.7)" }, selfTagText: { color: COLORS.primary, fontSize: 9, fontWeight: "900" },
  videoMeta: { paddingHorizontal: 8, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 3 }, playerLabel: { flex: 1, color: COLORS.text, fontWeight: "800", fontSize: 11 }, videoCount: { color: COLORS.primary, fontWeight: "900", fontSize: 14 }, leaderCount: { color: "#FACC15" }, videoTarget: { color: COLORS.textMuted, fontSize: 9, fontWeight: "600" }, miniTrack: { height: 4, margin: 9, borderRadius: 4, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.09)" }, miniFill: { height: "100%", borderRadius: 4 },
  reactionFloat: { position: "absolute", right: 12, bottom: 34, gap: 4 }, reaction: { fontSize: 26 }, progressCard: { padding: 15, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, gap: 12 }, progressHeading: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }, progressTitle: { color: COLORS.text, fontWeight: "900", letterSpacing: 1, fontSize: 12 }, targetLabel: { color: COLORS.textMuted, fontSize: 11 }, lane: { gap: 6 }, laneTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, laneName: { flex: 1, color: COLORS.text, fontWeight: "700", fontSize: 12 }, laneCount: { color: COLORS.text, fontWeight: "900", fontSize: 14 }, laneTarget: { color: COLORS.textMuted, fontWeight: "500", fontSize: 11 }, track: { height: 9, borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)" }, fill: { height: "100%", borderRadius: 8 }, leaderText: { color: COLORS.primary, fontSize: 13, fontWeight: "900" }, note: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16 },
  officialBox: { borderWidth: 1, borderColor: "rgba(34,197,94,0.35)", borderRadius: 12, padding: 12, gap: 5 }, officialLabel: { color: COLORS.success, fontSize: 10, fontWeight: "900" }, officialScore: { color: COLORS.text, fontSize: 24, fontWeight: "900" }, cameraJudgeCard: { padding: 15, borderRadius: 15, borderWidth: 1, borderColor: "rgba(212,175,55,0.35)", backgroundColor: "rgba(212,175,55,0.07)", gap: 10 }, cameraJudgeTitle: { color: COLORS.primary, fontSize: 12, fontWeight: "900", letterSpacing: 0.7 }, repButton: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 13, backgroundColor: COLORS.primary }, repButtonText: { color: COLORS.background, fontSize: 14, fontWeight: "900" },
  reviewRow: { flexDirection: "row", alignItems: "center", gap: 8 }, reviewInput: { minWidth: 0, flex: 1, minHeight: 46, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, paddingHorizontal: 10, color: COLORS.text, textAlign: "center" }, reviewDash: { color: COLORS.primary, fontWeight: "900" }, reviewNote: { minHeight: 46, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, paddingHorizontal: 12, color: COLORS.text }, reactionRow: { flexDirection: "row", justifyContent: "center", gap: 12 }, reactionButton: { width: 52, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border }, reactionButtonText: { fontSize: 24 }, error: { color: "#F87171", fontSize: 13, textAlign: "center", lineHeight: 18 }, help: { color: COLORS.textMuted, fontSize: 12, textAlign: "center", lineHeight: 18 }, action: { minHeight: 46, borderRadius: 12, backgroundColor: COLORS.primary, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" }, actionText: { color: COLORS.background, fontWeight: "900" },
});
