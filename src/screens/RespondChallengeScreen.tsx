// src/screens/RespondChallengeScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";
import AppButton from "../components/AppButton";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../supabase";
import { getVideoUploadPayload } from "../utils/videoUpload";
import VideoPlayer from "../components/VideoPlayer";

const KICKER = "REPONSE";
const TITLE = "Repondre au defi";
const SUBTITLE = "Respecte les regles, filme propre, puis soumets.";
const SPORTS = ["pushups", "course", "traction", "basket", "squat", "fitness", "running", "foot"];
const SPORT_LABELS: Record<string, string> = {
  pushups: "Pompes",
  course: "Sprint",
  traction: "Tractions",
  basket: "Basket",
  squat: "Squats",
  fitness: "Fitness",
  running: "Running",
  foot: "Foot",
};
const SPORT_PRESETS: Record<string, { duration: number; rules: string[]; tips: string[] }> = {
  pushups: {
    duration: 60,
    rules: [
      "Torse descend sous le niveau des coudes.",
      "Bras tendus en haut, pas de rebond.",
      "Corps aligne, pas de bassin qui tombe.",
    ],
    tips: ["Camera de profil", "Sol visible", "Compteur audio clair"],
  },
  course: {
    duration: 25,
    rules: ["Depart sur signal clair", "Ligne d'arrivee visible", "Pas d'aide externe"],
    tips: ["Cadre large", "Chrono visible", "Terrain degage"],
  },
  traction: {
    duration: 60,
    rules: ["Menton au-dessus de la barre", "Bras tendus en bas", "Pas d'elastique"],
    tips: ["Camera de face", "Barre bien visible", "Prise pronation ou supination"],
  },
  basket: {
    duration: 90,
    rules: ["Panier visible", "Tirs consecutifs", "Pas de rebond excessif"],
    tips: ["Cadre fixe", "Zone de tir claire", "Camera sur le cote"],
  },
  squat: {
    duration: 90,
    rules: ["Hanches sous les genoux", "Dos droit", "Pieds stables"],
    tips: ["Camera de profil", "Lumiere frontale", "Amplitude visible"],
  },
  fitness: {
    duration: 60,
    rules: ["Mouvement complet", "Rythme constant", "Pas de coupure video"],
    tips: ["Cadre entier", "Timer audible", "Sol stable"],
  },
  running: {
    duration: 600,
    rules: ["Distance complete", "Trace GPS visible", "Pas d'arret prolonge"],
    tips: ["Montre ou appli visible", "Fin de course claire", "Plan large"],
  },
  foot: {
    duration: 45,
    rules: ["Parcours visible", "Ballon toujours controle", "Pas d'aide externe"],
    tips: ["Camera fixe", "Plots visibles", "Espace degage"],
  },
  default: {
    duration: 60,
    rules: [
      "Cadre stable, corps entier visible.",
      "Demarrage sur signal, pas de pause.",
      "Compteur audio ou timer visible.",
      "Lumiere suffisante, pas de montage.",
    ],
    tips: ["Camera stable", "Lumiere propre", "Son clair"],
  },
};
const VIDEO_BUCKET = "challenge-videos";

