import React from "react";
import { StyleSheet, Text, View } from "react-native";
import EventAction from "./EventAction";
import { COLORS } from "../../theme";

type Props = { reason: string; onLogin: () => void; onRegister: () => void };

/** Invitation à se connecter au moment précis où une action l'exige (soutien, rappel, acceptation). */
export default function EventAuthPrompt({ reason, onLogin, onRegister }: Props) {
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Text style={styles.title}>Un compte est nécessaire</Text>
      <Text style={styles.text}>{reason}</Text>
      <View style={styles.row}>
        <View style={styles.cell}>
          <EventAction label="Se connecter" onPress={onLogin} />
        </View>
        <View style={styles.cell}>
          <EventAction label="Créer un compte" variant="ghost" onPress={onRegister} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(212,175,55,0.4)", backgroundColor: "rgba(212,175,55,0.06)", gap: 8 },
  title: { color: COLORS.primary, fontWeight: "800", fontSize: 14 },
  text: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  cell: { flexGrow: 1, flexBasis: 140 },
});
