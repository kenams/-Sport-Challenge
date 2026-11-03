import React from "react";
import { Text, View } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";

export default function DuelLiveScreen({ navigation }: any) {
  return (
    <ScreenContainer>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 }}>
        <Text style={{ ...TYPO.display, color: COLORS.text, fontSize: 23, textAlign: "center" }}>Le live vidéo est disponible sur le web</Text>
        <Text style={{ color: COLORS.textMuted, lineHeight: 21, textAlign: "center" }}>
          Ouvre IMMORTAL dans Chrome ou Safari pour rejoindre ce duel en direct. La version mobile intégrée arrivera avec une prochaine build de l’application.
        </Text>
        <Text onPress={() => navigation.goBack()} accessibilityRole="button" style={{ color: COLORS.primary, fontWeight: "800", marginTop: 8 }}>
          Retour au duel
        </Text>
      </View>
    </ScreenContainer>
  );
}
