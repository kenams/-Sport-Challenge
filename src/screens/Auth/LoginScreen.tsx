// src/screens/Auth/LoginScreen.tsx
import React, { useState } from "react";
import { View, Text, TextInput, Button, Alert, ActivityIndicator } from "react-native";
import { supabase } from "../../supabase";
import ScreenContainer from "../../components/ScreenContainer";
import { COLORS } from "../../theme";

export default function LoginScreen({ navigation }: any) {
  const [pseudo, setPseudo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const trimmed = pseudo.trim();

    if (!trimmed) {
      return Alert.alert("Pseudo manquant", "Entre ton pseudo.");
    }
    if (!password) {
      return Alert.alert("Mot de passe manquant", "Entre ton mot de passe.");
    }

    // On reconstruit le même faux email que côté inscription
    const emailFake =
      trimmed.toLowerCase().replace(/\s+/g, "") + "@test.local";

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailFake,
        password,
      });

      if (error) {
        console.log("LOGIN ERROR", error);
        return Alert.alert("Erreur", "Pseudo ou mot de passe incorrect.");
      }

      if (data.session) {
        // App.tsx va automatiquement te basculer sur MainTabs
        // grâce à onAuthStateChange, donc rien à faire ici.
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
          Connexion
        </Text>

        <Text style={{ color: COLORS.text, marginBottom: 4 }}>Pseudo</Text>
        <TextInput
          value={pseudo}
          onChangeText={setPseudo}
          placeholder="Ton pseudo"
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
          <Button title="Se connecter" onPress={handleLogin} />
        )}

        <View style={{ height: 16 }} />

        <Button
          title="Créer un compte"
          onPress={() => navigation.navigate("Register")}
        />
      </View>
    </ScreenContainer>
  );
}
