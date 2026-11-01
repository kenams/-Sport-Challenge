// Inscription : e-mail réel, mot de passe, pseudo, territoire déclaré, consentement. Aucun octroi de points ni de coins.
import React, { useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { supabase } from "../../supabase";
import { ensurePlayer, updateMyProfile } from "../../services/api";
import AuthLayout from "../../components/immortal/AuthLayout";
import AccountField from "../../components/immortal/AccountField";
import ActionButton from "../../components/immortal/ActionButton";
import TerritoryForm from "../../components/immortal/TerritoryForm";
import { COLORS } from "../../theme";
import {
  cleanText,
  describeAuthError,
  isSignUpEmailAlreadyUsed,
  normalizeTerritory,
  validateEmail,
  validatePassword,
  validatePseudo,
  validateTerritory,
  type TerritoryInput,
} from "../helpers/validation";

export default function RegisterScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [territory, setTerritory] = useState<TerritoryInput>({ country: "", region: "", city: "" });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null; pseudo?: string | null; territory?: string | null; consent?: string | null }>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  const submit = async () => {
    const next = {
      email: validateEmail(email),
      password: validatePassword(password),
      pseudo: validatePseudo(pseudo),
      territory: validateTerritory(territory),
      consent: consent ? null : "Accepte les conditions pour créer ton compte.",
    };
    setErrors(next);
    setError(null);
    if (Object.values(next).some(Boolean)) return;

    const cleanEmail = email.trim().toLowerCase();
    const cleanPseudo = cleanText(pseudo);
    const t = normalizeTerritory(territory);
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { pseudo: cleanPseudo, country: t.country, region: t.region, city: t.city } },
      });
      if (authError) {
        setError(describeAuthError(authError, "signup"));
        return;
      }
      if (isSignUpEmailAlreadyUsed(data.user)) {
        setError(describeAuthError({ code: "user_already_exists" }, "signup"));
        return;
      }
      if (data.session) {
        await ensurePlayer();
        const saved = await updateMyProfile({ pseudo: cleanPseudo, city: t.city, region: t.region, country: t.country });
        if (saved.error) setError(saved.error);
        return;
      }
      setConfirmationSentTo(cleanEmail);
    } catch (caught) {
      setError(describeAuthError(caught as { message?: string }, "signup"));
    } finally {
      setLoading(false);
    }
  };

  if (confirmationSentTo) {
    return (
      <AuthLayout title="Vérifie ta boîte mail">
        <View style={styles.mailIcon} accessible={false}>
          <FontAwesome5 name="envelope-open-text" size={26} color={COLORS.primary} />
        </View>
        <Text style={styles.body}>
          Nous avons envoyé un lien de confirmation à <Text style={styles.strong}>{confirmationSentTo}</Text>.
        </Text>
        <Text style={styles.body}>
          Ouvre-le pour activer ton compte, puis reviens te connecter. Ton pseudo et ton territoire seront enregistrés à ta première connexion.
        </Text>
        <Text style={styles.muted}>Rien reçu ? Regarde dans les courriers indésirables, ou réessaie avec une autre adresse.</Text>
        <ActionButton label="Aller à la connexion" onPress={() => navigation.navigate("Login")} />
        <ActionButton label="Changer d'adresse e-mail" variant="link" onPress={() => setConfirmationSentTo(null)} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Créer un compte" subtitle="Défie tes amis en vidéo : pompes et tractions.">
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
        error={errors.email}
      />
      <AccountField
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        placeholder="8 caractères minimum"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        hint="8 caractères minimum."
        error={errors.password}
      />
      <AccountField
        label="Pseudo"
        value={pseudo}
        onChangeText={setPseudo}
        placeholder="Ton pseudo public"
        maxLength={24}
        autoCapitalize="none"
        autoCorrect={false}
        hint="2 à 24 caractères. Visible des autres joueurs."
        error={errors.pseudo}
      />
      <TerritoryForm value={territory} onChange={setTerritory} error={errors.territory} />

      <TouchableOpacity
        onPress={() => setConsent((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        accessibilityLabel="J'accepte les conditions d'utilisation. Mes vidéos publiées sont visibles des autres joueurs."
        style={[styles.consent, Platform.OS === "web" ? ({ cursor: "pointer" } as object) : null]}
      >
        <View style={[styles.box, consent ? styles.boxOn : null]}>{consent ? <FontAwesome5 name="check" size={12} color="#0B0B0B" /> : null}</View>
        <Text style={styles.consentText}>
          J'accepte les conditions d'utilisation. Je comprends que les vidéos que je publie sont visibles des autres joueurs.
        </Text>
      </TouchableOpacity>
      {errors.consent ? (
        <Text style={styles.error} accessibilityRole="alert">
          {errors.consent}
        </Text>
      ) : null}

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <ActionButton label="Créer mon compte" onPress={submit} loading={loading} />
      <ActionButton label="J'ai déjà un compte" variant="link" onPress={() => navigation.navigate("Login")} disabled={loading} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  body: { color: COLORS.text, fontSize: 15, lineHeight: 22 },
  strong: { fontWeight: "800", color: COLORS.primary },
  muted: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19 },
  mailIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(212,175,55,0.12)", borderWidth: 1, borderColor: "rgba(212,175,55,0.4)" },
  consent: { flexDirection: "row", gap: 12, alignItems: "flex-start", minHeight: 44 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.4)", alignItems: "center", justifyContent: "center", marginTop: 1 },
  boxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  consentText: { flex: 1, color: COLORS.textMuted, fontSize: 13, lineHeight: 19 },
  error: { color: "#F87171", fontSize: 14, lineHeight: 20 },
});