const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export default function RespondChallengeScreen() {
  const route = useRoute<any>();
  const challengeId = Number(route?.params?.id || 0);
  const routeTitle = route?.params?.title as string | undefined;
  const routeSport = route?.params?.sport as string | undefined;
  const computedSport =
    routeSport || SPORTS[(challengeId || 1) % SPORTS.length] || "default";
  const preset = SPORT_PRESETS[computedSport] ?? SPORT_PRESETS.default;
  const durationSeconds = preset.duration;
  const challengeName = useMemo(
    () =>
      routeTitle ||
      (challengeId
        ? `Defi #${challengeId} - ${SPORT_LABELS[computedSport] || computedSport}`
        : "Defi du jour"),
    [challengeId, routeTitle, computedSport]
  );
  const [isStarted, setIsStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [remaining, setRemaining] = useState(durationSeconds);
  const [hasVideo, setHasVideo] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isStarted) {
      setRemaining(durationSeconds);
    }
  }, [durationSeconds, isStarted]);

  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!isStarted || isPaused || isFinished) return;
    const timer = setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          clearInterval(timer);
          setIsFinished(true);
          setIsPaused(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isStarted, isPaused, isFinished]);

  const statusLabel = isFinished
    ? "Defi termine"
    : isStarted
    ? isPaused
      ? "En pause"
      : "En cours"
    : "Pret a demarrer";

  const handleStart = () => {
    setIsStarted(true);
    setIsPaused(false);
    setIsFinished(false);
    setRemaining(durationSeconds);
    setHasVideo(false);
    setVideoUri(null);
    setUploadedUrl(null);
    setSubmitted(false);
    setUploadProgress(0);
  };

  const handlePause = () => {
    if (!isStarted || isFinished) return;
    setIsPaused((prev) => !prev);
  };

  const handleFinish = () => {
    if (!isStarted || isFinished) return;
    setIsFinished(true);
    setIsPaused(false);
  };

  const requestCamera = async () => {
    if (Platform.OS === "web") return true;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera refusee", "Active la camera pour filmer le defi.");
      return false;
    }
    return true;
  };

  const requestLibrary = async () => {
    if (Platform.OS === "web") return true;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Galerie refusee", "Active la galerie pour choisir une video.");
      return false;
    }
    return true;
  };

  const pickVideo = async (mode: "camera" | "library") => {
    const hasPermission = mode === "camera" ? await requestCamera() : await requestLibrary();
    if (!hasPermission) return;
    const pickerResult =
      mode === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            videoMaxDuration: durationSeconds,
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: 1,
          });

    if (pickerResult.canceled || !pickerResult.assets?.length) return;
    const asset = pickerResult.assets[0];
    setVideoUri(asset.uri);
    setHasVideo(true);
    setIsFinished(true);
    setIsPaused(false);
  };

  const handleSubmit = async () => {
    if (!videoUri) {
      Alert.alert("Video manquante", "Choisis une video avant de soumettre.");
      return;
    }
    if (uploading) return;
    setUploading(true);
    setUploadProgress(0.05);
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 0.9) return prev;
        const next = prev + 0.06;
        return next > 0.9 ? 0.9 : next;
      });
    }, 400);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        Alert.alert("Connexion requise", "Connecte-toi pour soumettre ta video.");
        setUploading(false);
        setUploadProgress(0);
        return;
      }

      const path = `challenge-${challengeId || "demo"}/${userId}-${Date.now()}.mp4`;
      const payload = await getVideoUploadPayload(videoUri);
      const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(path, payload.data, {
        contentType: payload.contentType,
        upsert: true,
      });

      if (error) {
        throw error;
      }

      const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path);
      const publicUrl = data.publicUrl;
      setUploadedUrl(publicUrl);

      let canInsert = false;
      if (challengeId) {
        const { data: challengeRow } = await supabase
          .from("challenges")
          .select("id")
          .eq("id", challengeId)
          .maybeSingle();
        canInsert = !!challengeRow;
      }

      if (canInsert) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("pseudo, avatar_url")
          .eq("user_id", userId)
          .maybeSingle();

        const { error: insertError } = await supabase.from("challenge_responses").insert({
          challenge_id: challengeId,
          user_id: userId,
          pseudo: profile?.pseudo ?? null,
          avatar_url: profile?.avatar_url ?? null,
          video_url: publicUrl,
          status: "UPLOADED",
        });

        if (insertError) {
          throw insertError;
        }
      }

      setUploadProgress(1);
      setSubmitted(true);
      Alert.alert(
        "Video envoyee",
        canInsert
          ? "Ta performance est en cours de validation."
          : "Video chargee (mode demo)."
      );
    } catch (err: any) {
      Alert.alert("Upload impossible", err?.message || "Essaye a nouveau.");
      setUploadProgress(0);
    } finally {
      setUploading(false);
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>{KICKER}</Text>
          <Text style={styles.title}>{TITLE}</Text>
          <Text style={styles.subtitle}>{SUBTITLE}</Text>
          <Text style={styles.challengeName}>{challengeName}</Text>
          <Text style={styles.metaLine}>
            Discipline: {SPORT_LABELS[computedSport] || computedSport} - Duree:{" "}
            {formatTime(durationSeconds)}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{formatTime(remaining)}</Text>
              <Text style={styles.statLabel}>Temps</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{isStarted ? "1/1" : "0/1"}</Text>
              <Text style={styles.statLabel}>Session</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{hasVideo ? "OK" : "--"}</Text>
              <Text style={styles.statLabel}>Video</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{submitted ? "OK" : "--"}</Text>
              <Text style={styles.statLabel}>Soumission</Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>{statusLabel}</Text>
            <Text style={styles.statusHint}>
              {isFinished
                ? "Upload la video pour validation."
                : isStarted
                ? "Reste dans le cadre et ne coupe pas."
                : "Appuie sur commencer quand tu es pret."}
            </Text>
          </View>
          <View style={styles.actions}>
            {!isStarted && (
              <>
                <AppButton label="Commencer le defi" size="sm" onPress={handleStart} />
                <AppButton
                  label="Importer video"
                  size="sm"
                  variant="ghost"
                  onPress={() => pickVideo("library")}
                />
              </>
            )}
            {isStarted && !isFinished && (
              <>
                <AppButton
                  label={isPaused ? "Reprendre" : "Mettre en pause"}
                  size="sm"
                  variant="ghost"
                  onPress={handlePause}
                />
                <AppButton
                  label="Terminer"
                  size="sm"
                  variant="ghost"
                  onPress={handleFinish}
                />
                <AppButton
                  label="Filmer"
                  size="sm"
                  onPress={() => pickVideo("camera")}
                />
              </>
            )}
            {isFinished && (
              <>
                <AppButton
                  label="Filmer"
                  size="sm"
                  onPress={() => pickVideo("camera")}
                />
                <AppButton
                  label="Importer video"
                  size="sm"
                  variant="ghost"
                  onPress={() => pickVideo("library")}
                />
                <AppButton
                  label={submitted ? "Soumis" : uploading ? "Envoi..." : "Soumettre"}
                  size="sm"
                  variant="ghost"
                  onPress={handleSubmit}
                />
              </>
            )}
          </View>
        </View>

        {videoUri ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Apercu video</Text>
            <Text style={styles.sectionSubtitle}>
              Verifie rapidement avant d'envoyer.
            </Text>
            <View style={styles.videoCard}>
              <VideoPlayer
                uri={videoUri}
                style={styles.videoPlayer}
                contentFit="cover"
                autoPlay={false}
                shouldPlay={false}
                allowUserToggle
                showControlButton
              />
            </View>
            {uploading || submitted ? (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressBar, { width: `${Math.round(uploadProgress * 100)}%` }]}
                  />
                </View>
                <Text style={styles.progressLabel}>
                  {uploading
                    ? `Upload ${Math.round(uploadProgress * 100)}%`
                    : "Upload termine"}
                </Text>
              </View>
            ) : null}
            {uploadedUrl ? (
              <Text style={styles.uploadHint}>Lien public: {uploadedUrl}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Checklist video</Text>
          <Text style={styles.sectionSubtitle}>
            Controle visuel rapide avant de demarrer.
          </Text>
          <View style={styles.cardGrid}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Camera stable</Text>
              <Text style={styles.cardMeta}>Trepied recommande</Text>
              <Text style={styles.cardValue}>OK</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Luminosite</Text>
              <Text style={styles.cardMeta}>Pas d'ombre sur le corps</Text>
              <Text style={styles.cardValue}>OK</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Timer visible</Text>
              <Text style={styles.cardMeta}>Chrono ou annonce audio</Text>
              <Text style={styles.cardValue}>OK</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Regles du defi</Text>
          <Text style={styles.sectionSubtitle}>
            Respecte ces points pour une validation rapide.
          </Text>
          <View style={styles.cardGrid}>
            {preset.rules.map((rule, index) => (
              <View key={`rule-${index}`} style={styles.card}>
                <Text style={styles.cardTitle}>Regle {index + 1}</Text>
                <Text style={styles.cardMeta}>{rule}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conseils rapides</Text>
          <Text style={styles.sectionSubtitle}>
            Pour une validation plus simple.
          </Text>
          <View style={styles.cardGrid}>
            {preset.tips.map((tip, index) => (
              <View key={`tip-${index}`} style={styles.card}>
                <Text style={styles.cardTitle}>Tip {index + 1}</Text>
                <Text style={styles.cardMeta}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Etapes</Text>
          <Text style={styles.sectionSubtitle}>
            Le flow complet en 4 moves simples.
          </Text>
          <View style={styles.cardGrid}>
            {["Preparation", "Recording", "Upload", "Validation"].map((step, index) => (
              <View key={`step-${step}`} style={styles.card}>
                <Text style={styles.cardTitle}>{step}</Text>
                <Text style={styles.cardMeta}>Etape {index + 1}</Text>
                <Text style={styles.cardValue}>
                  {index === 0 && (isStarted ? "OK" : "Attente")}
                  {index === 1 && (isStarted && !isFinished ? "En cours" : "--")}
                  {index === 2 && (hasVideo ? "OK" : "--")}
                  {index === 3 && (submitted ? "OK" : "--")}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 80 },
  hero: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    backgroundColor: "rgba(12,12,16,0.92)",
    marginBottom: 18,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.textMuted,
    fontWeight: "700",
  },
  title: {
    ...TYPO.display,
    color: COLORS.text,
    marginTop: 6,
  },
  subtitle: {
    ...TYPO.subtitle,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  challengeName: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "700",
  },
  metaLine: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  statsRow: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: "rgba(3,7,18,0.6)",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  actions: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  statusRow: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
  },
  statusLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: COLORS.primary,
    fontWeight: "700",
  },
  statusHint: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  videoCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    overflow: "hidden",
    backgroundColor: COLORS.surface,
  },
  videoPlayer: {
    width: "100%",
    minHeight: 220,
  },
  uploadHint: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  progressWrap: {
    marginTop: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.2)",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: COLORS.primary,
  },
  progressLabel: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  section: { marginBottom: 18 },
  sectionTitle: {
    ...TYPO.title,
    color: COLORS.text,
  },
  sectionSubtitle: {
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 10,
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    flex: 1,
    minWidth: 220,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: COLORS.surface,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  cardMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  cardValue: {
    fontSize: 13,
    color: COLORS.primary,
    marginTop: 8,
    fontWeight: "700",
  },
});
