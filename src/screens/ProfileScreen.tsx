// src/screens/ProfileScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Button,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import UserAvatar from "../components/UserAvatar";
import { supabase } from "../supabase";
import { COLORS } from "../theme";
import { ARENA_FAIR_PLAY_THRESHOLD } from "../services/arenaLive";
import { getFairPlayTier } from "../utils/fairPlay";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import AppButton from "../components/AppButton";
import HeatBadge from "../components/HeatBadge";
import { GenderValue } from "../types";
import {
  COMPETING_TERRITORIES,
  getDepartmentLabel,
  getDepartmentShortLabel,
} from "../utils/departments";

type WalletRow = {
  user_id: string;
  coins: number;
};

type PlayerStatsRow = {
  user_id: string;
  points: number;
  level: number;
  title: string | null;
};

type ActivityRow = {
  id: number;
  user_id: string;
  type: string;
  message: string | null;
  created_at: string;
};

type Achievement = {
  id: string;
  label: string;
  description: string;
  icon: string;
  unlocked: boolean;
};

const genderChoices: { value: GenderValue; label: string; helper: string }[] = [
  { value: "male", label: "Homme", helper: "Courbe standard" },
  { value: "female", label: "Femme", helper: "Courbe adaptée" },
  { value: "other", label: "Libre", helper: "Mix & match" },
];

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [pseudo, setPseudo] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);
  const [fairPlayScore, setFairPlayScore] = useState(100);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [gender, setGender] = useState<GenderValue>("male");
  const [allowMixed, setAllowMixed] = useState(true);
  const [allowInterDept, setAllowInterDept] = useState(true);
  const [department, setDepartment] = useState("75");

  const [coins, setCoins] = useState(0);
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [title, setTitle] = useState("Rookie");
  const [dailyStreak, setDailyStreak] = useState(0);

  const [activePunishments, setActivePunishments] = useState(0);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [preferencesSaving, setPreferencesSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const { data: ses } = await supabase.auth.getSession();
      const user = ses.session?.user || null;
      if (!user) {
        setUserId(null);
        setPseudo("");
        setAvatarUrl(null);
        setCoins(0);
        setPoints(0);
        setLevel(1);
        setTitle("Rookie");
        setActivePunishments(0);
        setActivities([]);
        setGender("male");
        setAllowMixed(true);
        setAllowInterDept(true);
        setDepartment("75");
        return;
      }

      setUserId(user.id);
      const metaPseudo =
        user.user_metadata?.pseudo || user.email || "Joueur";
      setPseudo(metaPseudo);
      setAvatarUrl(user.user_metadata?.avatar_url || null);
      const metaGender = (user.user_metadata?.gender as GenderValue) || "male";
      const allowMixedPref =
        typeof user.user_metadata?.allowMixed === "boolean"
          ? (user.user_metadata?.allowMixed as boolean)
          : true;
      const allowInterDeptPref =
        typeof user.user_metadata?.allowInterDept === "boolean"
          ? (user.user_metadata?.allowInterDept as boolean)
          : true;
      const userDepartment =
        typeof user.user_metadata?.department === "string"
          ? (user.user_metadata?.department as string)
          : "75";
      setGender(metaGender);
      setAllowMixed(allowMixedPref);
      setAllowInterDept(allowInterDeptPref);
      setDepartment(userDepartment);

      // Wallet
      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (wallet) {
        const w = wallet as WalletRow;
        setCoins(w.coins || 0);
      } else {
        setCoins(0);
      }

      const { data: dailyRow } = await supabase
        .from("daily_rewards")
        .select("streak")
        .eq("user_id", user.id)
        .maybeSingle();
      setDailyStreak(((dailyRow as any)?.streak as number) || 0);

      // Stats joueur
      const { data: stats } = await supabase
        .from("players_stats")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (stats) {
        const s = stats as PlayerStatsRow;
        setPoints(s.points || 0);
        setLevel(s.level || 1);
        setTitle(s.title || "Rookie");
        setFairPlayScore(
          typeof (s as any).fair_play_score === "number"
            ? (s as any).fair_play_score
            : 100
        );
      } else {
        setPoints(0);
        setLevel(1);
        setTitle("Rookie");
        setFairPlayScore(100);
      }

      // Punitions actives
      const { count: punishCount, error: punishError } = await supabase
        .from("punishments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("active", true);

      if (!punishError && typeof punishCount === "number") {
        setActivePunishments(punishCount);
      } else {
        setActivePunishments(0);
      }

      // Activités du joueur (pour les badges)
      const { data: acts } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (acts) {
        setActivities(acts as ActivityRow[]);
      } else {
        setActivities([]);
      }
    } catch (e) {
      console.log("PROFILE LOAD ERROR", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Impossible de se déconnecter.");
    }
  };

  const handleSavePreferences = async () => {
    if (!userId) return;
    try {
      setPreferencesSaving(true);
      const { data: ses } = await supabase.auth.getSession();
      const user = ses.session?.user;
      if (!user) {
        Alert.alert("Non connect?", "Reconnecte-toi pour mettre ton profil ? jour.");
        return;
      }

      await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          pseudo,
          gender,
          allowMixed,
          allowInterDept,
          department,
        },
      });

      try {
        await supabase.from("profiles").upsert(
          {
            user_id: user.id,
            pseudo,
            gender,
            allow_mixed: allowMixed,
            allow_inter_department: allowInterDept,
            department,
          },
          { onConflict: "user_id" }
        );
      } catch (profileErr) {
        console.log("PROFILE PREF UPSERT ERROR", profileErr);
      }

      Alert.alert("Pr?f?rences mises ? jour");
    } catch (err: any) {
      Alert.alert("Erreur", err.message || "Impossible de mettre ? jour.");
    } finally {
      setPreferencesSaving(false);
    }
  };

  const computeNextLevelInfo = () => {
    // simple: 100 points par niveau
    const currentLevel = level || 1;
    const base = (currentLevel - 1) * 100;
    const next = currentLevel * 100;
    const clampedPoints = Math.max(points, 0);

    const progressRaw =
      next - base > 0 ? (clampedPoints - base) / (next - base) : 0;
    const progress = Math.max(0, Math.min(1, progressRaw));

    const remaining = Math.max(next - clampedPoints, 0);

    return { progress, remaining, next };
  };

  const computeAchievements = (): Achievement[] => {
    const createdCount = activities.filter(
      (a) => a.type === "challenge_created"
    ).length;
    const responseCount = activities.filter(
      (a) => a.type === "challenge_response"
    ).length;
    const battleFinishedCount = activities.filter(
      (a) => a.type === "battle_finished"
    ).length;
    const dailyBonusCount = activities.filter(
      (a) => a.type === "daily_bonus"
    ).length;
    const shopPurchaseCount = activities.filter(
      (a) => a.type === "shop_purchase"
    ).length;

    const list: Achievement[] = [
      {
        id: "rookie",
        label: "Rookie du bloc",
        description: "Tu es entré dans l’arène. Bienvenue.",
        icon: "🎧",
        unlocked: level >= 1,
      },
      {
        id: "builder",
        label: "Street Architect",
        description: "3 défis créés ou plus.",
        icon: "🧱",
        unlocked: createdCount >= 3,
      },
      {
        id: "fighter",
        label: "Clash Addict",
        description: "3 réponses à des défis.",
        icon: "🥊",
        unlocked: responseCount >= 3,
      },
      {
        id: "clutch",
        label: "Clutch Master",
        description: "Tu as fini au moins 1 battle classée.",
        icon: "🏆",
        unlocked: battleFinishedCount >= 1,
      },
      {
        id: "grinder",
        label: "XP Grinder",
        description: "300 points ou plus au compteur.",
        icon: "⚡",
        unlocked: points >= 300,
      },
      {
        id: "rich",
        label: "Coin Dealer",
        description: "500 coins ou plus dans le wallet.",
        icon: "💰",
        unlocked: coins >= 500,
      },
      {
        id: "loyal",
        label: "Daily Hustler",
        description: "Tu as pris la récompense quotidienne 5 fois.",
        icon: "📆",
        unlocked: dailyBonusCount >= 5,
      },
      {
        id: "spender",
        label: "Big Spender",
        description: "Tu as déjà acheté des coins en boutique (fictif).",
        icon: "🛒",
        unlocked: shopPurchaseCount >= 1,
      },
    ];

    return list;
  };

  const { progress, remaining, next } = computeNextLevelInfo();
  const progressPercent = Math.round(progress * 100);
  const achievements = computeAchievements();
  const heatScore = activities.filter((a) => a.type === "heat_share").length;
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  if (loading) {
    return (
      <ScreenContainer>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!userId) {
    return (
      <ScreenContainer>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: COLORS.text,
              marginBottom: 8,
            }}
          >
            Non connecté
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: COLORS.textMuted,
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            Connecte-toi pour voir ton profil, tes coins, ton rang et tes
            badges.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const fairPlayTier = getFairPlayTier(fairPlayScore);
  const isArenaLocked = fairPlayScore < ARENA_FAIR_PLAY_THRESHOLD;

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER IDENTITE */}
        <View style={styles.identityCard}>
          <UserAvatar
            uri={avatarUrl || undefined}
            label={pseudo || "Joueur"}
            size={64}
          />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "900",
                color: COLORS.text,
                marginBottom: 4,
              }}
            >
              {pseudo}
            </Text>
          <Text
            style={{
              fontSize: 14,
              color: COLORS.textMuted,
              marginBottom: 4,
            }}
          >
            {title} - Niveau {level}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: COLORS.textMuted,
              marginBottom: 4,
            }}
          >
            Territoire : {getDepartmentLabel(department) || department}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: COLORS.textMuted,
              marginBottom: 4,
            }}
          >
            Fair-play : {fairPlayScore}/100
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: fairPlayTier.color,
              marginBottom: 4,
            }}
          >
            Tier : {fairPlayTier.label}
          </Text>
          {isArenaLocked && (
            <Text
              style={{
                fontSize: 12,
                color: "#f87171",
              }}
            >
              Arena verrouillée tant que tu restes sous {ARENA_FAIR_PLAY_THRESHOLD}.
            </Text>
          )}
            <Text
              style={{
                fontSize: 14,
                color: COLORS.primary,
              }}
            >
              ID : {userId.slice(0, 4)}...{userId.slice(-4)}
            </Text>
            {heatScore > 0 && <HeatBadge heat={heatScore} />}
          </View>
        </View>

        <View style={styles.card}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: COLORS.text,
              marginBottom: 6,
            }}
          >
            Profil de performance
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: COLORS.textMuted,
              marginBottom: 10,
            }}
          >
            On calibre les recommandations selon ta courbe. Tu peux quand
            même basculer en mode mixte.
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 12,
            }}
          >
            {genderChoices.map((choice) => {
              const active = gender === choice.value;
              return (
                <TouchableOpacity
                  key={choice.value}
                  onPress={() => setGender(choice.value)}
                  activeOpacity={0.85}
                  style={{
                    flex: 1,
                    minWidth: 90,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: active ? COLORS.primary : COLORS.border,
                    backgroundColor: active ? COLORS.primary : COLORS.card,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text
                    style={{
                      textAlign: "center",
                      color: active ? "#050505" : COLORS.textMuted,
                      fontWeight: "700",
                    }}
                  >
                    {choice.label}
                  </Text>
                  <Text
                    style={{
                      textAlign: "center",
                      color: active ? "#050505" : COLORS.textMuted,
                      fontSize: 11,
                    }}
                  >
                    {choice.helper}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: COLORS.text,
                marginBottom: 6,
              }}
            >
              Choisis ton camp (IDF ou Tarn-et-Garonne)
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.text, fontWeight: "700", marginBottom: 6 }}>
                  Île-de-France
                </Text>
                <View style={{ gap: 8 }}>
                  {COMPETING_TERRITORIES.filter((dep) =>
                    dep.code.startsWith("7")
                  ).map((dep) => {
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
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? "#050505" : COLORS.textMuted,
                            fontWeight: "800",
                          }}
                        >
                          {dep.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.text, fontWeight: "700", marginBottom: 6 }}>
                  Tarn-et-Garonne
                </Text>
                <View style={{ gap: 8 }}>
                  {COMPETING_TERRITORIES.filter((dep) =>
                    dep.code.startsWith("82")
                  ).map((dep) => {
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
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? "#050505" : COLORS.textMuted,
                            fontWeight: "800",
                          }}
                        >
                          {dep.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: COLORS.text,
              }}
            >
              Mode mixte activé
            </Text>
            <Switch value={allowMixed} onValueChange={setAllowMixed} />
          </View>
          <Text style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 10 }}>
            Désactive si tu veux rester dans ta ligue jusqu'à être prête à te
            mesurer à tout le monde.
          </Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: COLORS.text,
              }}
            >
              Duels inter-territoires
            </Text>
            <Switch
              value={allowInterDept}
              onValueChange={setAllowInterDept}
            />
          </View>
          <Text
            style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 10 }}
          >
            Quand c'est désactivé, on te propose prioritairement ton
            territoire. Tu peux toujours ouvrir un défi adverse manuellement.
          </Text>
          <AppButton
            label={
              preferencesSaving
                ? "Sauvegarde..."
                : "Mettre à jour mes préférences"
            }
            onPress={handleSavePreferences}
            loading={preferencesSaving}
          />
        </View>

        {/* STATS & PROGRESSION */}
        <View style={styles.card}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: COLORS.text,
              marginBottom: 8,
            }}
          >
            Montée en puissance
          </Text>

          <Text
            style={{
              fontSize: 13,
              color: COLORS.textMuted,
              marginBottom: 4,
            }}
          >
            Points : {points}
          </Text>

          <View
            style={{
              height: 10,
              borderRadius: 999,
              backgroundColor: "#111827",
              overflow: "hidden",
              marginTop: 6,
              marginBottom: 4,
            }}
          >
            <View
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                backgroundColor: COLORS.primary,
              }}
            />
          </View>

          <Text
            style={{
              fontSize: 12,
              color: COLORS.textMuted,
            }}
          >
            {progressPercent}% vers le niveau {level + 1} • Il te manque{" "}
            {remaining} points (seuil : {next} pts)
          </Text>
        </View>

        {/* COINS & PUNITIONS */}
        <View style={styles.card}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: COLORS.text,
              marginBottom: 8,
            }}
          >
            Etat du coffre
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: COLORS.primary,
              marginBottom: 4,
            }}
          >
            Coins : {coins}
          </Text>

          <Text
            style={{
              fontSize: 13,
              color: activePunishments > 0 ? "#f97316" : COLORS.textMuted,
              marginBottom: 4,
            }}
          >
            Punitions actives : {activePunishments}
          </Text>

          {activePunishments > 0 && (
        <Text
          style={{
            fontSize: 12,
            color: COLORS.textMuted,
            marginTop: 4,
          }}
        >
          Tu dois finir tes punitions (pubs) avant de pouvoir rejouer des
          défis classés normalement.
        </Text>
      )}
    </View>

        <View style={styles.card}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: COLORS.text,
              marginBottom: 6,
            }}
          >
            Rituel quotidien
          </Text>
          <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
            Récompenses quotidiennes prises consécutivement.
          </Text>
          <Text
            style={{
              color: COLORS.primary,
              fontWeight: "900",
              fontSize: 24,
              marginTop: 8,
            }}
          >
            {dailyStreak}🔥
          </Text>
        </View>

        <View style={{ marginBottom: 18, gap: 12 }}>
          <AppButton
            label="Historique du cash"
            variant="ghost"
            onPress={() => navigation.navigate("WalletHistory")}
          />
          <AppButton
            label="Défis Arena"
            variant="ghost"
            onPress={() => navigation.navigate("ArenaChallenges")}
          />
        </View>

        {/* BADGES / ACHIEVEMENTS */}
        <View style={styles.card}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: COLORS.text,
              marginBottom: 4,
            }}
          >
            Trophées de rue
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: COLORS.textMuted,
              marginBottom: 10,
            }}
          >
            Trophées débloqués : {unlockedCount} / {achievements.length}
          </Text>

          {achievements.map((a) => {
            const bg = a.unlocked ? "#111827" : "#020617";
            const border = a.unlocked ? COLORS.primary : COLORS.border;
            const textColor = a.unlocked ? COLORS.text : COLORS.textMuted;

            return (
              <View
                key={a.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  marginBottom: 6,
                  backgroundColor: bg,
                  borderWidth: 1,
                  borderColor: border,
                }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    marginRight: 10,
                  }}
                >
                  {a.icon}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "800",
                      color: textColor,
                    }}
                  >
                    {a.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: COLORS.textMuted,
                    }}
                  >
                    {a.description}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: a.unlocked ? COLORS.primary : COLORS.textMuted,
                  }}
                >
                  {a.unlocked ? "UNLOCKED" : "LOCKED"}
                </Text>
              </View>
            );
          })}
        </View>

        {/* BOUTON DECONNEXION */}
        <View style={{ marginTop: 8 }}>
          <Button title="Se déconnecter" onPress={handleLogout} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  identityCard: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#020617",
    flexDirection: "row",
    alignItems: "center",
  },
  card: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
});
