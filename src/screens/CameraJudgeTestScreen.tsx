import React from "react";
import { Pressable, Text, View } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS } from "../theme";

export default function CameraJudgeTestScreen({ navigation }: any) {
  return <ScreenContainer><View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 14, padding: 24 }}>
    <Text style={{ color: COLORS.text, fontSize: 21, fontWeight: "900", textAlign: "center" }}>Essai caméra disponible sur le web</Text>
    <Text style={{ color: COLORS.textMuted, fontSize: 14, lineHeight: 21, textAlign: "center" }}>L’arbitre caméra bêta fonctionne actuellement dans Chrome ou Safari. Ouvre la page IMMORTAL sur le web pour tester les repères et le comptage.</Text>
    <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" style={{ minHeight: 44, paddingHorizontal: 18, borderRadius: 12, backgroundColor: COLORS.primary, justifyContent: "center" }}><Text style={{ color: COLORS.background, fontWeight: "800" }}>Retour</Text></Pressable>
  </View></ScreenContainer>;
}
