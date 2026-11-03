import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Room, RoomEvent, Track } from "livekit-client";
import { useRoute } from "@react-navigation/native";
import { FontAwesome5 } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import UserAvatar from "../components/UserAvatar";
import { COLORS, TYPO } from "../theme";
import { supabase } from "../supabase";

type EventRow = {
  id: string;
  slug: string;
  status: string;
  format_key: string;
  player_a: string;
  player_b: string;
  scheduled_at: string | null;
};
type PlayerScore = { event_id: string; user_id: string; repetitions: number; updated_at: string };
type PlayerCard = { pseudo: string | null; avatar_url: string | null };
type OfficialResult = { event_id: string; score_a: number; score_b: number; note: string | null };

const TARGETS: Record<string, number> = { pushups_60s: 60, pullups_max: 10 };
const REACTIONS = ["🔥", "💪", "👏", "😂"];

function mountVideo(container: HTMLDivElement | null, track?: any, mirror = false) {
  if (!container || !track) return;
  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.muted = mirror;
  video.style.width = "100%";
  video.style.height = "100%";
  video.style.objectFit = "cover";
  video.style.transform = mirror ? "scaleX(-1)" : "none";
  track.attach(video);
  container.replaceChildren(video);
  video.play().catch(() => undefined);
}

export default function DuelLiveScreen({ navigation }: any) {
  const route = useRoute<any>();
  const eventId = String(route.params?.eventId ?? "");
  const localVideo = useRef<HTMLDivElement | null>(null);
  const playerAVideo = useRef<HTMLDivElement | null>(null);
  const playerBVideo = useRef<HTMLDivElement | null>(null);
  const audioContainer = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [scores, setScores] = useState<Record<string, PlayerScore>>({});
  const [players, setPlayers] = useState<Record<string, PlayerCard>>({});
  const [uid, setUid] = useState<string | null>(null);
  const [isPlayer, setIsPlayer] = useState(false);
  const [connected, setConnected] = useState(false);
  const [videoReady, setVideoReady] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [roomCount, setRoomCount] = useState(1);
  const [reactions, setReactions] = useState<Array<{ id: number; emoji: string }>>([]);
  const [busyRep, setBusyRep] = useState(false);
  const [moderator, setModerator] = useState(false);
  const [officialResult, setOfficialResult] = useState<OfficialResult | null>(null);
  const [reviewA, setReviewA] = useState("");
  const [reviewB, setReviewB] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

  const loadScores = useCallback(async () => {
    if (!eventId) return;
    const { data } = await supabase.from("duel_live_scores").select("event_id,user_id,repetitions,updated_at").eq("event_id", eventId);
    setScores(Object.fromEntries(((data ?? []) as PlayerScore[]).map((score) => [score.user_id, score])));
  }, [eventId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!eventId) { setMessage("Duel introuvable."); setLoading(false); return; }
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
      const { data: moderatorFlag } = await supabase.rpc("is_moderator");
      if (alive) setModerator(moderatorFlag === true);
      const participant = userId === duel.player_a || userId === duel.player_b;
      setEvent(duel);
      setIsPlayer(participant);
      const { data: profiles } = await supabase.from("profiles").select("user_id,pseudo,avatar_url").in("user_id", [duel.player_a, duel.player_b]);
      if (alive) setPlayers(Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, { pseudo: p.pseudo, avatar_url: p.avatar_url }])));
      if (duel.status !== "live" && !(duel.status === "scheduled" && participant)) {
        if (alive) setMessage("Le duel n’est pas encore en direct.");
        setLoading(false);
        return;
      }
      await loadScores();
      if (!alive) return;
      const { data: finalResult } = await supabase.from("duel_live_results").select("event_id,score_a,score_b,note").eq("event_id", eventId).maybeSingle();
      if (finalResult && alive) setOfficialResult(finalResult as OfficialResult);

      const { data: tokenData, error: tokenError } = await supabase.functions.invoke("duel-live-token", { body: { event_id: eventId } });
      if (tokenError || !tokenData?.server_url || !tokenData?.participant_token) {
        setMessage(tokenData?.error === "live_video_not_configured" ? "La vidéo live n’est pas encore configurée." : "Connexion vidéo impossible. Réessaie dans un instant.");
        setLoading(false);
        return;
      }

      if (duel.status === "scheduled" && participant) {
        const { error: startError } = await supabase.rpc("start_duel_live", { p_event_id: eventId });
        if (startError) {
          if (alive) setMessage(startError.message.includes("outside_live_window") ? "Le live ouvrira 30 minutes avant l’heure prévue." : "Impossible de démarrer ce duel.");
          setLoading(false);
          return;
        }
        duel.status = "live";
        if (alive) setEvent({ ...duel });
      }

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
        if (track.kind === Track.Kind.Video) {
          const container = participant.identity === duel.player_a ? playerAVideo.current : participant.identity === duel.player_b ? playerBVideo.current : null;
          mountVideo(container, track, false);
          if (participant.identity === duel.player_a || participant.identity === duel.player_b) setVideoReady((current) => ({ ...current, [participant.identity]: true }));
        } else if (track.kind === Track.Kind.Audio && audioContainer.current) {
          const audio = document.createElement("audio");
          audio.autoplay = true;
          audioContainer.current.appendChild(track.attach(audio));
          audio.play().catch(() => undefined);
        }
        setRoomCount(room.remoteParticipants.size + 1);
      });
      room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
        track.detach().forEach((element) => element.remove());
        if (track.kind === Track.Kind.Video && (participant.identity === duel.player_a || participant.identity === duel.player_b)) {
          setVideoReady((current) => ({ ...current, [participant.identity]: false }));
        }
        const container = participant.identity === duel.player_a ? playerAVideo.current : participant.identity === duel.player_b ? playerBVideo.current : null;
        if (container && [...room.remoteParticipants.values()].every((p) => p.identity !== participant.identity)) {
          container.replaceChildren();
          setVideoReady((current) => ({ ...current, [participant.identity]: false }));
        }
      });
      room.on(RoomEvent.ParticipantConnected, () => setRoomCount(room.remoteParticipants.size + 1));
      room.on(RoomEvent.ParticipantDisconnected, () => setRoomCount(Math.max(1, room.remoteParticipants.size + 1)));
      room.on(RoomEvent.LocalTrackPublished, (publication) => {
        if (publication.track?.kind === Track.Kind.Video) {
          mountVideo(localVideo.current, publication.track, true);
          if (uid === duel.player_a || uid === duel.player_b) setVideoReady((current) => ({ ...current, [uid]: true }));
        }
      });
      room.on(RoomEvent.DataReceived, (payload) => {
        try {
          const emoji = new TextDecoder().decode(payload);
          if (!REACTIONS.includes(emoji)) return;
          setReactions((current) => [...current.slice(-5), { id: Date.now() + Math.random(), emoji }]);
          setTimeout(() => setReactions((current) => current.slice(1)), 2200);
        } catch { /* Ignore non-reaction data packets. */ }
      });
      try {
        await room.connect(tokenData.server_url, tokenData.participant_token);
        if (participant) {
          await room.localParticipant.setCameraEnabled(true);
          await room.localParticipant.setMicrophoneEnabled(true);
          const camera = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
          if (camera) mountVideo(localVideo.current, camera, true);
        }
        setConnected(true);
        setRoomCount(room.remoteParticipants.size + 1);
        setLoading(false);
      } catch (connectionError) {
        const denied = connectionError instanceof DOMException && connectionError.name === "NotAllowedError";
        setMessage(denied ? "Autorise la caméra et le micro dans ton navigateur, puis recharge le live." : "La connexion vidéo a échoué. Vérifie ton réseau et réessaie.");
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
      if (localVideo.current) localVideo.current.replaceChildren();
      if (playerAVideo.current) playerAVideo.current.replaceChildren();
      if (playerBVideo.current) playerBVideo.current.replaceChildren();
      if (audioContainer.current) audioContainer.current.replaceChildren();
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [eventId, loadScores]);

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase.channel(`duel-live-scores-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "duel_live_scores", filter: `event_id=eq.${eventId}` }, (payload: any) => {
        const score = (payload.new ?? payload.old) as PlayerScore;
        if (score?.user_id) setScores((current) => ({ ...current, [score.user_id]: score }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "duel_live_results", filter: `event_id=eq.${eventId}` }, (payload: any) => {
        setOfficialResult(payload.new as OfficialResult);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "duel_events", filter: `id=eq.${eventId}` }, (payload: any) => {
        setEvent((current) => current ? { ...current, status: payload.new.status } : current);
        if (payload.new.status === "finished" && payload.new.slug) {
          supabase.rpc("get_public_event", { p_slug: payload.new.slug }).then(({ data }) => {
            if (data?.result) setOfficialResult({ event_id: eventId, score_a: data.result.score_a, score_b: data.result.score_b, note: null });
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  useEffect(() => {
    if (event?.status !== "finished") return;
    roomRef.current?.disconnect();
    roomRef.current = null;
    localVideo.current?.replaceChildren();
    playerAVideo.current?.replaceChildren();
    playerBVideo.current?.replaceChildren();
    audioContainer.current?.replaceChildren();
    setConnected(false);
    setRoomCount(0);
  }, [event?.status]);

  useEffect(() => {
    if (loading || !connected || !event) return;
    const timer = setTimeout(() => {
      const room = roomRef.current;
      if (!room) return;
      const localCamera = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
      if (localCamera) {
        mountVideo(localVideo.current, localCamera, true);
        if (uid === event.player_a || uid === event.player_b) setVideoReady((current) => ({ ...current, [uid]: true }));
      }
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => {
          if (publication.track?.kind !== Track.Kind.Video) return;
          const container = participant.identity === event.player_a ? playerAVideo.current : participant.identity === event.player_b ? playerBVideo.current : null;
          mountVideo(container, publication.track, false);
          if (participant.identity === event.player_a || participant.identity === event.player_b) setVideoReady((current) => ({ ...current, [participant.identity]: true }));
        });
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [loading, connected, event?.id, uid]);

  const target = TARGETS[event?.format_key ?? ""] ?? 60;
  const countFor = (playerId?: string) => scores[playerId ?? ""]?.repetitions ?? 0;
  const leaders = useMemo(() => {
    if (!event) return [] as string[];
    const a = countFor(event.player_a), b = countFor(event.player_b);
    return a === b ? [] : [a > b ? event.player_a : event.player_b];
  }, [event, scores]);

  const addRep = async () => {
    if (!event || !isPlayer || busyRep) return;
    setBusyRep(true);
    const { data, error } = await supabase.rpc("increment_duel_live_rep", { p_event_id: event.id });
    setBusyRep(false);
    if (error) {
      setMessage("Répétition non ajoutée. Attends un instant et réessaie.");
      return;
    }
    setScores((current) => ({ ...current, [uid!]: { event_id: event.id, user_id: uid!, repetitions: Number(data), updated_at: new Date().toISOString() } }));
  };

  const sendReaction = async (emoji: string) => {
    const room = roomRef.current;
    if (!room || !connected) return;
    await room.localParticipant.publishData(new TextEncoder().encode(emoji), { reliable: true });
    setReactions((current) => [...current.slice(-5), { id: Date.now() + Math.random(), emoji }]);
    setTimeout(() => setReactions((current) => current.slice(1)), 2200);
  };

  const finalizeHumanScore = async () => {
    if (!event || reviewBusy || !/^\d{1,3}$/.test(reviewA) || !/^\d{1,3}$/.test(reviewB)) {
      setMessage("Saisis les répétitions retenues pour les deux joueurs (0 à 200).");
      return;
    }
    const scoreA = Number(reviewA), scoreB = Number(reviewB);
    if (scoreA > 200 || scoreB > 200) {
      setMessage("Le score doit être compris entre 0 et 200 répétitions.");
      return;
    }
    setReviewBusy(true);
    const { error } = await supabase.rpc("moderate_live_duel", {
      p_event_id: event.id,
      p_score_a: scoreA,
      p_score_b: scoreB,
      p_note: reviewNote.trim() || null,
    });
    setReviewBusy(false);
    if (error) {
      setMessage("La validation n’a pas abouti. Vérifie les scores et réessaie.");
      return;
    }
    setOfficialResult({ event_id: event.id, score_a: scoreA, score_b: scoreB, note: reviewNote.trim() || null });
    setMessage(null);
  };

  if (loading) return <ScreenContainer><View style={styles.center}><ActivityIndicator color={COLORS.primary} /><Text style={styles.help}>Connexion à l’arène…</Text></View></ScreenContainer>;
  if (!event || message && !connected) return <ScreenContainer><View style={styles.center}><Text style={styles.error}>{message ?? "Live indisponible."}</Text><Pressable onPress={() => navigation.goBack()} style={styles.action}><Text style={styles.actionText}>Retour au duel</Text></Pressable></View></ScreenContainer>;

  const a = players[event.player_a] ?? { pseudo: "Joueur 1", avatar_url: null };
  const b = players[event.player_b] ?? { pseudo: "Joueur 2", avatar_url: null };
  const p1 = countFor(event.player_a);
  const p2 = countFor(event.player_b);
  const myScore = uid ? countFor(uid) : 0;
  const myName = uid === event.player_a ? a.pseudo : b.pseudo;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <View style={styles.topline}>
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Retour" style={styles.back}><FontAwesome5 name="arrow-left" size={14} color={COLORS.text} /></Pressable>
          <View style={event.status === "live" ? styles.liveTag : styles.finishedTag}>{event.status === "live" ? <View style={styles.dot} /> : null}<Text style={event.status === "live" ? styles.liveText : styles.finishedText}>{event.status === "live" ? "EN DIRECT" : "TERMINÉ"}</Text></View>
          <Text style={styles.viewers}><FontAwesome5 name="eye" size={12} color={COLORS.textMuted} />  {roomCount}</Text>
        </View>
        <View ref={audioContainer as any} style={styles.hiddenAudio} />
        <Text style={styles.heading}>Le duel est lancé</Text>
        <Text style={styles.subheading}>{event.format_key === "pushups_60s" ? "Pompes" : "Tractions"} · les répétitions affichées sont provisoires</Text>

        <View style={styles.videoGrid}>
          <VideoCard label={a.pseudo ?? "Joueur 1"} avatar={a.avatar_url} count={p1} target={target} leader={leaders.includes(event.player_a)} ready={videoReady[event.player_a] ?? false} videoRef={uid === event.player_a ? localVideo : playerAVideo} />
          <VideoCard label={b.pseudo ?? "Joueur 2"} avatar={b.avatar_url} count={p2} target={target} leader={leaders.includes(event.player_b)} ready={videoReady[event.player_b] ?? false} videoRef={uid === event.player_b ? localVideo : playerBVideo} />
          <View pointerEvents="none" style={styles.reactionFloat}>{reactions.slice(-3).map((item) => <Text key={item.id} style={styles.reaction}>{item.emoji}</Text>)}</View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeading}><Text style={styles.progressTitle}>LA COURSE</Text><Text style={styles.targetLabel}>Repère : {target} reps</Text></View>
          <ProgressLane name={a.pseudo ?? "Joueur 1"} count={p1} target={target} color="#D7A72F" />
          <ProgressLane name={b.pseudo ?? "Joueur 2"} count={p2} target={target} color="#38BDF8" />
          <Text style={styles.leaderText}>{p1 === p2 ? "À égalité" : `${p1 > p2 ? a.pseudo ?? "Joueur 1" : b.pseudo ?? "Joueur 2"} mène provisoirement`}</Text>
          {officialResult ? (
            <View style={styles.officialBox}>
              <Text style={styles.officialLabel}>RÉSULTAT VALIDÉ PAR UN MODÉRATEUR</Text>
              <Text style={styles.officialScore}>{officialResult.score_a} — {officialResult.score_b}</Text>
              {officialResult.note ? <Text style={styles.note}>{officialResult.note}</Text> : null}
            </View>
          ) : <Text style={styles.note}>Le premier arrivé au repère ne gagne pas automatiquement : le résultat devient officiel après validation humaine.</Text>}
        </View>

        {moderator && event.status === "live" && !officialResult ? (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>VALIDER LE DUEL EN DIRECT</Text>
            <Text style={styles.note}>Après avoir regardé les deux flux, saisis les répétitions complètes retenues. Cette décision fixe le résultat officiel.</Text>
            <View style={styles.reviewRow}>
              <TextInput value={reviewA} onChangeText={setReviewA} keyboardType="number-pad" placeholder={`${a.pseudo ?? "Joueur 1"}`} placeholderTextColor={COLORS.textMuted} accessibilityLabel={`Score validé de ${a.pseudo ?? "joueur 1"}`} style={styles.reviewInput} />
              <Text style={styles.reviewDash}>—</Text>
              <TextInput value={reviewB} onChangeText={setReviewB} keyboardType="number-pad" placeholder={`${b.pseudo ?? "Joueur 2"}`} placeholderTextColor={COLORS.textMuted} accessibilityLabel={`Score validé de ${b.pseudo ?? "joueur 2"}`} style={styles.reviewInput} />
            </View>
            <TextInput value={reviewNote} onChangeText={setReviewNote} placeholder="Note facultative" placeholderTextColor={COLORS.textMuted} maxLength={500} style={styles.reviewNote} />
            <Pressable onPress={finalizeHumanScore} disabled={reviewBusy} accessibilityRole="button" style={[styles.repButton, reviewBusy ? { opacity: 0.65 } : null]}>
              <Text style={styles.repButtonText}>{reviewBusy ? "Validation…" : "Valider le résultat"}</Text>
            </Pressable>
          </View>
        ) : null}

        {isPlayer && event.status === "live" && !officialResult ? (
          <Pressable onPress={addRep} disabled={busyRep} accessibilityRole="button" accessibilityLabel="Ajouter une répétition provisoire" style={[styles.repButton, busyRep ? { opacity: 0.65 } : null]}>
            <FontAwesome5 name="plus" size={18} color={COLORS.background} /><Text style={styles.repButtonText}>+1 répétition · {myScore}</Text>
          </Pressable>
        ) : event.status === "live" ? <Text style={styles.audienceNote}>{isPlayer ? "Le score officiel est validé." : "Tu regardes le duel. Réagis et encourage les joueurs."}</Text> : null}

        {event.status === "live" ? <View style={styles.reactionRow}>{REACTIONS.map((emoji) => <Pressable key={emoji} onPress={() => sendReaction(emoji)} accessibilityRole="button" accessibilityLabel={`Envoyer ${emoji}`} style={styles.reactionButton}><Text style={styles.reactionButtonText}>{emoji}</Text></Pressable>)}</View> : null}
        {message ? <Text style={styles.error}>{message}</Text> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function VideoCard({ label, avatar, count, target, leader, ready, videoRef }: { label: string; avatar: string | null; count: number; target: number; leader: boolean; ready: boolean; videoRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <View style={styles.videoCard}>
      <View style={styles.videoFrame}>
        <View ref={videoRef as any} style={styles.videoSurface} />
        {!ready ? <View style={styles.waiting}><UserAvatar uri={avatar} label={label} size={42} /><Text style={styles.waitingText}>Caméra en attente…</Text></View> : null}
      </View>
      <View style={styles.videoMeta}><Text numberOfLines={1} style={styles.playerLabel}>{label}</Text><Text style={[styles.videoCount, leader ? styles.leaderCount : null]}>{count} <Text style={styles.videoTarget}>/ {target}</Text></Text></View>
      <View style={styles.miniTrack}><View style={[styles.miniFill, { width: `${Math.min(100, (count / target) * 100)}%`, backgroundColor: leader ? COLORS.primary : "#38BDF8" }]} /></View>
    </View>
  );
}

function ProgressLane({ name, count, target, color }: { name: string; count: number; target: number; color: string }) {
  return <View style={styles.lane}><View style={styles.laneTop}><Text style={styles.laneName} numberOfLines={1}>{name}</Text><Text style={styles.laneCount}>{count}<Text style={styles.laneTarget}> / {target}</Text></Text></View><View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, (count / target) * 100)}%`, backgroundColor: color }]} /></View></View>;
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 100, gap: 14 },
  center: { flex: 1, minHeight: 400, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  topline: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.card, alignItems: "center", justifyContent: "center" },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(239,68,68,0.14)", borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7 },
  finishedTag: { borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: "rgba(34,197,94,0.12)" },
  finishedText: { color: COLORS.success, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF4444" },
  liveText: { color: "#F87171", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  viewers: { marginLeft: "auto", color: COLORS.textMuted, fontSize: 13, fontWeight: "700" },
  heading: { ...TYPO.display, color: COLORS.text, fontSize: 25 },
  subheading: { color: COLORS.textMuted, fontSize: 13, marginTop: -8 },
  videoGrid: { flexDirection: "row", gap: 10, position: "relative" },
  videoCard: { flex: 1, minWidth: 0, overflow: "hidden", borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  videoFrame: { width: "100%", aspectRatio: 0.82, backgroundColor: "#09090B", justifyContent: "center", alignItems: "center", overflow: "hidden" },
  videoSurface: { width: "100%", height: "100%", position: "absolute", top: 0, left: 0 } as any,
  hiddenAudio: { width: 0, height: 0, overflow: "hidden" },
  waiting: { position: "absolute", alignItems: "center", gap: 8 },
  waitingText: { color: COLORS.textMuted, fontSize: 10 },
  videoMeta: { paddingHorizontal: 10, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  playerLabel: { flex: 1, color: COLORS.text, fontWeight: "800", fontSize: 12 },
  videoCount: { color: COLORS.primary, fontWeight: "900", fontSize: 16 },
  leaderCount: { color: "#FACC15" },
  videoTarget: { color: COLORS.textMuted, fontSize: 10, fontWeight: "600" },
  miniTrack: { height: 4, margin: 10, borderRadius: 4, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.09)" },
  miniFill: { height: "100%", borderRadius: 4 },
  reactionFloat: { position: "absolute", right: 18, bottom: 38, gap: 4 },
  reaction: { fontSize: 28 },
  progressCard: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, gap: 12 },
  progressHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressTitle: { color: COLORS.text, fontWeight: "900", letterSpacing: 1, fontSize: 12 },
  targetLabel: { color: COLORS.textMuted, fontSize: 11 },
  lane: { gap: 6 },
  laneTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  laneName: { flex: 1, color: COLORS.text, fontWeight: "700", fontSize: 12 },
  laneCount: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
  laneTarget: { color: COLORS.textMuted, fontWeight: "500", fontSize: 11 },
  track: { height: 9, borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)" },
  fill: { height: "100%", borderRadius: 8 },
  leaderText: { color: COLORS.primary, fontSize: 13, fontWeight: "900" },
  note: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16 },
  repButton: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, backgroundColor: COLORS.primary },
  repButtonText: { color: COLORS.background, fontWeight: "900", fontSize: 15 },
  audienceNote: { textAlign: "center", color: COLORS.textMuted, fontSize: 12 },
  reviewRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewInput: { flex: 1, minWidth: 0, color: COLORS.text, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, textAlign: "center", fontWeight: "800" },
  reviewDash: { color: COLORS.primary, fontWeight: "900", fontSize: 18 },
  reviewNote: { color: COLORS.text, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  officialBox: { alignItems: "center", gap: 5, padding: 12, borderRadius: 12, backgroundColor: "rgba(34,197,94,0.08)", borderWidth: 1, borderColor: "rgba(34,197,94,0.35)" },
  officialLabel: { color: COLORS.success, fontSize: 10, fontWeight: "900", letterSpacing: 0.7, textAlign: "center" },
  officialScore: { color: COLORS.text, fontSize: 25, fontWeight: "900" },
  reactionRow: { flexDirection: "row", justifyContent: "center", gap: 12 },
  reactionButton: { width: 48, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  reactionButtonText: { fontSize: 21 },
  help: { color: COLORS.textMuted, fontSize: 13 },
  error: { color: "#FCA5A5", fontSize: 13, lineHeight: 19, textAlign: "center" },
  action: { minHeight: 44, paddingHorizontal: 18, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary },
  actionText: { color: COLORS.background, fontSize: 13, fontWeight: "800" },
});
