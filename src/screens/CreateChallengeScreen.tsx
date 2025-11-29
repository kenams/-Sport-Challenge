// src/screens/CreateChallengeScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  Switch,
  ScrollView,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";

import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { COLORS } from "../theme";
import { feedbackError, feedbackSuccess, feedbackTap } from "../utils/feedback";

type Props = {
  navigation: any;
};

type WalletRow = {
  user_id: string;
  coins: number;
};

export default function CreateChallengeScreen({ navigation }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sport, setSport] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");
  const [betEnabled, setBetEnabled] = useState(false);
  const [betAmount, setBetAmount] = useState("");
  const [minLevel, setMinLevel] = useState("1");
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      feedbackError();
      Alert.alert(
        "Permission refusee",
        "Active la camera pour enregistrer une preuve du defi."
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

  const handleCreate = async () => {
    if (!title.trim() || !description.trim() || !sport.trim()) {
      feedbackError();
      Alert.alert("Champs requis", "Renseigne titre, description et sport.");
      return;
    }
    if (!targetValue || Number.isNaN(Number(targetValue))) {
      feedbackError();
      Alert.alert("Objectif invalide", "Entre une valeur numerique.");
      return;
    }
    if (!unit.trim()) {
      feedbackError();
      Alert.alert("Unite manquante", "Specifie l unite de mesure.");
      return;
    }
    if (!videoUri) {
      feedbackError();
      Alert.alert("Video requise", "Filme une demonstration pour ton defi.");
      return;
    }

    try {
      setSubmitting(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user || null;
      if (!user) {
        feedbackError();
        Alert.alert("Connexion requise", "Connecte toi pour creer un defi.");
        setSubmitting(false);
        return;
      }

      // Gestion de la mise du createur si defi classe
      let betAmountNum = 0;
      let currentCoins = 0;

      if (betEnabled) {
        betAmountNum = Number(betAmount) || 0;
        if (betAmountNum <= 0) {
          feedbackError();
          Alert.alert(
            "Mise invalide",
            "Pour un defi classe, entre une mise en coins superieure a 0."
          );
          setSubmitting(false);
          return;
        }

        const { data: wallet } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (wallet) {
          const w = wallet as WalletRow;
          currentCoins = w.coins || 0;
        }

        if (currentCoins < betAmountNum) {
          feedbackError();
          Alert.alert(
            "Pas assez de coins",
            `Tu as ${currentCoins} coins. Il faut au moins ${betAmountNum} coins pour lancer ce defi classe.`
          );
          setSubmitting(false);
          return;
        }
      }

      // 1) Upload video
      const filePath = `challenges/${user.id}_${Date.now()}.mp4`;
      const base64Video = await FileSystem.readAsStringAsync(videoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const fileData = decode(base64Video);

      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(filePath, fileData, { contentType: "video/mp4" });

      if (uploadError) {
        console.log("UPLOAD ERROR", uploadError);
        feedbackError();
        Alert.alert("Erreur", "Impossible d envoyer la video.");
        setSubmitting(false);
        return;
      }

      const { data: publicUrl } = supabase.storage
        .from("videos")
        .getPublicUrl(filePath);

      const payload = {
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        sport: sport.trim(),
        target_value: Number(targetValue),
        unit: unit.trim(),
        video_url: publicUrl.publicUrl,
        bet_enabled: betEnabled,
        bet_amount: betEnabled ? betAmountNum : 0,
        min_level: betEnabled ? Number(minLevel) || 1 : 1,
      };

      // 2) Inserer le defi
      const { data: inserted, error: insertError } = await supabase
        .from("challenges")
        .insert(payload)
        .select("*")
        .single();

      if (insertError) {
        console.log("INSERT CHALLENGE ERROR", insertError);
        feedbackError();
        Alert.alert("Erreur", "Impossible de creer le defi.");
        setSubmitting(false);
        return;
      }

      // 3) Si defi classe, deduire les coins du createur
      if (betEnabled && betAmountNum > 0) {
        const newCoins = Math.max(currentCoins - betAmountNum, 0);

        const { error: walletUpdateError } = await supabase
          .from("wallets")
          .update({ coins: newCoins })
          .eq("user_id", user.id);

        if (walletUpdateError) {
          console.log("CREATE CHALLENGE WALLET UPDATE ERROR", walletUpdateError);
          Alert.alert(
            "Attention",
            "Le defi est cree, mais une erreur est survenue lors de la mise a jour de tes coins."
          );
        }
      }

      // 4) Activite "defi cree"
      const pseudo = user.user_metadata?.pseudo || user.email || "Un joueur";

      const messageBase = `${pseudo} a cree un nouveau defi`;
      const messageFinal =
        betEnabled && betAmountNum > 0
          ? `${messageBase} (defi classe, mise ${betAmountNum} coins)`
          : messageBase;

      await supabase.from("activities").insert({
        user_id: user.id,
        pseudo,
        type: "challenge_created",
        challenge_id: inserted?.id ?? null,
        message: messageFinal,
      });

      // 5) Reset du formulaire
      setTitle("");
      setDescription("");
      setSport("");
      setTargetValue("");
      setUnit("");
      setBetEnabled(false);
      setBetAmount("");
      setMinLevel("1");
      setVideoUri(null);

      feedbackSuccess();
      Alert.alert("Defi cree", "Ton defi est en ligne !", [
        {
          text: "OK",
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (error: any) {
      console.log("CREATE CHALLENGE ERROR", error);
      feedbackError();
      Alert.alert("Erreur", error.message || "Impossible de creer le defi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            marginBottom: 12,
            color: COLORS.text,
          }}
        >
          Creer un defi
        </Text>

        <TextInput
          placeholder="Titre"
          placeholderTextColor={COLORS.textMuted}
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />
        <TextInput
          placeholder="Description"
          placeholderTextColor={COLORS.textMuted}
          value={description}
          onChangeText={setDescription}
          style={[styles.input, { height: 80 }]}
          multiline
        />
        <TextInput
          placeholder="Sport (pushups, basket, run...)"
          placeholderTextColor={COLORS.textMuted}
          value={sport}
          onChangeText={setSport}
          style={styles.input}
        />
        <TextInput
          placeholder="Objectif (nombre)"
          placeholderTextColor={COLORS.textMuted}
          value={targetValue}
          onChangeText={setTargetValue}
          keyboardType="numeric"
          style={styles.input}
        />
        <TextInput
          placeholder="Unite (ex: reps, km, s...)"
          placeholderTextColor={COLORS.textMuted}
          value={unit}
          onChangeText={setUnit}
          style={styles.input}
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: COLORS.text }}>
            Activer le pari
          </Text>
          <Switch
            value={betEnabled}
            onValueChange={(val) => {
              feedbackTap();
              setBetEnabled(val);
            }}
          />
        </View>

        {betEnabled && (
          <>
            <TextInput
              placeholder="Mise (coins)"
              placeholderTextColor={COLORS.textMuted}
              value={betAmount}
              onChangeText={setBetAmount}
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              placeholder="Niveau minimum"
              placeholderTextColor={COLORS.textMuted}
              value={minLevel}
              onChangeText={setMinLevel}
              keyboardType="numeric"
              style={styles.input}
            />
          </>
        )}

        <View style={{ marginVertical: 16 }}>
          <Button
            title={videoUri ? "Refilmer la video" : "Filmer la video du defi"}
            onPress={pickVideo}
          />
        </View>

        {videoUri && (
          <Video
            source={{ uri: videoUri }}
            style={{ height: 220, borderRadius: 8, backgroundColor: "#000" }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
          />
        )}

        <View style={{ marginTop: 24 }}>
          <Button
            title={submitting ? "Publication..." : "Publier le defi"}
            onPress={handleCreate}
            disabled={submitting}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = {
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    backgroundColor: COLORS.card,
    color: COLORS.text,
  },
};
