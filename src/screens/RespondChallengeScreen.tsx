// src/screens/RespondChallengeScreen.tsx
import React, { useState } from "react";
import { View, Text, Button, Alert, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Video, ResizeMode } from "expo-av";
import { decode } from "base64-arraybuffer";

import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { COLORS } from "../theme";
import {
  feedbackError,
  feedbackSuccess,
  feedbackTap,
} from "../utils/feedback";

type Props = {
  route: { params?: { challengeId?: number } };
  navigation: any;
};

type WalletRow = {
  user_id: string;
  coins: number;
};

export default function RespondChallengeScreen({ route, navigation }: Props) {
  const challengeId = route?.params?.challengeId;

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!challengeId) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: COLORS.text,
              marginBottom: 8,
            }}
          >
            Defi introuvable
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: COLORS.textMuted,
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            Aucun identifiant de defi n a ete fourni pour cet ecran.
          </Text>
          <Button title="Retour" onPress={() => navigation.goBack()} />
        </View>
      </ScreenContainer>
    );
  }

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      feedbackError();
      Alert.alert(
        "Permission refusee",
        "Active la camera pour enregistrer ta reponse au defi."
      );
      return;
    }

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.7,
    });

    if (!res.canceled) {
      feedbackTap();
      setVideoUri(res.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!videoUri) {
      feedbackError();
      Alert.alert("Video manquante", "Filme ta reponse avant de valider.");
      return;
    }

    try {
      setSubmitting(true);

      const { data: ses } = await supabase.auth.getSession();
      const user = ses.session?.user || null;

      if (!user) {
        feedbackError();
        Alert.alert("Non connecte", "Tu dois etre connecte.");
        setSubmitting(false);
        return;
      }

      // 1) Charger le defi
      const { data: chData, error: chError } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", challengeId)
        .maybeSingle();

      if (chError || !chData) {
        console.log("RESPOND CHALLENGE LOAD ERROR", chError);
        feedbackError();
        Alert.alert("Erreur", "Defi introuvable pour cette reponse.");
        setSubmitting(false);
        return;
      }

      const challenge: any = chData;
      const isBet = !!challenge.bet_enabled && (challenge.bet_amount || 0) > 0;
      const betAmount: number = isBet ? challenge.bet_amount || 0 : 0;

      let currentCoins = 0;

      // 2) Si pari actif, verifier les coins
      if (isBet && betAmount > 0) {
        const { data: wallet } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (wallet) {
          const w = wallet as WalletRow;
          currentCoins = w.coins || 0;
        }

        if (currentCoins < betAmount) {
          feedbackError();
          Alert.alert(
            "Pas assez de coins",
            `Tu as ${currentCoins} coins. Il faut au moins ${betAmount} coins pour repondre a ce defi classe.`
          );
          setSubmitting(false);
          return;
        }
      }

      // 3) Upload video
      const filePath = `responses/${user.id}_${Date.now()}.mp4`;

      const base64Video = await FileSystem.readAsStringAsync(videoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const fileData = decode(base64Video);

      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(filePath, fileData, {
          contentType: "video/mp4",
        });

      if (uploadError) {
        console.log("RESPOND UPLOAD ERROR", uploadError);
        feedbackError();
        Alert.alert("Erreur", "Impossible d envoyer la video.");
        setSubmitting(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("videos")
        .getPublicUrl(filePath);

      const videoUrl = publicUrlData.publicUrl;

      // 4) Inserer la reponse
      const { error: insertError } = await supabase
        .from("challenge_responses")
        .insert({
          challenge_id: challengeId,
          user_id: user.id,
          video_url: videoUrl,
        });

      if (insertError) {
        console.log("RESPOND INSERT ERROR", insertError);
        feedbackError();
        Alert.alert("Erreur", "Impossible d enregistrer ta reponse au defi.");
        setSubmitting(false);
        return;
      }

      // 5) Deduct coins when a bet is active
      if (isBet && betAmount > 0) {
        const newCoins = Math.max(currentCoins - betAmount, 0);

        const { error: walletUpdateError } = await supabase
          .from("wallets")
          .update({ coins: newCoins })
          .eq("user_id", user.id);

        if (walletUpdateError) {
          console.log("RESPOND WALLET UPDATE ERROR", walletUpdateError);
          Alert.alert(
            "Attention",
            "Ta reponse est envoyee, mais une erreur est survenue lors de la mise a jour de tes coins."
          );
        }
      }

      // 6) Activite
      const pseudo = user.user_metadata?.pseudo || user.email || "Un joueur";

      const messageBase = `${pseudo} a repondu a un defi`;
      const messageFinal = isBet
        ? `${messageBase} (defi classe, mise ${betAmount} coins)`
        : messageBase;

      await supabase.from("activities").insert({
        user_id: user.id,
        pseudo,
        type: "challenge_response",
        challenge_id: challengeId,
        message: messageFinal,
      });

      feedbackSuccess();
      Alert.alert("Reponse envoyee", "Ta video a ete enregistree !");
      navigation.goBack();
    } catch (e: any) {
      console.log("RESPOND SUBMIT ERROR", e);
      feedbackError();
      Alert.alert("Erreur", e.message || "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "900",
            color: COLORS.text,
            marginBottom: 12,
          }}
        >
          Repondre au defi
        </Text>

        <Text
          style={{
            fontSize: 13,
            color: COLORS.textMuted,
            marginBottom: 16,
          }}
        >
          Filme ta meilleure performance pour tenter de battre le createur et
          prendre le dessus.
        </Text>

        <View style={{ marginBottom: 16 }}>
          <Button
            title={videoUri ? "Refilmer la video" : "Filmer ma reponse"}
            onPress={pickVideo}
          />
        </View>

        {videoUri && (
          <View
            style={{
              borderRadius: 12,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: COLORS.border,
              marginBottom: 20,
            }}
          >
            <Video
              source={{ uri: videoUri }}
              style={{ height: 240, backgroundColor: "#000" }}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
            />
          </View>
        )}

        <View style={{ marginTop: 8 }}>
          {submitting ? (
            <ActivityIndicator size="large" color={COLORS.primary} />
          ) : (
            <Button title="Envoyer ma reponse" onPress={handleSubmit} />
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
