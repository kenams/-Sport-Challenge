// src/screens/ArenaLiveScreen.tsx
import React, { ComponentType, useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity } from "react-native";
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
  "Installer expo-camera / expo-video et demander les permissions (ios + android).",
  "Brancher le signal en temps reel (edge function arena-signal) pour host/guest.",
  "Capturer l'audio + video (WebRTC) et afficher la preview en remplacant le placeholder.",
  "Verifier le fair-play et la connexion avant d'autoriser la mise en pyramide.",
];

export default function ArenaLiveScreen({ route, navigation }: Props) {
  const { challengeId, mode = "live", role = "host", roomId } = route.params;
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
    useState<typeof import("expo-camera") | null>(null);
  const [cameraLoadError, setCameraLoadError] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [hasMicroPermission, setHasMicroPermission] = useState(false);
  const [roomChannel, setRoomChannel] = useState<
    ReturnType<typeof supabase.channel> | null
  >(null);
  const isFocused = useIsFocused();
  const sessionStatusRef = useRef<"idle" | "connecting" | "live">("idle");

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
    (async () => {
      try {
        const mod = await import("expo-camera");
        if (mounted) {
          setCameraModule(mod);
        }
      } catch (error) {
        console.warn("expo-camera module unavailable", error);
        if (mounted) {
          setCameraLoadError(
            "Module camera indisponible sur ce build (expo-camera)."
          );
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const requestPermissions = useCallback(async () => {
    if (!cameraModule) {
      return;
    }
    const { Camera } = cameraModule;
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasCameraPermission(status === "granted");
    const { status: micStatus } =
      await Camera.requestMicrophonePermissionsAsync();
    setHasMicroPermission(micStatus === "granted");
  }, [cameraModule]);

  useEffect(() => {
    if (cameraModule) {
      requestPermissions();
    }
  }, [cameraModule, requestPermissions]);

  useEffect(() => {
    if (hasCameraPermission && hasMicroPermission) {
      setLivePrepStatus((prev) =>
        prev.map((val, idx) => (idx === 0 ? true : val))
      );
    }
  }, [hasCameraPermission, hasMicroPermission]);

  useEffect(() => {
    if (!room?.id) {
      if (roomChannel) {
        supabase.removeChannel(roomChannel);
        setRoomChannel(null);
      }
      return;
    }
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
  }, [room?.id]);

  useEffect(() => {
    return () => {
      if (liveTimer.current) {
        clearTimeout(liveTimer.current);
      }
      if (sessionStatus === "live") {
        void logActivity("arena_finished", "Arena Live terminee");
      }
    };
  }, [sessionStatus, logActivity]);

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
      setSignalLog((prev) => [
        ...prev,
        `${isHost ? "Host" : "Guest"} connecte sur room ${targetRoom.id}`,
      ]);
      updateSessionStatus("live");
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
  const CameraComponent = cameraModule?.Camera as ComponentType<any> | undefined;
  const frontCameraType =
    (cameraModule as any)?.CameraType?.front ||
    (cameraModule as any)?.Camera?.Constants?.Type?.front;

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            color: COLORS.text,
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
            <SportTag sport={challenge.sport} />
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
            Preview camera
          </Text>
          {cameraLoadError && (
            <Text style={{ color: COLORS.danger, fontSize: 12, marginBottom: 6 }}>
              {cameraLoadError}
            </Text>
          )}
          {CameraComponent &&
          hasCameraPermission &&
          hasMicroPermission &&
          isFocused ? (
            <View
              style={{
                height: 200,
                borderRadius: 14,
                overflow: "hidden",
                backgroundColor: "#000",
              }}
            >
              <CameraComponent style={{ flex: 1 }} type={frontCameraType} />
            </View>
          ) : (
            <>
              <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
                Autorise la camera et le micro pour voir la preview live.
              </Text>
              <AppButton
                label="Autoriser camera"
                variant="ghost"
                onPress={requestPermissions}
                style={{ marginTop: 10 }}
              />
            </>
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
            Quand ces modules seront en place, remplace le bloc camera par le flux WebRTC.
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
          />
          <AppButton
            label="Tester la signalisation"
            variant="ghost"
            onPress={handleSendTestSignal}
          />
          <AppButton
            label="Fermer"
            variant="ghost"
            onPress={() => navigation.goBack()}
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
