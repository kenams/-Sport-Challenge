// src/screens/Auth/RegisterScreen.tsx
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import { COLORS, TYPO } from "../../theme";
import AppButton from "../../components/AppButton";
import LogoMark from "../../components/LogoMark";
import { supabase } from "../../supabase";

export default function RegisterScreen({ navigation }: any) {
  const [pseudo, setPseudo] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTiny = width < 420;

  const buildEmail = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, "") + "@immortalk.app";

  const handleRegister = async () => {
    const trimmed = pseudo.trim();
    if (!trimmed) return Alert.alert("Pseudo manquant", "Choisis un pseudo.");
    if (trimmed.length < 3) return Alert.alert("Pseudo trop court", "Minimum 3 caractères.");
    if (!password) return Alert.alert("Mot de passe manquant", "Choisis un mot de passe.");
    if (password.length < 6) return Alert.alert("Mot de passe faible", "Minimum 6 caractères.");
    if (password !== confirm) return Alert.alert("Confirmation incorrecte", "Les mots de passe ne correspondent pas.");

    try {
      setLoading(true);
      const email = buildEmail(trimmed);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { pseudo: trimmed } },
      });
      if (error) return Alert.alert("Erreur", error.message);
      if (data.user) {
        await supabase.from("profiles").upsert(
          { user_id: data.user.id, pseudo: trimmed, allow_mixed: true },
          { onConflict: "user_id" }
        );
        await supabase.from("players_stats").upsert(
          { user_id: data.user.id, points: 0, fair_play_score: 100 },
          { onConflict: "user_id" }
        );
        await supabase.from("wallets").upsert(
          { user_id: data.user.id, coins: 100 },
          { onConflict: "user_id" }
        );
      }
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer showHeader={false} showFooter={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 20 : 0}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: isTiny ? 16 : 24,
            gap: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.heroSection}>
            <View style={styles.logoStack}>
              <View style={styles.logoHalo} />
              <LogoMark size={isTiny ? 56 : 68} />
            </View>
            <Text style={[styles.heroTitle, isTiny && { fontSize: 22 }]}>
              IMMORTAL ARENA
            </Text>
            <Text style={styles.heroSubtitle}>Rejoins l'arène. Prouve ta valeur.</Text>
            <View style={styles.heroBadge}>
              <FontAwesome5 name="gift" size={11} color={COLORS.primary} />
              <Text style={styles.heroBadgeText}>100 coins offerts à l'inscription</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Créer un compte</Text>
            <Text style={styles.cardSubtitle}>Entre dans l'arène en 30 secondes.</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Pseudo</Text>
              <View style={styles.inputRow}>
                <FontAwesome5 name="user-alt" size={13} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={pseudo}
                  onChangeText={setPseudo}
                  placeholder="Ton blaze dans l'arène"
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.input}
                  autoCapitalize="none"
                  maxLength={20}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.inputRow}>
                <FontAwesome5 name="lock" size={13} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Minimum 6 caractères"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showPass}
                  style={[styles.input, { flex: 1 }]}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                  <FontAwesome5 name={showPass ? "eye-slash" : "eye"} size={13} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Confirmer le mot de passe</Text>
              <View style={styles.inputRow}>
                <FontAwesome5 name="shield-alt" size={13} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Répète ton mot de passe"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showPass}
                  style={[styles.input, { flex: 1 }]}
                />
              </View>
            </View>

            <View style={styles.strengthRow}>
              {[1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.strengthBar,
                    password.length >= i * 3 && { backgroundColor: i <= 2 ? "#F59E0B" : COLORS.success },
                  ]}
                />
              ))}
              <Text style={styles.strengthLabel}>
                {password.length === 0 ? "" : password.length < 6 ? "Faible" : password.length < 10 ? "Moyen" : "Fort"}
              </Text>
            </View>

            <AppButton
              label="Créer mon compte"
              onPress={handleRegister}
              loading={loading}
              style={{ marginTop: 8 }}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            <AppButton
              label="J'ai déjà un compte"
              variant="ghost"
              onPress={() => navigation?.navigate("Login")}
            />
          </View>

          <Text style={styles.legal}>
            En t'inscrivant, tu acceptes les règles de l'arène IMMORTAL-K.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroSection: { alignItems: "center" },
  logoStack: {
    width: 150, height: 150, marginBottom: 12,
    alignItems: "center", justifyContent: "center",
  },
  logoHalo: {
    position: "absolute", width: 140, height: 140, borderRadius: 36,
    backgroundColor: "rgba(212,175,55,0.12)",
    borderWidth: 1, borderColor: "rgba(212,175,55,0.35)",
    shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 }, elevation: 6,
  },
  heroTitle: { ...TYPO.display, color: COLORS.primary, marginTop: 6 },
  heroSubtitle: { ...TYPO.subtitle, color: COLORS.textMuted, marginTop: 4, textAlign: "center" },
  heroBadge: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(212,175,55,0.4)",
    backgroundColor: "rgba(212,175,55,0.1)",
  },
  heroBadgeText: { color: COLORS.primary, fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
  card: {
    backgroundColor: "rgba(14,14,18,0.92)", borderRadius: 22, padding: 20,
    borderWidth: 1, borderColor: "rgba(212,175,55,0.25)",
    shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 }, elevation: 6,
  },
  cardTitle: { ...TYPO.display, color: COLORS.text, marginBottom: 4 },
  cardSubtitle: { ...TYPO.subtitle, color: COLORS.textMuted, marginBottom: 20 },
  field: { marginBottom: 14 },
  label: { color: COLORS.text, fontSize: 13, marginBottom: 6, fontWeight: "600" },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14, backgroundColor: "rgba(5,5,7,0.9)",
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1, color: COLORS.text,
    paddingVertical: 12, fontSize: 14,
  },
  eyeBtn: { padding: 8 },
  strengthRow: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16, marginTop: 4,
  },
  strengthBar: {
    flex: 1, height: 3, borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  strengthLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600", minWidth: 36 },
  divider: {
    flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  dividerText: { color: COLORS.textMuted, fontSize: 12 },
  legal: {
    color: COLORS.textMuted, fontSize: 11, textAlign: "center",
    opacity: 0.6, lineHeight: 16,
  },
});
