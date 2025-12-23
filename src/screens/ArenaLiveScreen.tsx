// src/screens/ArenaLiveScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity, StyleSheet } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import AppButton from "../components/AppButton";
import { supabase } from "../supabase";
import { COLORS, getSportPalette } from "../theme";
import { Challenge } from "../types";
import SportTag from "../components/SportTag";
import {
  createArenaRoom,
  joinArenaRoom,
  ArenaRoom,
  ARENA_FAIR_PLAY_THRESHOLD,
  sendSignal,
} from "../services/arenaLive";
import FairPlayAlert from "../components/FairPlayAlert";
import { getFairPlayTier } from "../utils/fairPlay";
import { useIsFocused } from "@react-navigation/native";
import { logNotification } from "../notifications";
import { SPACING } from "../utils/layout";
import { loadCameraModule } from "../utils/cameraCompat";
import { useSportTheme } from "../context/SportThemeContext";
// Load WebRTC dynamically (avoid bundling native-only modules into Expo Go)
// We'll import `react-native-webrtc` at runtime when needed.

type Props = {
  route: {
    params: {
      challengeId: number;
      mode?: "live" | "simulation";
      role?: "host" | "guest";
      roomId?: string;
    };
  };
  navigation: any;
};

const MIN_LEVEL = 5;
const PYRAMID_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const LIVE_PREP_STEPS = [
  "Permissions camera/micro accordees.",
  "Signal Arena connecte (room active).",
  "Flux WebRTC pret (camera locale + remote).",
  "Fair-play / ping verifies avant pyramide.",
];

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export default function ArenaLiveScreen({ route, navigation }: Props) {
  const { challengeId, mode = "live", role = "host", roomId } = route.params;
  const { logSportSession } = useSportTheme();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [sessionStatus, setSessionStatus] = useState<
    "idle" | "connecting" | "live"
  >("idle");
  const [room, setRoom] = useState<ArenaRoom | null>(null);
  const [signalLog, setSignalLog] = useState<string[]>([]);
  const liveTimer = useRef<NodeJS.Timeout | null>(null);
  const isHost = role === "host";
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [playerStats, setPlayerStats] = useState<{
    level: number;
    fair_play_score: number;
    points?: number;
  } | null>(null);
  const [livePrepStatus, setLivePrepStatus] = useState(
    LIVE_PREP_STEPS.map(() => false)
  );
  const [cameraModule, setCameraModule] =
    useState<any | null>(null);
  const [cameraLoadError, setCameraLoadError] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [hasMicroPermission, setHasMicroPermission] = useState(false);
  const [roomChannel, setRoomChannel] = useState<
    ReturnType<typeof supabase.channel> | null
  >(null);
  const isFocused = useIsFocused();
  const sessionStatusRef = useRef<"idle" | "connecting" | "live">("idle");
  const [localStream, setLocalStream] = useState<any | null>(null);
  const [remoteStream, setRemoteStream] = useState<any | null>(null);
  const [webRtcError, setWebRtcError] = useState<string | null>(null);
  const [rtcModule, setRtcModule] = useState<any | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const hasSentOfferRef = useRef(false);
  const peerConnectionRef = useRef<any | null>(null);
  const updatePrepStep = useCallback((index: number, value: boolean) => {
    setLivePrepStatus((prev) =>
      prev.map((val, idx) => (idx === index ? value : val))
    );
  }, []);

  const ensurePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }
    const RTCPeerConnectionClass = rtcModule?.RTCPeerConnection;
    if (!RTCPeerConnectionClass) {
      console.warn("WebRTC not available yet");
      return null as any;
    }
    const pc = new RTCPeerConnectionClass({ iceServers: ICE_SERVERS });
    (pc as any).onicecandidate = (event: any) => {
      if (event.candidate && roomIdRef.current) {
        void sendSignal(roomIdRef.current, "candidate", event.candidate).catch(
          (err) => {
            console.log("ARENA ICE ERROR", err);
          }
        );
      }
    };
    (pc as any).ontrack = (event: any) => {
      const [stream] = event.streams;
      if (stream) {
        setRemoteStream(stream);
      }
    };
    peerConnectionRef.current = pc;
    return pc;
  }, []);

  const disposePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      const pc: any = peerConnectionRef.current;
      try {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.close();
      } catch (e) {
        // ignore
      }
      peerConnectionRef.current = null;
    }
  }, []);

  type ArenaSignalPayload = {
    type: "offer" | "answer" | "candidate" | "data";
    payload: any;
    sender_id: string;
  };

  const processRealtimeSignal = useCallback(
    async (signal: ArenaSignalPayload) => {
      if (!room?.id || signal.sender_id === currentUserId) {
        return;
      }
      if (signal.type === "data") {
        return;
      }
      const pc = ensurePeerConnection();
      if (!pc) return;
      try {
        if (signal.type === "offer" && !isHost) {
          const RTCSessionDescriptionClass = rtcModule?.RTCSessionDescription;
          if (!RTCSessionDescriptionClass) {
            console.warn("RTCSessionDescription unavailable");
            return;
          }
          await pc.setRemoteDescription(
            new RTCSessionDescriptionClass(signal.payload)
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(room.id, "answer", answer);
          setSignalLog((prev) => [
            "Réponse envoyée vers l'offre distante.",
            ...prev,
          ]);
        } else if (signal.type === "answer" && isHost) {
          const RTCSessionDescriptionClass = rtcModule?.RTCSessionDescription;
          if (!RTCSessionDescriptionClass) {
            console.warn("RTCSessionDescription unavailable");
            return;
          }
          await pc.setRemoteDescription(
            new RTCSessionDescriptionClass(signal.payload)
          );
          setSignalLog((prev) => ["Réponse reçue, flux synchronisé.", ...prev]);
        } else if (signal.type === "candidate") {
          if (signal.payload) {
            const RTCIceCandidateClass = rtcModule?.RTCIceCandidate;
            if (RTCIceCandidateClass) {
              await pc.addIceCandidate(new RTCIceCandidateClass(signal.payload));
            } else {
              console.warn("RTCIceCandidate unavailable");
            }
          }
        }
      } catch (error) {
        console.log("ARENA SIGNAL ERROR", error);
        setWebRtcError(
          "Erreur de signalisation. Relance la salle pour reprendre le flux."
        );
      }
    },
    [currentUserId, ensurePeerConnection, isHost, room?.id, rtcModule]
  );

  const startHostNegotiation = useCallback(async () => {
    if (!isHost || !room?.id || !localStream || hasSentOfferRef.current) {
      return;
    }
    try {
      const pc = ensurePeerConnection();
      if (!pc) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(room.id, "offer", offer);
      hasSentOfferRef.current = true;
      setSignalLog((prev) => ["Offre envoyée au guest.", ...prev]);
    } catch (error) {
      console.log("ARENA OFFER ERROR", error);
      hasSentOfferRef.current = false;
      setWebRtcError("Impossible de démarrer le flux Arena Live.");
    }
  }, [ensurePeerConnection, isHost, localStream, room?.id]);

  const logActivity = useCallback(
    async (type: string, message: string) => {
      if (!currentUserId) return;
      await supabase.from("activities").insert({
        user_id: currentUserId,
        type,
        message,
        challenge_id: challengeId,
      });
    },
    [currentUserId, challengeId]
  );

  useEffect(() => {
    const fetchChallenge = async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", challengeId)
        .maybeSingle();
      if (!error && data) setChallenge(data as Challenge);
    };
    fetchChallenge();
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id || null;
      setCurrentUserId(uid);
      if (uid) {
        supabase
          .from("players_stats")
          .select("level, fair_play_score, points")
          .eq("user_id", uid)
          .maybeSingle()
          .then(({ data: stats }) => {
            if (stats) {
              setPlayerStats(stats as any);
            }
          });
      }
    });
  }, [challengeId]);

  useEffect(() => {
    let mounted = true;
    // Ne charger la caméra que en mode "live", pas en simulation
    if (mode === "simulation") {
      console.log("Simulation mode detected - skipping camera module load");
      return;
    }
    (async () => {
      try {
        const mod = await loadCameraModule();
        if (mounted) {
          setCameraModule(mod);
        }
      } catch (error) {
        console.warn("Camera module error (normal in dev)", error);
        if (mounted) {
          setCameraLoadError(
            "Mode simulation activé (sans caméra native)"
          );
        }
      }

      // Charger react-native-webrtc dynamiquement
      try {
        const rtc = await import("react-native-webrtc");
        if (mounted) {
          setRtcModule(rtc);
        }
      } catch (err) {
        console.warn("react-native-webrtc not available in Expo Go (expected):", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [mode]);

  const requestPermissions = useCallback(async () => {
    if (!cameraModule) {
      // Fallback: Simulation mode sans caméra
      setHasCameraPermission(true);
      setHasMicroPermission(true);
      console.log("Camera unavailable, using simulation mode");
      return;
    }
    try {
      const { Camera } = cameraModule;
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(status === "granted");
      const { status: micStatus } =
        await Camera.requestMicrophonePermissionsAsync();
      setHasMicroPermission(micStatus === "granted");
    } catch (error) {
      console.warn("Permission request error", error);
      // Fallback: Allow simulation without camera
      setHasCameraPermission(true);
      setHasMicroPermission(true);
    }
  }, [cameraModule]);

  const prepareLocalStream = useCallback(async () => {
    if (localStream) {
      return;
    }
    try {
      const mediaDevicesAPI = rtcModule?.mediaDevices;
      if (!mediaDevicesAPI) {
        console.warn("mediaDevices API not available");
        return;
      }
      const stream = await mediaDevicesAPI.getUserMedia({
        video: {
          facingMode: "user",
        },
        audio: true,
      });
      const pc = ensurePeerConnection();
      const existingTracks = pc.getSenders().map((sender: any) => sender.track?.id);
      stream.getTracks().forEach((track: any) => {
        if (!existingTracks.includes(track.id)) {
          pc.addTrack(track, stream);
        }
      });
      setLocalStream(stream);
      setWebRtcError(null);
    } catch (error) {
      console.log("ARENA STREAM ERROR", error);
      // En dev/simulation, permettre de continuer sans stream
      if (process.env.NODE_ENV === "development" || !cameraModule) {
        console.log("Simulation mode: continuing without camera stream");
        setLocalStream(null);
        setWebRtcError(null);
      } else {
        setWebRtcError(
          "Impossible d'initialiser la camera/micro. Verifie les autorisations."
        );
      }
    }
  }, [ensurePeerConnection, localStream, cameraModule]);

  useEffect(() => {
    // En mode simulation, ne pas charger les permissions
    if (mode === "simulation") {
      setHasCameraPermission(true);
      setHasMicroPermission(true);
      return;
    }
    if (cameraModule) {
      requestPermissions();
    }
  }, [mode, cameraModule, requestPermissions]);

  useEffect(() => {
    // En mode simulation, ne pas charger le stream
    if (mode === "simulation") {
      return;
    }
    if (
      hasCameraPermission &&
      hasMicroPermission &&
      isFocused
    ) {
      void prepareLocalStream();
    }
  }, [mode, hasCameraPermission, hasMicroPermission, isFocused, prepareLocalStream]);

  useEffect(() => {
    if (localStream && room?.id && isHost) {
      void startHostNegotiation();
    }
  }, [isHost, localStream, room?.id, startHostNegotiation]);

  useEffect(() => {
    if (localStream) {
      updatePrepStep(2, true);
    }
  }, [localStream, updatePrepStep]);

  useEffect(() => {
    if (remoteStream) {
      setSignalLog((prev) => ["Flux distant connecté.", ...prev]);
    }
  }, [remoteStream]);

  useEffect(() => {
    if (hasCameraPermission && hasMicroPermission) {
      updatePrepStep(0, true);
    }
  }, [hasCameraPermission, hasMicroPermission, updatePrepStep]);

  useEffect(() => {
    if (!room?.id) {
      roomIdRef.current = null;
      if (roomChannel) {
        supabase.removeChannel(roomChannel);
        setRoomChannel(null);
      }
      return;
    }
    roomIdRef.current = room.id;
    const channel = supabase
      .channel(`arena-room-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "arena_signals",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const inserted = payload.new as any;
          setSignalLog((prev) => [
            `[${inserted.type}] ${inserted.sender_id?.slice(0, 6) ?? "anon"} → ${
              inserted.target
            }`,
            ...prev,
          ]);
          void processRealtimeSignal(inserted);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "arena_rooms",
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          const nextStatus = (payload.new as any)?.status;
          if (nextStatus) {
            setSignalLog((prev) => [
              `Status room → ${nextStatus}`,
              ...prev,
            ]);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSignalLog((prev) => [
            `Canal realtime ouvert pour ${room.id}`,
            ...prev,
          ]);
        }
      });
    setRoomChannel(channel);
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, processRealtimeSignal]);

  useEffect(() => {
    if (room?.id) {
      updatePrepStep(1, true);
    }
  }, [room?.id, updatePrepStep]);

  useEffect(() => {
    if ((playerStats?.fair_play_score ?? 100) >= ARENA_FAIR_PLAY_THRESHOLD && sessionStatus === "live") {
      updatePrepStep(3, true);
    }
  }, [playerStats?.fair_play_score, sessionStatus, updatePrepStep]);

  useEffect(() => {
    return () => {
      if (liveTimer.current) {
        clearTimeout(liveTimer.current);
      }
      if (sessionStatus === "live") {
        void logActivity("arena_finished", "Arena Live terminee");
      }
      if (localStream) {
        localStream.getTracks().forEach((track: any) => track.stop());
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach((track: any) => track.stop());
      }
      disposePeerConnection();
    };
  }, [sessionStatus, logActivity, localStream, remoteStream, disposePeerConnection]);

  const updateSessionStatus = useCallback(
    (next: "idle" | "connecting" | "live") => {
      sessionStatusRef.current = next;
      setSessionStatus(next);
    },
    []
  );

  const startSimulationMode = useCallback(
    (customMessage?: string) => {
      if (
        (playerStats?.fair_play_score ?? 100) < ARENA_FAIR_PLAY_THRESHOLD
      ) {
        Alert.alert(
          "Mode verrouille",
          "Ton score de fair-play ne te permet pas d'accéder à cette simulation."
        );
        return;
      }
      if (liveTimer.current) {
        clearTimeout(liveTimer.current);
      }
      updateSessionStatus("connecting");
      liveTimer.current = setTimeout(() => updateSessionStatus("live"), 800);
      void logActivity(
        "arena_live_start",
        customMessage || "Arena Live simulee (mode demo)"
      );
      Alert.alert(
        "Simulation Arena",
        customMessage || "Mode demo lance sans conditions."
      );
    },
    [logActivity, updateSessionStatus, playerStats]
  );

  const handleReport = async () => {
    if (!currentUserId) {
      Alert.alert("Non connecté", "Tu dois être connecté pour signaler.");
      return;
    }
    const targetUserId = isHost
      ? room?.guest_id || null
      : room?.host_id || challenge?.user_id || null;
    if (!targetUserId) {
      Alert.alert(
        "Impossible",
        "Aucun adversaire identifié pour ce report (simulation ?)."
      );
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const reporterPseudo =
      sessionData.session?.user.user_metadata?.pseudo ||
      sessionData.session?.user.email ||
      "Joueur";

    await supabase.from("activities").insert({
      user_id: currentUserId,
      type: "arena_report",
      challenge_id: challengeId,
      message: `${reporterPseudo} a reporté la session Arena.`,
    });
    await logNotification(
      {
        title: "Report Arena",
        body: `Signalement envoyé par ${reporterPseudo}`,
      },
      "coach"
    );

    const { data: targetStats } = await supabase
      .from("players_stats")
      .select("fair_play_score")
      .eq("user_id", targetUserId)
      .maybeSingle();
    const currentScore = (targetStats as any)?.fair_play_score ?? 100;
    const newScore = Math.max(0, currentScore - 5);

    await supabase
      .from("players_stats")
      .update({ fair_play_score: newScore })
      .eq("user_id", targetUserId);

    Alert.alert(
      "Report envoyé",
      "Ton signalement a été pris en compte. L'équipe modérera ça."
    );
  };

  const handleSendTestSignal = async () => {
    if (!room?.id) {
      Alert.alert("Aucune salle", "Crée ou rejoins une salle pour tester.");
      return;
    }
    try {
      await sendSignal(room.id, "data", {
        ping: new Date().toISOString(),
        role: isHost ? "host" : "guest",
      });
      setSignalLog((prev) => [`Test signal envoyé vers ${room.id}`, ...prev]);
    } catch (error: any) {
      Alert.alert(
        "Signalisation",
        error.message || "Impossible d'envoyer le signal."
      );
    }
  };


  const handleCreateLobby = async () => {
    if (sessionStatus !== "idle") return;
    if ((playerStats?.fair_play_score ?? 100) < ARENA_FAIR_PLAY_THRESHOLD) {
      Alert.alert(
        "Accès refusé",
        "Remonte ton score de fair-play pour ouvrir une Arena Live."
      );
      return;
    }
    if (mode === "simulation") {
      startSimulationMode();
      return;
    }

    updateSessionStatus("connecting");
    const fallbackTimer = setTimeout(() => {
      if (sessionStatusRef.current === "connecting") {
        startSimulationMode(
          "Serveur Arena indisponible, passage automatique en mode demo."
        );
      }
    }, 5000);
    try {
      let targetRoom: ArenaRoom;
      if (isHost) {
        targetRoom = await createArenaRoom({
          challengeId,
          stake: challenge?.bet_amount || 0,
        });
        await logNotification(
          {
            title: "Arena Live ouverte",
            body: `Salle ${targetRoom.id} pour défi #${challengeId}`,
          },
          "coach"
        );
      } else {
        if (!roomId) throw new Error("roomId requis pour rejoindre une salle");
        targetRoom = await joinArenaRoom(roomId);
      }
      setRoom(targetRoom);
      hasSentOfferRef.current = false;
      setRemoteStream(null);
      setSignalLog((prev) => [
        ...prev,
        `${isHost ? "Host" : "Guest"} connecte sur room ${targetRoom.id}`,
      ]);
      updateSessionStatus("live");
      if (challenge?.sport) {
        logSportSession({
          sport: challenge.sport,
          kind: "live_start",
          timestamp: new Date().toISOString(),
        });
      }
      void logActivity(
        "arena_live_start",
        "Arena Live demarree (session reelle)"
      );
      Alert.alert("Arena Live", "Connexion etablie. Lance la pyramide !");
    } catch (err: any) {
      console.log("ARENA ROOM ERROR", err);
      startSimulationMode(
        "Signalisation indisponible, mode demo lance automatiquement."
      );
    }
    clearTimeout(fallbackTimer);
  };

  const palette = getSportPalette(challenge?.sport || "");
  const fairPlayScore = playerStats?.fair_play_score ?? 100;
  const isFairPlayLocked = fairPlayScore < ARENA_FAIR_PLAY_THRESHOLD;
  const fairPlayTier = getFairPlayTier(fairPlayScore);

  return (
    <ScreenContainer sport={challenge?.sport || undefined}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            color: palette.text,
            marginBottom: 8,
          }}
        >
          Mode Arena Live
        </Text>
        <Text style={{ color: COLORS.textMuted, marginBottom: 18 }}>
          Defis pyramidaux en direct : IMPITOYABLE uniquement.
        </Text>
        <Text style={{ color: fairPlayTier.color, marginBottom: 12 }}>
          Fair-play tier : {fairPlayTier.label}
        </Text>

        {challenge && (
          <View
            style={{
              borderWidth: 1,
              borderColor: palette.border,
              borderRadius: 18,
              padding: 16,
              marginBottom: 18,
              backgroundColor: palette.card,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: palette.text,
                marginBottom: 6,
              }}
            >
              {challenge.title}
            </Text>
            <SportTag sport={challenge?.sport || ""} />
            <Text
              style={{
                color: palette.text,
                marginTop: 10,
                fontSize: 13,
              }}
            >
              Objectif : {challenge.target_value} {challenge.unit}
            </Text>
          </View>
        )}

        <View
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 18,
            padding: 16,
            marginBottom: 18,
            backgroundColor: COLORS.surface,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: COLORS.text,
              marginBottom: 10,
            }}
          >
            Flux vidéo / audio WebRTC
          </Text>
          {cameraLoadError && (
            <Text style={{ color: COLORS.primary, fontSize: 12, marginBottom: 6 }}>
              ℹ️ {cameraLoadError}
            </Text>
          )}
          {webRtcError && (
            <Text style={{ color: COLORS.danger, fontSize: 12, marginBottom: 6 }}>
              {webRtcError}
            </Text>
          )}
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <View
              style={{
                flex: 1,
                minWidth: 160,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 14,
                padding: 8,
                backgroundColor: "#000",
              }}
            >
              <Text
                style={{
                  color: COLORS.textMuted,
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                Ton flux
              </Text>
              {localStream ? (
                (() => {
                  const RTCViewComp = rtcModule?.RTCView;
                  if (RTCViewComp) {
                    return (
                      <RTCViewComp
                        streamURL={localStream.toURL()}
                        style={{ height: 180, borderRadius: 10 }}
                        objectFit="cover"
                      />
                    );
                  }
                  return (
                    <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
                      Flux local: affichage non supporté en Expo Go.
                    </Text>
                  );
                })()
              ) : (
                <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
                  En attente d'autorisation caméra/micro.
                </Text>
              )}
            </View>
            <View
              style={{
                flex: 1,
                minWidth: 160,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 14,
                padding: 8,
                backgroundColor: "#020617",
              }}
            >
              <Text
                style={{
                  color: COLORS.textMuted,
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                Flux adverse
              </Text>
              {remoteStream ? (
                (() => {
                  const RTCViewComp = rtcModule?.RTCView;
                  if (RTCViewComp) {
                    return (
                      <RTCViewComp
                        streamURL={remoteStream.toURL()}
                        style={{ height: 180, borderRadius: 10 }}
                        objectFit="cover"
                      />
                    );
                  }
                  return (
                    <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
                      Flux distant: affichage non supporté en Expo Go.
                    </Text>
                  );
                })()
              ) : (
                <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
                  En attente de connexion de ton rival.
                </Text>
              )}
            </View>
          </View>
          {!localStream && (
            <AppButton
              label="Autoriser camera"
              variant="ghost"
              onPress={requestPermissions}
              style={{ marginTop: 12 }}
              color={palette.accent}
              textColor={palette.text}
            />
          )}
        </View>
        <View
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 18,
            padding: 16,
            marginBottom: 18,
            backgroundColor: COLORS.surface,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: COLORS.text,
              marginBottom: 8,
            }}
          >
            Live reel - checklist
          </Text>
          {LIVE_PREP_STEPS.map((step, idx) => (
            <TouchableOpacity
              key={step}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 6,
              }}
              onPress={() =>
                setLivePrepStatus((prev) =>
                  prev.map((v, i) => (i === idx ? !v : v))
                )
              }
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: livePrepStatus[idx]
                    ? COLORS.primary
                    : COLORS.border,
                  backgroundColor: livePrepStatus[idx]
                    ? COLORS.primary
                    : "transparent",
                  marginRight: 8,
                }}
              />
              <Text style={{ color: COLORS.text, fontSize: 12, flex: 1 }}>
                {step}
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>
            Ces étapes se cochent automatiquement quand les flux / droits sont prêts.
          </Text>
        </View>

        <View
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 18,
            padding: 16,
            marginBottom: 18,
            backgroundColor: COLORS.surface,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: COLORS.text,
              marginBottom: 10,
            }}
          >
            Regles pyramide
          </Text>
          {PYRAMID_STEPS.map((step) => (
            <Text
              key={step}
              style={{
                color: COLORS.text,
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              {`Tour ${step} -> ${step} repetition(s)`}
            </Text>
          ))}
          <Text style={{ color: COLORS.textMuted, marginTop: 10, fontSize: 12 }}>
            Finissez la pyramide sans abandon sous peine de punition automatique.
          </Text>
        </View>

        <View
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 18,
            padding: 16,
            marginBottom: 22,
            backgroundColor: COLORS.surface,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: COLORS.text,
            }}
          >
            Conditions
          </Text>
          <Text style={styles.condition}>
            - Niveau minimum : {MIN_LEVEL}
          </Text>
          <Text style={styles.condition}>
            - Mise minimale : defi classe actif
          </Text>
          <Text style={styles.condition}>
            - Camera live obligatoire (mobile ou web)
          </Text>
          <Text style={styles.condition}>
            - Fair-play ≥ {ARENA_FAIR_PLAY_THRESHOLD} requis pour l'Arena
          </Text>
        </View>

        <FairPlayAlert
          score={fairPlayScore}
          threshold={ARENA_FAIR_PLAY_THRESHOLD}
          onCtaPress={() => navigation.navigate("FairPlayHelp")}
        />

        <View
          style={{
            borderWidth: 1,
            borderColor: isFairPlayLocked ? COLORS.danger : COLORS.border,
            borderRadius: 18,
            padding: 16,
            marginBottom: 18,
            backgroundColor: isFairPlayLocked
              ? "rgba(255, 84, 84, 0.15)"
              : COLORS.surface,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: isFairPlayLocked ? COLORS.danger : COLORS.text,
              marginBottom: 4,
            }}
          >
            Fair-Play actuel : {fairPlayScore}
          </Text>
          <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
            Niveau : {playerStats?.level ?? "?"} • Points :{" "}
            {playerStats?.points ?? "?"}
          </Text>
          {isFairPlayLocked ? (
            <Text
              style={{
                color: COLORS.danger,
                marginTop: 8,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              Accès bloqué. Regagne des points fair-play (résolution de
              punitions, preuves vidéo, bonne conduite) pour rouvrir l'Arena.
            </Text>
          ) : (
            <Text
              style={{
                color: COLORS.textMuted,
                marginTop: 8,
                fontSize: 13,
              }}
            >
              Continue sur cette lancée pour débloquer les modes les plus
              impitoyables.
            </Text>
          )}
        </View>

        <AppButton
          label={
            sessionStatus === "live"
              ? "Session live active"
              : sessionStatus === "connecting"
              ? "Connexion..."
              : isHost
              ? "Creer ma salle live"
              : "Rejoindre la salle"
          }
          onPress={handleCreateLobby}
          loading={sessionStatus === "connecting"}
          disabled={sessionStatus === "live" || isFairPlayLocked}
          sport={challenge?.sport || undefined}
        />
        {room && (
          <View style={{ marginTop: 14 }}>
            <Text style={{ color: COLORS.text, fontSize: 12 }}>
              Room ID : {room.id}
            </Text>
          </View>
        )}

        <ScrollView
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 18,
            padding: 12,
            height: 110,
            marginTop: 18,
            backgroundColor: COLORS.surface,
          }}
        >
          {signalLog.length === 0 ? (
            <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
              Aucun log de signalisation pour le moment.
            </Text>
          ) : (
            signalLog.map((log, index) => (
              <Text
                key={`${log}-${index}`}
                style={{ color: COLORS.text, fontSize: 12, marginBottom: 4 }}
              >
                {log}
              </Text>
            ))
          )}
        </ScrollView>

        <View style={styles.actions}>
          <AppButton
            label="Signaler triche"
            variant="ghost"
            onPress={handleReport}
            sport={challenge?.sport || undefined}
          />
          <AppButton
            label="Tester la signalisation"
            variant="ghost"
            onPress={handleSendTestSignal}
            sport={challenge?.sport || undefined}
          />
          <AppButton
            label="Fermer"
            variant="ghost"
            onPress={() => navigation.goBack()}
            sport={challenge?.sport || undefined}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = {
  condition: {
    color: COLORS.text,
    fontSize: 13,
    marginTop: 6,
  },
  actions: {
    flexDirection: "column" as const,
    gap: 12,
    marginTop: 12,
  },
};
