import React, { useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import VideoPlayer from "../VideoPlayer";
import { ActionButton, FieldLabel, InlineMessage } from "./AttemptFormParts";
import { COLORS } from "../../theme";
import { checkVideoCandidate, readWebVideoDuration, type VideoCandidate } from "../../services/video";

type Props = {
  value: VideoCandidate | null;
  onChange: (video: VideoCandidate | null) => void;
  maxSeconds: number;
  disabled?: boolean;
  /** Erreur de saisie à afficher (ex. vidéo manquante à l'envoi). */
  error?: string | null;
};

type Denied = "camera" | "library" | null;

function sizeLabel(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 0.1 * 1024 * 1024) return "< 0,1 Mo";
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Choix de la vidéo de preuve : filmer ou galerie, contrôle des limites, aperçu, permissions expliquées. */
export default function VideoPicker({ value, onChange, maxSeconds, disabled, error }: Props) {
  const [denied, setDenied] = useState<Denied>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (mode: "camera" | "library") => {
    if (busy || disabled) return;
    setBusy(true);
    setProblem(null);
    setDenied(null);
    try {
      if (Platform.OS !== "web") {
        const permission = mode === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setDenied(mode);
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["videos"], videoMaxDuration: maxSeconds, quality: 0.7 };
      const result = mode === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const candidate: VideoCandidate = {
        uri: asset.uri,
        mimeType: asset.mimeType ?? null,
        fileSize: asset.fileSize ?? null,
        durationSeconds: Platform.OS === "web"
          ? await readWebVideoDuration(asset.uri)
          : typeof asset.duration === "number" ? asset.duration / 1000 : null,
      };
      const check = checkVideoCandidate(candidate, maxSeconds);
      if (!check.ok) {
        setProblem(check.message);
        return;
      }
      onChange(candidate);
    } catch (caught) {
      if (caught instanceof Error && caught.message === "video_metadata_unavailable") {
        setProblem("Impossible de lire cette vidéo. Choisis un fichier MP4, MOV ou WebM lisible.");
        return;
      }
      setProblem(mode === "camera" ? "Impossible d'ouvrir la caméra. Choisis plutôt une vidéo dans ta galerie." : "Impossible d'ouvrir la galerie. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  };

  const deniedText =
    denied === "camera"
      ? "L'accès à la caméra est refusé. Autorise-le dans les réglages pour filmer ta performance, ou choisis une vidéo dans ta galerie."
      : denied === "library"
        ? "L'accès à la galerie est refusé. Autorise-le dans les réglages pour choisir une vidéo, ou filme-la directement."
        : null;

  return (
    <View style={{ gap: 10 }}>
      <FieldLabel>Vidéo de ta performance</FieldLabel>
      <Text style={styles.helper}>MP4, MOV ou WebM, 50 Mo maximum, {maxSeconds} secondes maximum. Corps entier visible, vidéo continue.</Text>

      {value ? (
        <View style={{ gap: 10 }}>
          <VideoPlayer uri={value.uri} style={styles.preview} shouldPlay autoPlay={false} allowUserToggle nativeControls />
          <Text style={styles.fileInfo}>
            Vidéo prête{value.durationSeconds ? ` · ${Math.ceil(value.durationSeconds)} s` : ""}
            {value.fileSize ? ` · ${sizeLabel(value.fileSize)}` : ""}
          </Text>
          <ActionButton label="Changer de vidéo" variant="ghost" onPress={() => onChange(null)} disabled={disabled} hint="Retire cette vidéo pour en choisir une autre" />
        </View>
      ) : (
        <View style={styles.row}>
          <View style={{ flex: 1, minWidth: 150 }}>
            <ActionButton label="Filmer" onPress={() => pick("camera")} loading={busy} disabled={disabled} hint="Ouvre la caméra pour enregistrer ta performance" />
          </View>
          <View style={{ flex: 1, minWidth: 150 }}>
            <ActionButton label="Choisir une vidéo" variant="ghost" onPress={() => pick("library")} disabled={disabled || busy} hint="Choisis une vidéo déjà enregistrée" />
          </View>
        </View>
      )}

      {deniedText ? (
        <View style={{ gap: 8 }}>
          <InlineMessage tone="error">{deniedText}</InlineMessage>
          {Platform.OS !== "web" ? (
            <ActionButton
              label="Ouvrir les réglages"
              variant="ghost"
              onPress={() => {
                Linking.openSettings().catch(() => setProblem("Impossible d'ouvrir les réglages. Ouvre-les depuis le menu de ton téléphone."));
              }}
            />
          ) : (
            <Text style={styles.helper}>Autorise l'accès dans les paramètres de ton navigateur, puis réessaie.</Text>
          )}
        </View>
      ) : null}
      {problem ? <InlineMessage tone="error">{problem}</InlineMessage> : null}
      {error && !problem && !deniedText ? <InlineMessage tone="error">{error}</InlineMessage> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  helper: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  preview: { height: 260, borderRadius: 14, overflow: "hidden", backgroundColor: COLORS.surface },
  fileInfo: { color: COLORS.success, fontSize: 13, fontWeight: "700" },
});
