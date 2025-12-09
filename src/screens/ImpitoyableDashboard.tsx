// src/screens/ImpitoyableDashboard.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextStyle,
  ViewStyle,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { COLORS } from "../theme";
import FairPlayAlert from "../components/FairPlayAlert";
import { ARENA_FAIR_PLAY_THRESHOLD } from "../services/arenaLive";
import AppButton from "../components/AppButton";
import { notifyCoachObjective, logNotification } from "../notifications";

type Stats = {
  level: number;
  points: number;
  title?: string;
  fair_play_score?: number;
};

type Wallet = {
  coins: number;
};

type Punishment = {
  ads_remaining: number;
  active: boolean;
  id?: number;
  created_at?: string;
  resolved_at?: string | null;
};

type ActivityRow = {
  id: number;
  message: string;
  created_at: string;
};

const COACH_OBJECTIVES = [
  "Balance 2 défis cette semaine pour rester affûté.",
  "Publie une preuve vidéo clean après ton prochain défi.",
  "Échauffe-toi 10 min avant un Arena Live pour ne pas te crisper.",
];

export default function ImpitoyableDashboard({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [punishment, setPunishment] = useState<Punishment | null>(null);
  const [punishmentHistory, setPunishmentHistory] = useState<Punishment[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [coachNotifications, setCoachNotifications] = useState<any[]>([]);
  const [objectiveStates, setObjectiveStates] = useState(
    COACH_OBJECTIVES.map(() => false)
  );
  const [objectiveLoading, setObjectiveLoading] = useState<number | null>(null);
  const [showCoachTips, setShowCoachTips] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        setStats(null);
        setWallet(null);
        setPunishment(null);
        setActivities([]);
        return;
      }

      const [statsRes, walletRes, punishRes, activRes, punishHistoryRes, notificationsRes] =
        await Promise.all([
        supabase
          .from("players_stats")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("wallets")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("punishments")
          .select("*")
          .eq("user_id", userId)
          .eq("active", true)
          .maybeSingle(),
        supabase
          .from("activities")
          .select("*")
          .eq("user_id", userId)
          .in("type", ["arena_finished", "battle_finished"])
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("punishments")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("coach_notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      setStats(statsRes.data as Stats | null);
      setWallet(walletRes.data as Wallet | null);
      setPunishment(punishRes.data as Punishment | null);
      setActivities((activRes.data as ActivityRow[]) || []);
      setPunishmentHistory((punishHistoryRes.data as Punishment[]) || []);
      setCoachNotifications((notificationsRes.data as any[]) || []);

      if (sessionData.session) {
        const tipsSeen =
          sessionData.session.user.user_metadata?.seenCoachTips === true;
        setShowCoachTips(!tipsSeen);
      }
    } catch (e) {
      console.log("IMPITOYABLE DASH ERROR", e);
      setStats(null);
      setWallet(null);
      setPunishment(null);
      setActivities([]);
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

  const handleCompleteObjective = async (index: number) => {
    if (objectiveStates[index]) return;
    try {
      setObjectiveLoading(index);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;

      await supabase.from("activities").insert({
        user_id: userId,
        type: "coach_objective_done",
        challenge_id: null,
        message: `Objectif coach valide : ${COACH_OBJECTIVES[index]}`,
      });

      const bonus = 5;
      const currentCoins = wallet?.coins || 0;
      await supabase
        .from("wallets")
        .upsert({ user_id: userId, coins: currentCoins + bonus });
      setWallet({ coins: currentCoins + bonus });
      await notifyCoachObjective("Objectif coach valide ! +5 coins pour toi.");
      await logNotification(
        {
          title: "Objectif valide",
          body: COACH_OBJECTIVES[index],
        },
        "coach"
      );

      setObjectiveStates((prev) =>
        prev.map((v, idx) => (idx === index ? true : v))
      );
    } catch (err) {
      console.log("COACH OBJECTIVE ERROR", err);
    } finally {
      setObjectiveLoading(null);
    }
  };

  const handleDismissCoachTips = useCallback(async () => {
    setShowCoachTips(false);
    try {
      const { data: ses } = await supabase.auth.getSession();
      if (!ses.session) {
        return;
      }
      await supabase.auth.updateUser({
        data: {
          ...ses.session.user.user_metadata,
          seenCoachTips: true,
        },
      });
    } catch (err) {
      console.log("COACH TIPS DISMISS ERROR", err);
    }
  }, []);

  if (loading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
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
        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            color: COLORS.text,
            marginBottom: 16,
          }}
        >
          Coach de rue
        </Text>

        <FairPlayAlert
          score={stats?.fair_play_score ?? 100}
          threshold={ARENA_FAIR_PLAY_THRESHOLD}
          message="Fair-play limite ? Reviens propre sinon l'Arena se ferme."
          onCtaPress={() => navigation.navigate("FairPlayHelp")}
          ctaLabel="Rappels fair-play"
        />

        <View style={cardStyle}>
          <Text style={cardTitle}>Ordre du jour</Text>
          <Text style={cardMuted}>
            Le coach veut te voir actif. Monte un live, va provoquer ton rival,
            ou ramasse ta récompense.
          </Text>
          <View style={{ marginTop: 12, flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <AppButton
              label="Page Live"
              onPress={() => navigation.navigate("LiveHub")}
              size="sm"
            />
            <AppButton
              label="Rivalité"
              variant="ghost"
              size="sm"
              onPress={() => navigation.reset({index: 0, routes: [{name: "MainTabs", params: {screen: "Classement"}}]})}
            />
            <AppButton
              label="Boutique"
              variant="ghost"
              size="sm"
              onPress={() => navigation.reset({index: 0, routes: [{name: "MainTabs", params: {screen: "Boutique"}}]})}
            />
          </View>
        </View>
        {showCoachTips && (
          <View style={cardStyle}>
            <Text style={cardTitle}>Tips du coach</Text>
            <Text style={cardMuted}>
              Comprends les bases : Rivalité, Live, Boutique.
            </Text>
            <View style={{ marginTop: 12, gap: 8 }}>
              <View style={tipCard}>
                <Text style={tipTitle}>Rivalité</Text>
                <Text style={tipText}>
                  Choisis ton camp et déclenche les alertes quand quelqu’un
                  passe devant toi. Réagis vite pour défendre ta place.
                </Text>
              </View>
              <View style={tipCard}>
                <Text style={tipTitle}>Arena Live</Text>
                <Text style={tipText}>
                  Programme ton live et préviens ton crew. Le hub t'aide à
                  partager et à lancer la caméra.
                </Text>
              </View>
              <View style={tipCard}>
                <Text style={tipTitle}>Boutique</Text>
                <Text style={tipText}>
                  Récompense quotidienne + packs de coins. C’est ici que tu
                  recharges avant de provoquer tout le monde.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleDismissCoachTips}
              style={{
                marginTop: 12,
                alignSelf: "flex-end",
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text style={{ color: COLORS.primary, fontWeight: "700" }}>
                J’ai capté
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={cardStyle}>
          <Text style={cardTitle}>Niveau & points</Text>
          <Text style={cardMetric}>
            Niveau {stats?.level || 1} — {stats?.points || 0} pts
          </Text>
          <Text style={cardMuted}>
            Grade : {stats?.title || "Rookie"}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: COLORS.textMuted,
              marginTop: 8,
            }}
          >
            Fair-play : {typeof stats?.fair_play_score === "number"
              ? `${stats?.fair_play_score}/100`
              : "N/A"}
          </Text>
        </View>

        <View style={cardStyle}>
          <Text style={cardTitle}>Cash dispo</Text>
          <Text style={cardMetric}>{wallet?.coins || 0} coins</Text>
          <Text style={cardMuted}>
            Suffisant pour défier en pari ? Sinon direction Boutique.
          </Text>
        </View>

        <View style={cardStyle}>
          <Text style={cardTitle}>Discipline</Text>
          {punishment ? (
            <>
              <Text style={cardMetric}>
                {punishment.ads_remaining} pub(s) à regarder
              </Text>
              <Text style={cardMuted}>Résous ta punition avant de relancer Arena.</Text>
              <View style={{ marginTop: 10 }}>
                <AppButton
                  label="Résoudre maintenant"
                  onPress={() =>
                    navigation.navigate("PunishmentScreen", {
                      adsRemaining: punishment.ads_remaining,
                      punishmentId: punishment.id,
                    })
                  }
                />
              </View>
            </>
          ) : (
            <Text style={cardMuted}>Aucune punition active.</Text>
          )}
        </View>

        <View style={cardStyle}>
          <Text style={cardTitle}>Historique des punitions</Text>
          {punishmentHistory.length === 0 ? (
            <Text style={cardMuted}>Aucune sanction enregistrée.</Text>
          ) : (
            punishmentHistory.map((item) => (
              <View key={item.id} style={{ marginBottom: 8 }}>
                <Text style={cardMuted}>
                  {new Date(item.created_at || "").toLocaleString("fr-FR")}
                </Text>
                <Text style={{ color: COLORS.text }}>
                  {item.active
                    ? `Active • ${item.ads_remaining} pubs restantes`
                    : "Résolue"}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={cardStyle}>
          <Text style={cardTitle}>Derniers coups à l'Arena</Text>
          {activities.length === 0 ? (
            <Text style={cardMuted}>Pas encore de victoire référencée.</Text>
          ) : (
            activities.map((row) => (
              <View key={row.id} style={{ marginBottom: 8 }}>
                <Text style={cardMuted}>
                  {new Date(row.created_at).toLocaleString("fr-FR")}
                </Text>
                <Text style={{ color: COLORS.text }}>{row.message}</Text>
              </View>
            ))
          )}
        </View>

        <View style={cardStyle}>
          <Text style={cardTitle}>Check-list Coach</Text>
          <Text style={cardMuted}>
            Choisis une ligne et valide-la aujourd'hui pour gratter ton bonus.
          </Text>
          {COACH_OBJECTIVES.map((obj, idx) => (
            <View
              key={obj}
              style={{
                marginTop: 8,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 12,
                padding: 10,
              }}
            >
              <Text style={{ color: COLORS.text, marginBottom: 6 }}>{obj}</Text>
              <AppButton
                label={
                  objectiveStates[idx]
                    ? "Objectif validé"
                    : "Valider (+5 coins)"
                }
                onPress={() => handleCompleteObjective(idx)}
                disabled={objectiveStates[idx]}
                loading={objectiveLoading === idx}
                variant={objectiveStates[idx] ? "ghost" : "primary"}
              />
            </View>
          ))}
        </View>

        <View style={cardStyle}>
          <Text style={cardTitle}>Modération (admin)</Text>
          <Text style={cardMuted}>
            Consulte les signalements en attente et décide des sanctions.
          </Text>
          <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
            <AppButton
              label="Ouvrir Arena Reports"
              onPress={() => navigation.navigate("ArenaReports")}
            />
            <AppButton
              label="Notifications coach"
              variant="ghost"
              onPress={() => navigation.navigate("CoachNotifications")}
            />
          </View>
        </View>

        <View style={cardStyle}>
          <Text style={cardTitle}>
            Messages coach{" "}
            {coachNotifications.length > 0
              ? `(${coachNotifications.length})`
              : ""}
          </Text>
          {coachNotifications.length === 0 ? (
            <Text style={cardMuted}>Aucune notification.</Text>
          ) : (
            coachNotifications.map((notif) => (
              <View key={notif.id} style={{ marginBottom: 8 }}>
                <Text style={cardMuted}>
                  {new Date(notif.created_at).toLocaleString("fr-FR")}
                </Text>
                <Text style={{ color: COLORS.text, fontWeight: "700" }}>
                  {notif.title}
                </Text>
                {notif.type && (
                  <Text
                    style={{
                      color: COLORS.primary,
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    {notif.type.toUpperCase()}
                  </Text>
                )}
                <Text style={{ color: COLORS.text }}>{notif.body}</Text>
              </View>
            ))
          )}
        </View>
     </ScrollView>
   </ScreenContainer>
 );
}

const cardStyle: ViewStyle = {
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 18,
  padding: 16,
  marginBottom: 18,
  backgroundColor: COLORS.surface,
};

const cardTitle: TextStyle = {
  fontSize: 16,
  fontWeight: "800",
  color: COLORS.text,
  marginBottom: 6,
};

const cardMetric: TextStyle = {
  fontSize: 18,
  fontWeight: "900",
  color: COLORS.primary,
};

const cardMuted: TextStyle = {
  fontSize: 13,
  color: COLORS.textMuted,
};

const tipCard: ViewStyle = {
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 14,
  padding: 12,
  backgroundColor: "#111827",
};

const tipTitle: TextStyle = {
  fontSize: 14,
  fontWeight: "800",
  color: COLORS.text,
  marginBottom: 4,
};

const tipText: TextStyle = {
  fontSize: 12,
  color: COLORS.textMuted,
};
