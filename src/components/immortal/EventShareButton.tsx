import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import EventAction from "./EventAction";
import { COLORS } from "../../theme";
import { hasShareableLink, shareEvent, type ShareableEvent } from "../../services/share";

/** Partage avec confirmation visible et indication claire si aucun lien public n'est disponible. */
export default function EventShareButton({ event, label = "Partager" }: { event: ShareableEvent; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  const onShare = async () => {
    setBusy(true);
    setNote(null);
    const outcome = await shareEvent(event);
    setBusy(false);
    if (outcome.message) setNote({ text: outcome.message, error: outcome.status === "failed" });
  };

  return (
    <View style={styles.box}>
      <EventAction label={label} variant="ghost" onPress={onShare} busy={busy} />
      {note ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.note, note.error ? styles.error : styles.ok]}>
          {note.text}
        </Text>
      ) : null}
      {!hasShareableLink() ? (
        <Text style={styles.dev}>Le partage contient le texte du duel. Le lien public sera disponible lors de la mise en ligne.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 6 },
  note: { fontSize: 13, lineHeight: 18 },
  ok: { color: COLORS.success },
  error: { color: "#F87171" },
  dev: { color: "#FACC15", fontSize: 12 },
});
