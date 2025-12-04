// src/screens/Auth/LoginScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../supabase";
import ScreenContainer from "../../components/ScreenContainer";
import { COLORS } from "../../theme";
import AppButton from "../../components/AppButton";

const logoSource = require("../../../assets/immortal-k-logo.png");

export default function LoginScreen({ navigation }: any) {
  const [pseudo, setPseudo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    const trimmed = pseudo.trim();

    if (!trimmed) {
      return Alert.alert("Pseudo manquant", "Entre ton pseudo.");
    }
    if (!password) {
      return Alert.alert("Mot de passe manquant", "Entre ton mot de passe.");
    }

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
        // onAuthStateChange dans App.tsx gere la redirection
      }
    } catch (e: any) {
      console.log(e);
      Alert.alert("Erreur", e.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer showHeader={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={
          Platform.OS === "ios" ? insets.top + 20 : 0
        }
      >
        <ScrollView
          contentContainerStyle={[
            styles.wrapper,
            {
              paddingTop: insets.top + 24,
              paddingBottom: insets.bottom + 32,
              flexGrow: 1,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSection}>
            <Image source={logoSource} style={styles.heroLogo} />
            <Text style={styles.heroSubtitle}>
              Coach sportif & motivation quotidienne
            </Text>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.statValue}>+45</Text>
                <Text style={styles.statLabel}>Defis actifs</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.statValue}>12</Text>
                <Text style={styles.statLabel}>Sports couverts</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Connexion</Text>
            <Text style={styles.cardSubtitle}>
              Rentre sur l'arene et garde ton rythme.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Pseudo</Text>
              <TextInput
                value={pseudo}
                onChangeText={setPseudo}
                placeholder="Ton blaze IMMORTAL"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Mot de passe</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="****"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                style={styles.input}
              />
            </View>

            <AppButton
              label="Se connecter"
              onPress={handleLogin}
              loading={loading}
            />

            <AppButton
              label="Creer un compte"
              onPress={() => navigation.navigate("Register")}
              variant="ghost"
              style={{ marginTop: 12 }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  heroSection: {
    alignItems: "center",
  },
  heroLogo: {
    width: 140,
    height: 140,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
  heroStats: {
    flexDirection: "row",
    marginTop: 18,
    gap: 14,
  },
  heroStat: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    minWidth: 110,
  },
  statValue: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: "800",
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: "100%",
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: 18,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    color: COLORS.text,
    fontSize: 13,
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    backgroundColor: COLORS.card,
  },
});
