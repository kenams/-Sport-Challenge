import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppButton from "../AppButton";
import { COLORS } from "../../theme";

type Props = { title: string; message?: string; actionLabel?: string; onAction?: () => void };

/** État vide utile : dit quoi faire ensuite, jamais un écran blanc. */
export default function EmptyState({ title, message, actionLabel, onAction }: Props) {
  return (
    <View style={styles.box} accessibilityRole="summary">
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? <AppButton label={actionLabel} onPress={onAction} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 20, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, alignItems: "center", gap: 8 },
  title: { color: COLORS.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
  message: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  action: { marginTop: 8, alignSelf: "stretch" },
});
