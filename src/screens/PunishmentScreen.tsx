// src/screens/PunishmentScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, Alert, TextInput, StyleSheet } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";
import { supabase } from "../supabase";
import AppButton from "../components/AppButton";

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
        "D\u00e9cris ta preuve (lien vid\u00e9o, explication) avant de valider."
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
            message: "Punition soldée (+3 fair-play)",
          });
        }
        Alert.alert(
          "Punition termin\u00e9e !",
          "Tu peux \u00e0 nouveau faire des d\u00e9fis class\u00e9s (fair-play +3)."
        );
        navigation.goBack();
      }
    } catch (e: any) {
      console.log(e);
      Alert.alert(
        "Erreur",
        e.message || "Impossible de mettre à jour la punition"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={styles.pageTitle}>Punition active</Text>

        <Text style={styles.pageSubtitle}>
          Tu as perdu une battle class\u00e9e.{"\n"}
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

        <AppButton
          label={loading ? "Lecture en cours..." : "Regarder une pub"}
          onPress={simulateWatchAd}
          loading={loading}
        />

        <View style={{ height: 16 }} />

        <AppButton
          label="Retour"
          variant="ghost"
          onPress={() => navigation.goBack()}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    ...TYPO.display,
    color: COLORS.text,
    marginBottom: 10,
  },
  pageSubtitle: {
    ...TYPO.subtitle,
    color: COLORS.textMuted,
    textAlign: "center",
    marginBottom: 20,
  },
});