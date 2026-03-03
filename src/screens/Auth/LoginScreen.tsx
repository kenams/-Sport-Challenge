// src/screens/Auth/LoginScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../supabase";
import ScreenContainer from "../../components/ScreenContainer";
import { COLORS, TYPO } from "../../theme";
import AppButton from "../../components/AppButton";
import LogoMark from "../../components/LogoMark";

export default function LoginScreen({ navigation }: any) {
  const [pseudo, setPseudo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 720;
  const isTiny = width < 420;

  const buildEmail = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, "") + "@test.local";

  const TEST_PSEUDO =
    process.env.EXPO_PUBLIC_TEST_PSEUDO || "testcoach";
  const TEST_PASSWORD =
    process.env.EXPO_PUBLIC_TEST_PASSWORD || "Test1234!";
  const TEST_AVATAR_URL =
    "https://i.pravatar.cc/150?img=12";
  const TEST_VIDEO_URL =
    "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4";
  const TEST_BIO =
    "Athlète multi-sport. Objectif : progresser chaque semaine.";
  const TEST_SPORTS =
    "running, basket, fitness";

  const seedTestAccount = async (userId: string) => {
    try {
      await supabase.from("profiles").upsert(
        {
          user_id: userId,
          pseudo: TEST_PSEUDO,
          avatar_url: TEST_AVATAR_URL,
          gender: "male",
          allow_mixed: true,
          department: "75",
          allow_inter_department: true,
        },
        { onConflict: "user_id" }
      );

      await supabase.from("players_stats").upsert(
        {
          user_id: userId,
          points: 820,
          level: 5,
          title: "Warrior",
          fair_play_score: 96,
        },
        { onConflict: "user_id" }
      );

      await supabase.from("wallets").upsert(
        { user_id: userId, coins: 420 },
        { onConflict: "user_id" }
      );

      await supabase.auth.updateUser({
        data: {
          bio: TEST_BIO,
          sports: TEST_SPORTS,
        },
      });

      const { data: existingChallenge } = await supabase
        .from("challenges")
        .select("id")
        .eq("user_id", userId)
        .limit(1);

      if (!existingChallenge || existingChallenge.length === 0) {
        const { data: inserted, error: insertError } = await supabase
          .from("challenges")
          .insert({
            user_id: userId,
            pseudo: TEST_PSEUDO,
            avatar_url: TEST_AVATAR_URL,
            title: "Performance test 5 km",
            description: "Course 5 km en 30 minutes.",
            sport: "running",
            target_value: 5,
            unit: "km",
            video_url: TEST_VIDEO_URL,
            bet_enabled: false,
            bet_amount: 0,
            min_level: 1,
            ranked: false,
          })
          .select("id")
          .single();

        if (!insertError && inserted?.id) {
          await supabase.from("activities").insert({
            user_id: userId,
            pseudo: TEST_PSEUDO,
            avatar_url: TEST_AVATAR_URL,
            type: "challenge_created",
            challenge_id: inserted.id,
            message: "Nouvelle performance publiée.",
          });
        }
      }
    } catch (err) {
      console.log("TEST SEED ERROR", err);
    }
  };

  const handleLogin = async () => {
    const trimmed = pseudo.trim();

    if (!trimmed) {
      return Alert.alert("Pseudo manquant", "Entre ton pseudo.");
    }
    if (!password) {
      return Alert.alert("Mot de passe manquant", "Entre ton mot de passe.");
    }

    const emailFake = buildEmail(trimmed);

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

  const handleTestLogin = async () => {
    const emailFake = buildEmail(TEST_PSEUDO);

    try {
      setTestLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailFake,
        password: TEST_PASSWORD,
      });

      if (!error && data.session) {
        await seedTestAccount(data.session.user.id);
        return;
      }

      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: emailFake,
          password: TEST_PASSWORD,
          options: {
            data: {
              pseudo: TEST_PSEUDO,
              gender: "male",
              allowMixed: true,
              department: "75",
              allowInterDept: true,
              bio: TEST_BIO,
              sports: TEST_SPORTS,
            },
          },
        });

      if (signUpError) {
        if (!error) {
          return Alert.alert(
            "Erreur",
            "Impossible de créer le compte test."
          );
        }
      }

      if (signUpData.session?.user?.id) {
        await seedTestAccount(signUpData.session.user.id);
        return;
      }

      if (!signUpData.session) {
        Alert.alert(
          "Compte test créé",
          "Connexion en attente. Si besoin, désactive la confirmation email dans Supabase."
        );
      }
    } catch (e: any) {
      console.log("TEST LOGIN ERROR", e);
      Alert.alert("Erreur", e.message || "Une erreur est survenue");
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <ScreenContainer showHeader={false} showFooter={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={
          Platform.OS === "ios" ? insets.top + 20 : 0
        }
      >
        <ScrollView
          contentContainerStyle={[
            {
              paddingTop: insets.top + 24,
              paddingBottom: insets.bottom + 32,
              paddingHorizontal: isTiny ? 16 : 24,
              gap: 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSection}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("GuestTabs", { screen: "AccueilInvite" })
              }
              activeOpacity={0.85}
              style={[
                styles.logoStack,
                isCompact ? styles.logoStackCompact : null,
                isTiny ? styles.logoStackTiny : null,
              ]}
            >
              <View
                style={[
                  styles.logoHalo,
                  isCompact ? styles.logoHaloCompact : null,
                  isTiny ? styles.logoHaloTiny : null,
                ]}
              />
              <LogoMark size={isTiny ? 60 : isCompact ? 68 : 76} />
            </TouchableOpacity>
            <Text
              style={[
                styles.heroTitle,
                isTiny ? styles.heroTitleTiny : null,
              ]}
            >
              IMMORTAL ARENA
            </Text>
            <Text style={styles.heroSubtitle}>
              Performance. Discipline. Prestige.
            </Text>
            <View
              style={[
                styles.heroStats,
                isTiny ? styles.heroStatsTiny : null,
              ]}
            >
              <View
                style={[
                  styles.heroStat,
                  isTiny ? styles.heroStatTiny : null,
                ]}
              >
                <Text style={styles.statValue}>+45</Text>
                <Text style={styles.statLabel}>Performances</Text>
              </View>
              <View
                style={[
                  styles.heroStat,
                  isTiny ? styles.heroStatTiny : null,
                ]}
              >
                <Text style={styles.statValue}>12</Text>
                <Text style={styles.statLabel}>Disciplines</Text>
              </View>
            </View>
          </View>

          <View style={[styles.card, isCompact ? styles.cardCompact : null]}>
            <Text style={[styles.cardTitle, isTiny ? styles.cardTitleTiny : null]}>
              Connexion
            </Text>
            <Text style={[styles.cardSubtitle, isTiny ? styles.cardSubtitleTiny : null]}>
              Rentre sur l'arène et garde ton rythme.
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
              label="Connexion test"
              onPress={handleTestLogin}
              loading={testLoading}
              variant="ghost"
              style={{ marginTop: 12 }}
            />

            <AppButton
              label="Créer un compte"
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
  heroSection: {
    alignItems: "center",
  },
  logoStack: {
    width: 180,
    height: 180,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  logoStackCompact: {
    width: 150,
    height: 150,
  },
  logoStackTiny: {
    width: 130,
    height: 130,
  },
  logoHalo: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 40,
    backgroundColor: "rgba(212,175,55,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  logoHaloCompact: {
    width: 140,
    height: 140,
  },
  logoHaloTiny: {
    width: 120,
    height: 120,
  },
  heroTitle: {
    ...TYPO.display,
    color: COLORS.primary,
    marginTop: 6,
  },
  heroTitleTiny: {
    fontSize: 22,
    letterSpacing: 1.2,
  },
  heroSubtitle: {
    ...TYPO.subtitle,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
  heroStats: {
    flexDirection: "row",
    marginTop: 18,
    gap: 14,
  },
  heroStatsTiny: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
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
  heroStatTiny: {
    minWidth: "100%",
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
    backgroundColor: "rgba(14,14,18,0.92)",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.25)",
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  cardCompact: {
    padding: 16,
    borderRadius: 18,
  },
  cardTitle: {
    ...TYPO.display,
    color: COLORS.text,
    marginBottom: 4,
  },
  cardTitleTiny: {
    fontSize: 22,
  },
  cardSubtitle: {
    ...TYPO.subtitle,
    color: COLORS.textMuted,
    marginBottom: 18,
  },
  cardSubtitleTiny: {
    fontSize: 13,
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
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: COLORS.text,
    backgroundColor: "rgba(5,5,7,0.9)",
  },
});