// Connexion : e-mail + mot de passe réels, mot de passe oublié. Aucun compte de test.
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { supabase } from "../../supabase";
import { ensurePlayer, getMyProfile, updateMyProfile } from "../../services/api";
import AuthLayout from "../../components/immortal/AuthLayout";
import AccountField from "../../components/immortal/AccountField";
import ActionButton from "../../components/immortal/ActionButton";
import { COLORS } from "../../theme";
import { describeAuthError, validateEmail, validatePseudo } from "../helpers/validation";

/**
 * Après connexion : le profil est créé côté serveur (ensurePlayer). Si l'inscription avait demandé une confirmation d'e-mail,
 * pseudo et territoire saisis alors sont repris ici. Sinon, ProfileScreen affiche le formulaire d'achèvement de profil.
 */
async function finishProfileAfterSignIn(user: { user_metadata?: Record<string, unknown> } | null | undefined) {
  await ensurePlayer();
  const profile = await getMyProfile();
  if (profile.error || (profile.data?.pseudo ?? "").trim()) return;
  const meta = user?.user_metadata ?? {};
  const pseudo = typeof meta.pseudo === "string" ? meta.pseudo : "";
  if (validatePseudo(pseudo)) return;
  const text = (key: string) => (typeof meta[key] === "string" ? (meta[key] as string).slice(0, 60) : "");
  await updateMyProfile({ pseudo, city: text("city"), region: text("region"), country: text("country") });
}

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const signIn = async () => {
    const eErr = validateEmail(email);
    setEmailError(eErr);
    setError(null);
    setInfo(null);
    if (eErr) return;
    if (!password) {
      setError("Saisis ton mot de passe.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (authError) {
        setError(describeAuthError(authError, "signin"));
        return;
      }
      await finishProfileAfterSignIn(data.user).catch(() => {});
    } catch (caught) {
      setError(describeAuthError(caught as { message?: string }, "signin"));
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async () => {
    const eErr = validateEmail(email);
    setEmailError(eErr ? "Saisis d'abord ton adresse e-mail ci-dessus." : null);
    setError(null);
    setInfo(null);
    if (eErr) return;
    setResetting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      if (resetError) setError(describeAuthError(resetError, "reset"));
      else setInfo("Si un compte existe avec cette adresse, un e-mail de réinitialisation vient d'être envoyé. Pense à vérifier tes courriers indésirables.");
    } catch (caught) {
      setError(describeAuthError(caught as { message?: string }, "reset"));
    } finally {
      setResetting(false);
    }
  };

  return (
    <AuthLayout title="Connexion" subtitle="Retrouve tes performances et ta place dans les records.">
      <AccountField
        label="Adresse e-mail"
        value={email}
        onChangeText={setEmail}
        placeholder="toi@exemple.fr"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        error={emailError}
      />
      <AccountField
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        placeholder="Ton mot de passe"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={signIn}
        returnKeyType="go"
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {info ? (
        <Text style={styles.info} accessibilityRole="alert">
          {info}
        </Text>
      ) : null}
      <ActionButton label="Se connecter" onPress={signIn} loading={loading} disabled={resetting} />
      <View style={styles.links}>
        <ActionButton label="Mot de passe oublié ?" variant="link" onPress={forgotPassword} loading={resetting} disabled={loading} />
        <ActionButton label="Créer un compte" variant="ghost" onPress={() => navigation.navigate("Register")} disabled={loading} />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  error: { color: "#F87171", fontSize: 14, lineHeight: 20 },
  info: { color: COLORS.success, fontSize: 14, lineHeight: 20 },
  links: { gap: 8 },
});
