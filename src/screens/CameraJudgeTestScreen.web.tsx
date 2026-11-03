import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import { FontAwesome5 } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import { DuelPoseJudge, type DuelExercise, type PoseFeedback } from "../live/duelPoseJudge.web";
import { COLORS, TYPO } from "../theme";

type FormatKey = "pushups_60s" | "pullups_max";

export default function CameraJudgeTestScreen({ navigation }: any) {
  const route = useRoute<any>();
  const initialFormat = route.params?.formatKey as FormatKey | undefined;
  const [format, setFormat] = useState<FormatKey>(initialFormat === "pullups_max" ? "pullups_max" : "pushups_60s");
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Choisis l’exercice, puis lance l’essai caméra.");
  const [feedback, setFeedback] = useState<PoseFeedback | null>(null);
  const [reps, setReps] = useState(0);
  const videoHost = useRef<HTMLDivElement | null>(null);
  const overlayHost = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const judgeRef = useRef<DuelPoseJudge | null>(null);
  const repsRef = useRef(0);

  const stopCamera = () => {
    judgeRef.current?.dispose();
    judgeRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    videoHost.current?.replaceChildren();
    overlayHost.current?.replaceChildren();
    setStarted(false);
  };

  useEffect(() => () => {
    judgeRef.current?.dispose();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !videoHost.current || !overlayHost.current) {
      setMessage("Cette caméra n’est pas disponible dans ce navigateur. Ouvre IMMORTAL dans Chrome ou Safari récent.");
      return;
    }
    setLoading(true);
    setMessage("Demande d’autorisation caméra…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      const video = document.createElement("video");
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.objectFit = "contain";
      video.style.background = "#09090B";
      video.srcObject = stream;
      videoHost.current.replaceChildren(video);
      await new Promise<void>((resolve, reject) => {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) { resolve(); return; }
        video.addEventListener("loadeddata", () => resolve(), { once: true });
        video.addEventListener("error", () => reject(new Error("video_not_ready")), { once: true });
      });
      await video.play();
      if (!overlayHost.current) throw new Error("overlay_missing");
      const canvas = document.createElement("canvas");
      canvas.style.position = "absolute";
      canvas.style.inset = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.pointerEvents = format === "pullups_max" ? "auto" : "none";
      canvas.style.cursor = format === "pullups_max" ? "crosshair" : "default";
      overlayHost.current.replaceChildren(canvas);
      const exercise: DuelExercise = format === "pushups_60s" ? "pushup" : "pullup";
      const judge = new DuelPoseJudge(video, canvas, exercise, 0, async () => {
        repsRef.current += 1;
        setReps(repsRef.current);
        return true;
      }, setFeedback);
      judgeRef.current = judge;
      await judge.start();
      setStarted(true);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      videoHost.current?.replaceChildren();
      overlayHost.current?.replaceChildren();
      setMessage(error instanceof DOMException && error.name === "NotAllowedError" ? "Autorise la caméra dans ton navigateur, puis réessaie." : "Impossible de démarrer la caméra. Vérifie qu’elle n’est pas déjà utilisée.");
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  const selectFormat = (next: FormatKey) => {
    if (started) return;
    setFormat(next);
    setFeedback(null);
    setMessage(next === "pullups_max" ? "Essai traction : il faudra toucher l’image à la hauteur de la barre." : "Essai pompe : place la caméra de profil, corps entier visible.");
    repsRef.current = 0;
    setReps(0);
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" style={styles.back}><FontAwesome5 name="arrow-left" size={14} color={COLORS.text} /><Text style={styles.backText}>Retour</Text></Pressable>
        <Text style={styles.heading} accessibilityRole="header">Essai de l’arbitre caméra</Text>
        <Text style={styles.subheading}>Aucun duel, score ou enregistrement n’est créé.</Text>

        <View style={styles.privacyCard}>
          <Text style={styles.cardTitle}>Essai privé sur cet appareil</Text>
          <Text style={styles.note}>La vidéo reste dans ton navigateur pour cette démo. MediaPipe analyse la posture sur l’appareil et peut envoyer des statistiques d’utilisation, mais pas les images. La caméra ne démarre que lorsque tu appuies sur le bouton.</Text>
        </View>

        <View style={styles.exerciseRow}>
          <Pressable onPress={() => selectFormat("pushups_60s")} accessibilityRole="button" style={[styles.exerciseButton, format === "pushups_60s" ? styles.exerciseSelected : null]}><Text style={[styles.exerciseText, format === "pushups_60s" ? styles.selectedText : null]}>Pompes</Text></Pressable>
          <Pressable onPress={() => selectFormat("pullups_max")} accessibilityRole="button" style={[styles.exerciseButton, format === "pullups_max" ? styles.exerciseSelected : null]}><Text style={[styles.exerciseText, format === "pullups_max" ? styles.selectedText : null]}>Tractions</Text></Pressable>
        </View>

        <View style={styles.cameraFrame}>
          <View ref={videoHost as any} style={styles.videoHost} />
          <View ref={overlayHost as any} pointerEvents="box-none" style={styles.overlayHost} />
          {!started ? <View style={styles.cameraPlaceholder}><FontAwesome5 name="camera" size={30} color={COLORS.primary} /><Text style={styles.placeholderText}>La caméra s’affichera ici</Text></View> : null}
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}><Text style={styles.cardTitle}>Répétitions détectées</Text><Text style={styles.repCount}>{reps}</Text></View>
          <Text style={[styles.statusText, feedback?.kind === "good" ? styles.good : feedback?.kind === "correct" || feedback?.kind === "not-visible" || feedback?.kind === "error" ? styles.correction : null]}>{feedback?.message ?? message}</Text>
          {format === "pullups_max" && started ? <Text style={styles.note}>Touche la vidéo à la hauteur de la barre pour déplacer le repère jaune.</Text> : null}
        </View>

        {!started ? (
          <Pressable onPress={startCamera} disabled={loading} accessibilityRole="button" style={[styles.primaryButton, loading ? { opacity: 0.65 } : null]}>
            <FontAwesome5 name="camera" size={16} color={COLORS.background} /><Text style={styles.primaryText}>{loading ? "Démarrage…" : "Démarrer l’essai caméra"}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={stopCamera} accessibilityRole="button" style={styles.stopButton}><Text style={styles.stopText}>Arrêter la caméra</Text></Pressable>
        )}
        <Text style={styles.disclaimer}>L’arbitre est en bêta : le comptage est une estimation, pas un résultat officiel. Pour le duel, le modérateur garde la validation finale.</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 100, gap: 14 },
  back: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", minHeight: 38 },
  backText: { color: COLORS.text, fontWeight: "700", fontSize: 13 },
  heading: { ...TYPO.display, color: COLORS.text, fontSize: 26 },
  subheading: { color: COLORS.textMuted, fontSize: 13, marginTop: -8 },
  privacyCard: { padding: 15, borderRadius: 15, borderWidth: 1, borderColor: "rgba(212,175,55,0.35)", backgroundColor: "rgba(212,175,55,0.07)", gap: 8 },
  cardTitle: { color: COLORS.primary, fontWeight: "900", fontSize: 13, letterSpacing: 0.4 },
  note: { color: COLORS.textMuted, fontSize: 11, lineHeight: 17 },
  exerciseRow: { flexDirection: "row", gap: 10 },
  exerciseButton: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  exerciseSelected: { borderColor: COLORS.primary, backgroundColor: "rgba(212,175,55,0.12)" },
  exerciseText: { color: COLORS.textMuted, fontSize: 13, fontWeight: "800" },
  selectedText: { color: COLORS.primary },
  cameraFrame: { width: "100%", aspectRatio: 0.82, backgroundColor: "#09090B", borderRadius: 16, overflow: "hidden", position: "relative" },
  videoHost: { position: "absolute", inset: 0, width: "100%", height: "100%" } as any,
  overlayHost: { position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2 } as any,
  cameraPlaceholder: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", gap: 10 } as any,
  placeholderText: { color: COLORS.textMuted, fontSize: 13 },
  statusCard: { padding: 16, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, gap: 9 },
  statusHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  repCount: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  statusText: { color: COLORS.text, fontWeight: "800", fontSize: 14, lineHeight: 20 },
  good: { color: COLORS.success },
  correction: { color: "#FBBF24" },
  primaryButton: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, backgroundColor: COLORS.primary },
  primaryText: { color: COLORS.background, fontWeight: "900", fontSize: 14 },
  stopButton: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 13, borderWidth: 1, borderColor: COLORS.border },
  stopText: { color: COLORS.text, fontWeight: "800", fontSize: 13 },
  disclaimer: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, textAlign: "center" },
});
