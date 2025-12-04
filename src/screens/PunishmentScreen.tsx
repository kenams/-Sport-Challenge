// src/screens/PunishmentScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Button, Alert, TextInput } from "react-native";
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
  const [proofNote, setProofNote] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id || null);
    });
  }, []);

  const simulateWatchAd = async () => {
    if (loading) return;
    if (!proofNote.trim()) {
      Alert.alert(
        "Preuve requise",
        "Decris ta preuve (lien video, explication) avant de valider."
      );
      return;
    }
    setLoading(true);

    try {
      const newValue = Math.max(remaining - 1, 0);
      setRemaining(newValue);

      await supabase.from("punishment_logs").insert({
        punishment_id: punishmentId,
        user_id: userId,
        note: proofNote.trim(),
      });
      setProofNote("");

      if (newValue > 0) {
        await supabase
          .from("punishments")
          .update({ ads_remaining: newValue })
          .eq("id", punishmentId);
        Alert.alert("Pub vue !", "Plus que " + newValue + " pub(s)...");
      } else {
        await supabase
          .from("punishments")
          .update({ ads_remaining: 0, active: false })
          .eq("id", punishmentId);
        if (userId) {
          const { data: stats } = await supabase
            .from("players_stats")
            .select("fair_play_score")
            .eq("user_id", userId)
            .maybeSingle();
          const current = (stats as any)?.fair_play_score ?? 100;
          const newFairPlay = Math.min(100, current + 3);
          await supabase
            .from("players_stats")
            .update({ fair_play_score: newFairPlay })
            .eq("user_id", userId);
          await supabase.from("activities").insert({
            user_id: userId,
            type: "punishment_resolved",
            challenge_id: null,
            message: "Punition soldee (+3 fair-play)",
          });
        }
        Alert.alert(
          "Punition terminee !",
          "Tu peux a nouveau faire des defis classes (fair-play +3)."
        );
        navigation.goBack();
      }
    } catch (e: any) {
      console.log(e);
      Alert.alert("Erreur", e.message || "Impossible de mettre a jour la punition");
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
          Punition active
        </Text>

        <Text
          style={{
            fontSize: 15,
            color: COLORS.textMuted,
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          Tu as perdu une battle classee.{"\n"}
          Tu dois regarder {remaining} pub(s) pour rejouer.
        </Text>

        <TextInput
          placeholder="Donne ta preuve/lien..."
          placeholderTextColor={COLORS.textMuted}
          value={proofNote}
          onChangeText={setProofNote}
          style={{
            width: "90%",
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 12,
            padding: 12,
            color: COLORS.text,
            marginBottom: 16,
          }}
        />

        <Button
          title={loading ? "Lecture en cours..." : "Regarder une pub"}
          onPress={simulateWatchAd}
        />

        <View style={{ height: 16 }} />

        <Button title="Retour" onPress={() => navigation.goBack()} />
      </View>
    </ScreenContainer>
  );
}
