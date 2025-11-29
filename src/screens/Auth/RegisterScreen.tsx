// src/screens/Auth/RegisterScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../../supabase";
import ScreenContainer from "../../components/ScreenContainer";
import { COLORS } from "../../theme";

export default function RegisterScreen({ navigation }: any) {
  const [pseudo, setPseudo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const trimmed = pseudo.trim();

    if (!trimmed) {
      return Alert.alert("Pseudo manquant", "Choisis un pseudo.");
    }
    if (!password || password.length < 4) {
      return Alert.alert(
        "Mot de passe trop court",
        "Mininum 4 caractères pour les tests."
      );
    }

    const emailFake =
      trimmed.toLowerCase().replace(/\s+/g, "") + "@test.local";

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: emailFake,
        password,
        options: {
          data: {
            pseudo: trimmed,
          },
        },
      });

      if (error) {
        console.log("REGISTER ERROR", error);
        return Alert.alert(
          "Erreur",
          error.message || "Impossible de créer le compte."
        );
      }

      if (!data.session) {
        Alert.alert(
          "Compte créé",
          "Ton compte est créé. Tu peux te connecter."
        );
        navigation.navigate("Login");
        return;
      }
    } catch (e: any) {
      console.log(e);
      Alert.alert("Erreur", e.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text
          style={{
            fontSize: 26,
            fontWeight: "900",
            color: COLORS.text,
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          Créer un compte
        </Text>

        <Text style={{ color: COLORS.text, marginBottom: 4 }}>Pseudo</Text>
        <TextInput
          value={pseudo}
          onChangeText={setPseudo}
          placeholder="Ton blaze"
          placeholderTextColor={COLORS.textMuted}
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 8,
            padding: 10,
            marginBottom: 12,
            color: COLORS.text,
          }}
        />

        <Text style={{ color: COLORS.text, marginBottom: 4 }}>
          Mot de passe
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="****"
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 8,
            padding: 10,
            marginBottom: 20,
            color: COLORS.text,
          }}
        />

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} />
        ) : (
          <Button title="Créer le compte" onPress={handleRegister} />
        )}

        <View style={{ height: 16 }} />

        <Button
          title="Déjà un compte ? Se connecter"
          onPress={() => navigation.navigate("Login")}
        />
      </View>
    </ScreenContainer>
  );
}
