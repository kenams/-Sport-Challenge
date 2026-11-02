import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../supabase";
import AuthLayout from "../../components/immortal/AuthLayout";
import AccountField from "../../components/immortal/AccountField";
import ActionButton from "../../components/immortal/ActionButton";
import { COLORS } from "../../theme";
import { describeAuthError, validatePassword } from "../helpers/validation";

export default function ResetPasswordScreen({ navigation }: any) {
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      const hasSession = !!data.session && !sessionError;
      setReady(hasSession);
      setChecking(false);
      if (!hasSession) setError("Ce lien de réinitialisation est invalide ou expiré. Demande-en un nouveau depuis la page de connexion.");
    }).catch(() => {
      if (!active) return;
      setReady(false);
      setChecking(false);
      setError("Impossible de vérifier ce lien. Demande un nouvel e-mail de réinitialisation.");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(!!session);
        if (session) setError(null);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const submit = async () => {
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(describeAuthError(updateError, "reset"));
        return;
      }
      navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
    } catch (caught) {
      setError(describeAuthError(caught as { message?: string }, "reset"));
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <AuthLayout title="Vérification du lien" subtitle="On vérifie que le lien de réinitialisation est encore valide.">
        <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </AuthLayout>
    );
  }

  if (!ready) {
    return (
      <AuthLayout title="Lien expiré" subtitle={error ?? "Demande un nouvel e-mail pour choisir un nouveau mot de passe."}>
        <ActionButton label="Retour à la connexion" onPress={() => navigation.navigate("Login")} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Nouveau mot de passe" subtitle="Choisis un nouveau mot de passe pour sécuriser ton compte.">
      <AccountField
        label="Nouveau mot de passe"
        value={password}
        onChangeText={setPassword}
        placeholder="8 caractères minimum"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <AccountField
        label="Confirme le mot de passe"
        value={confirmation}
        onChangeText={setConfirmation}
        placeholder="Répète ton mot de passe"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
        returnKeyType="go"
      />
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      <ActionButton label="Enregistrer le mot de passe" onPress={submit} loading={saving} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 96, alignItems: "center", justifyContent: "center" },
  error: { color: "#F87171", fontSize: 14, lineHeight: 20 },
});
