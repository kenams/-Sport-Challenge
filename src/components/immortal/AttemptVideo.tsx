import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import VideoPlayer from "../VideoPlayer";
import { getVideoUrl } from "../../services/api";
import { COLORS } from "../../theme";

type Props = { path: string; removed?: boolean; height?: number };

/** Lecture d'une vidéo de preuve (stockage privé : lien temporaire). Gère retrait, chargement et échec. */
export default function AttemptVideo({ path, removed, height = 240 }: Props) {
  const [retry, setRetry] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let alive = true;
    if (removed) return;
    setState("loading");
    getVideoUrl(path).then((signed) => {
      if (!alive) return;
      setUrl(signed);
      setState(signed ? "ready" : "error");
    });
    return () => {
      alive = false;
    };
  }, [path, removed, retry]);

  if (removed) {
    return (
      <View style={[styles.box, { height }]}>
        <Text style={styles.text}>Vidéo retirée par la modération.</Text>
      </View>
    );
  }
  if (state === "loading") {
    return (
      <View style={[styles.box, { height }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }
  if (state === "error" || !url) {
    return (
      <View style={[styles.box, { height }]}>
        <Text style={styles.text} accessibilityRole="alert">Vidéo indisponible pour le moment.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Réessayer la lecture vidéo" onPress={() => setRetry((n) => n + 1)} style={{ padding: 12, minHeight: 44 }}>
          <Text style={{ color: COLORS.primary, fontWeight: "700" }}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }
  return <VideoPlayer key={`${path}-${retry}`} onError={() => setState("error")} uri={url} style={{ height, borderRadius: 14 }} shouldPlay autoPlay={false} allowUserToggle nativeControls />;
}

const styles = StyleSheet.create({
  box: { borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", padding: 16 },
  text: { color: COLORS.textMuted, fontSize: 14, textAlign: "center" },
});
