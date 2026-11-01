import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppButton from "../AppButton";
import { COLORS } from "../../theme";

type Props = { message: string; onRetry?: () => void };

/** Erreur de chargement distincte d'un état vide, avec une action pour réessayer. */
export default function ErrorState({ message, onRetry }: Props) {
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Text style={styles.title}>Impossible de charger</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? <AppButton label="Réessayer" onPress={onRetry} variant="ghost" style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 20, borderRadius: 16, borderWidth: 1, borderColor: "rgba(239,68,68,0.4)", backgroundColor: "rgba(239,68,68,0.08)", gap: 8 },
  title: { color: "#F87171", fontSize: 15, fontWeight: "800" },
  message: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
  action: { marginTop: 8 },
});
