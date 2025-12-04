// src/screens/Auth/RegisterScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Switch,
} from "react-native";
import { supabase } from "../../supabase";
import ScreenContainer from "../../components/ScreenContainer";
import { COLORS } from "../../theme";
import { GenderValue } from "../../types";
import { COMPETING_TERRITORIES } from "../../utils/departments";

const genderOptions: { label: string; helper: string; value: GenderValue }[] = [
  { label: "Homme", helper: "Perf classique", value: "male" },
  { label: "Femme", helper: "Courbe adaptée", value: "female" },
  { label: "Libre", helper: "Peu importe", value: "other" },
];

export default function RegisterScreen({ navigation }: any) {
  const [pseudo, setPseudo] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<GenderValue>("male");
  const [allowMixed, setAllowMixed] = useState(true);
  const [department, setDepartment] = useState("75");
  const [allowInterDept, setAllowInterDept] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const trimmed = pseudo.trim();

    if (!trimmed) {
      return Alert.alert("Pseudo manquant", "Choisis un pseudo.");
    }
    if (!password || password.length < 4) {
      return Alert.alert(
        "Mot de passe trop court",
        "Minimum 4 caractères pour les tests."
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
            gender,
            allowMixed,
            department,
            allowInterDept,
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

      const createdUserId = data.user?.id;
      if (createdUserId) {
        try {
          await supabase.from("profiles").upsert(
            {
              user_id: createdUserId,
              pseudo: trimmed,
              gender,
              allow_mixed: allowMixed,
              department,
              allow_inter_department: allowInterDept,
            },
            { onConflict: "user_id" }
          );
        } catch (profileError) {
          console.log("REGISTER PROFILE UPSERT ERROR", profileError);
        }
      }

      if (!data.session) {
        Alert.alert(
          "Compte créé",
          "Ton compte est prêt. Tu peux te connecter."
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
          Monte sur le ring
        </Text>

        <Text style={{ color: COLORS.text, marginBottom: 4 }}>Ton blaze</Text>
        <TextInput
          value={pseudo}
          onChangeText={setPseudo}
          placeholder="Balance ton blaze"
          placeholderTextColor={COLORS.textMuted}
          style={styles.input}
        />

        <Text style={{ color: COLORS.text, marginBottom: 4 }}>
          Mot de passe (minimum pour entrer)
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="****"
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry
          style={styles.input}
        />

        <Text style={{ color: COLORS.text, marginBottom: 6 }}>Profil</Text>
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          {genderOptions.map((option) => {
            const isActive = gender === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => setGender(option.value)}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  minWidth: 90,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isActive ? COLORS.primary : COLORS.border,
                  backgroundColor: isActive ? COLORS.primary : COLORS.card,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                }}
              >
                <Text
                  style={{
                    textAlign: "center",
                    color: isActive ? "#050505" : COLORS.textMuted,
                    fontWeight: "700",
                  }}
                >
                  {option.label}
                </Text>
                <Text
                  style={{
                    textAlign: "center",
                    color: isActive ? "#050505" : COLORS.textMuted,
                    fontSize: 11,
                  }}
                >
                  {option.helper}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ color: COLORS.text, marginBottom: 6 }}>
          Territoire (IDF ou Tarn-et-Garonne)
        </Text>
        <View
          style={{
            flexWrap: "wrap",
            flexDirection: "row",
            gap: 8,
            marginBottom: 12,
          }}
        >
          {COMPETING_TERRITORIES.map((dep) => {
            const selected = department === dep.code;
            return (
              <TouchableOpacity
                key={dep.code}
                onPress={() => setDepartment(dep.code)}
                style={{
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: selected ? COLORS.primary : COLORS.border,
                  backgroundColor: selected ? COLORS.primary : COLORS.card,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    color: selected ? "#050505" : COLORS.textMuted,
                    fontWeight: "700",
                  }}
                >
                  {dep.code}
                </Text>
                <Text
                  style={{
                    color: selected ? "#050505" : COLORS.textMuted,
                    fontSize: 11,
                  }}
                >
                  {dep.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 12,
            padding: 12,
            marginBottom: 18,
            backgroundColor: COLORS.card,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ color: COLORS.text, fontWeight: "700" }}>
              Mode mixte
            </Text>
            <Switch value={allowMixed} onValueChange={setAllowMixed} />
          </View>
          <Text
            style={{
              color: COLORS.textMuted,
              fontSize: 12,
              marginTop: 6,
            }}
          >
            Active si tu veux pouvoir défier ou être défié par tout le monde.
            Sinon, on te propose d’abord ta ligue.
          </Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 12,
            }}
          >
            <Text style={{ color: COLORS.text, fontWeight: "700" }}>
              Défis inter-territoires
            </Text>
            <Switch
              value={allowInterDept}
              onValueChange={setAllowInterDept}
            />
          </View>
          <Text
            style={{
              color: COLORS.textMuted,
              fontSize: 12,
              marginTop: 6,
            }}
          >
            Désactive si tu veux rester en duel uniquement avec ton
            territoire.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} />
        ) : (
          <Button title="Je débarque" onPress={handleRegister} />
        )}

        <View style={{ height: 16 }} />

        <Button
          title="Déjà dans le game ? Connection"
          onPress={() => navigation.navigate("Login")}
        />
      </View>
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
    color: COLORS.text,
    backgroundColor: COLORS.card,
  },
};
