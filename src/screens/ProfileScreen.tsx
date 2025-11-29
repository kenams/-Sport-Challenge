// src/screens/ProfileScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Button,
  Alert,
  ScrollView,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { COLORS } from "../theme";

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

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [pseudo, setPseudo] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);

  const [coins, setCoins] = useState(0);
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [title, setTitle] = useState("Rookie");

  const [activePunishments, setActivePunishments] = useState(0);
  const [activities, setActivities] = useState<ActivityRow[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const { data: ses } = await supabase.auth.getSession();
      const user = ses.session?.user || null;
      if (!user) {
        setUserId(null);
        setPseudo("");
        setCoins(0);
        setPoints(0);
        setLevel(1);
        setTitle("Rookie");
        setActivePunishments(0);
        setActivities([]);
        return;
      }

      setUserId(user.id);
      const metaPseudo =
        user.user_metadata?.pseudo || user.email || "Joueur";
      setPseudo(metaPseudo);

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
      } else {
        setPoints(0);
        setLevel(1);
        setTitle("Rookie");
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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Impossible de se déconnecter.");
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

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER IDENTITE */}
        <View
          style={{
            marginBottom: 18,
            padding: 14,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: "#020617",
          }}
        >
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
            {title} • Niveau {level}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: COLORS.primary,
            }}
          >
            ID : {userId.slice(0, 4)}…{userId.slice(-4)}
          </Text>
        </View>

        {/* STATS & PROGRESSION */}
        <View
          style={{
            marginBottom: 18,
            padding: 14,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: "#020617",
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: COLORS.text,
              marginBottom: 8,
            }}
          >
            Progression
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
        <View
          style={{
            marginBottom: 18,
            padding: 14,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: "#020617",
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: COLORS.text,
              marginBottom: 8,
            }}
          >
            Statut de jeu
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

        {/* BADGES / ACHIEVEMENTS */}
        <View
          style={{
            marginBottom: 18,
            padding: 14,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: "#020617",
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: COLORS.text,
              marginBottom: 4,
            }}
          >
            Badges
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: COLORS.textMuted,
              marginBottom: 10,
            }}
          >
            Badges débloqués : {unlockedCount} / {achievements.length}
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
