// src/screens/Auth/RegisterScreen.tsx
import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import { COLORS, TYPO } from "../../theme";
import AppButton from "../../components/AppButton";
import { supabase } from "../../supabase";

export default function RegisterScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password) {
      Alert.alert("Erreur", "Renseigne un email et un mot de passe.");
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        Alert.alert("Erreur", error.message);
        return;
      }
      Alert.alert("Bienvenue", "Compte cree. Verifie ton email si besoin.");
      navigation?.navigate("Login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.card}>
        <Text style={styles.kicker}>INSCRIPTION</Text>
        <Text style={styles.title}>Creer ton compte</Text>
        <Text style={styles.subtitle}>Entre dans l'arene en 30 secondes.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="ton@email.com"
          placeholderTextColor={COLORS.textMuted}
          style={styles.input}
        />

        <Text style={styles.label}>Mot de passe</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="********"
          placeholderTextColor={COLORS.textMuted}
          style={styles.input}
        />

        <View style={styles.actions}>
          <AppButton label={loading ? "..." : "Inscription"} onPress={handleRegister} />
          <AppButton
            label="Deja un compte ?"
            variant="ghost"
            onPress={() => navigation?.navigate("Login")}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    backgroundColor: "rgba(12,12,16,0.92)",
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.textMuted,
    fontWeight: "700",
  },
  title: {
    ...TYPO.display,
    color: COLORS.text,
    marginTop: 6,
  },
  subtitle: {
    ...TYPO.subtitle,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: COLORS.text,
    marginTop: 10,
  },
  input: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    backgroundColor: "rgba(8,8,12,0.6)",
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actions: {
    marginTop: 16,
    gap: 10,
  },
});
