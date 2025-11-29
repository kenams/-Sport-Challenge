// src/screens/PunishmentScreen.tsx
import React, { useState } from "react";
import { View, Text, Button, Alert } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS } from "../theme";
import { supabase } from "../supabase";

type Props = {
  route: { params: { adsRemaining: number; punishmentId: number } };
  navigation: any;
};

export default function PunishmentScreen({ route, navigation }: Props) {
  const { adsRemaining, punishmentId } = route.params;
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(adsRemaining);

  const simulateWatchAd = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const newValue = Math.max(remaining - 1, 0);
      setRemaining(newValue);

      if (newValue > 0) {
        await supabase
          .from("punishments")
          .update({ ads_remaining: newValue })
          .eq("id", punishmentId);
        Alert.alert("Pub vue 🙄", "Plus que " + newValue + " pub(s)...");
      } else {
        await supabase
          .from("punishments")
          .update({ ads_remaining: 0, active: false })
          .eq("id", punishmentId);
        Alert.alert(
          "Punition terminée 😤",
          "Tu peux à nouveau faire des défis classés !"
        );
        navigation.goBack();
      }
    } catch (e: any) {
      console.log(e);
      Alert.alert("Erreur", e.message || "Impossible de mettre à jour la punition");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "900",
            color: COLORS.text,
            marginBottom: 10,
          }}
        >
          ⚠ Punition active
        </Text>

        <Text
          style={{
            fontSize: 15,
            color: COLORS.textMuted,
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          Tu as perdu une battle classée.{"\n"}
          Tu dois regarder {remaining} pub(s) pour rejouer.
        </Text>

        <Button
          title={loading ? "Lecture en cours..." : "Regarder une pub ▶"}
          onPress={simulateWatchAd}
        />

        <View style={{ height: 16 }} />

        <Button title="Retour" onPress={() => navigation.goBack()} />
      </View>
    </ScreenContainer>
  );
}
