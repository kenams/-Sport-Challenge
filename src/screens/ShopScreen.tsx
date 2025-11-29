// src/screens/ShopScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
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

type DailyRow = {
  user_id: string;
  last_claimed_at: string;
  streak: number;
};

type Offer = {
  id: string;
  label: string;
  description: string;
  coins: number;
  priceLabel: string;
  highlight?: boolean;
};

const OFFERS: Offer[] = [
  {
    id: "starter",
    label: "Pack Starter",
    description: "Boost léger pour lancer tes défis.",
    coins: 100,
    priceLabel: "1,99 € (fictif)",
  },
  {
    id: "street",
    label: "Pack Street",
    description: "De quoi spammer quelques défis classés.",
    coins: 300,
    priceLabel: "3,99 € (fictif)",
    highlight: true,
  },
  {
    id: "pro",
    label: "Pack Pro",
    description: "Tu veux dominer le classement.",
    coins: 800,
    priceLabel: "7,99 € (fictif)",
  },
  {
    id: "boss",
    label: "Pack Boss",
    description: "Pour les gros tryharders du game.",
    coins: 2000,
    priceLabel: "14,99 € (fictif)",
  },
];

const DAILY_REWARD_AMOUNT = 50;

export default function ShopScreen() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [coins, setCoins] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState<string>("");

  const [dailyInfo, setDailyInfo] = useState<DailyRow | null>(null);
  const [canClaimDaily, setCanClaimDaily] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: ses } = await supabase.auth.getSession();
      const user = ses.session?.user || null;

      if (!user) {
        setUserId(null);
        setPseudo("");
        setCoins(0);
        setDailyInfo(null);
        setCanClaimDaily(false);
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
        await supabase.from("wallets").insert({
          user_id: user.id,
          coins: 0,
        });
        setCoins(0);
      }

      // Daily reward
      const { data: daily } = await supabase
        .from("daily_rewards")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (daily) {
        const d = daily as DailyRow;
        setDailyInfo(d);

        const last = new Date(d.last_claimed_at).getTime();
        const now = Date.now();
        const diffMs = now - last;

        const canClaim = diffMs >= 24 * 60 * 60 * 1000;
        setCanClaimDaily(canClaim);
      } else {
        // jamais réclamé → peut claim
        setDailyInfo(null);
        setCanClaimDaily(true);
      }
    } catch (e) {
      console.log("SHOP LOAD ERROR", e);
      setCoins(0);
      setDailyInfo(null);
      setCanClaimDaily(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBuy = async (offer: Offer) => {
    if (!userId) {
      Alert.alert(
        "Non connecté",
        "Connecte-toi pour acheter des coins (tests)."
      );
      return;
    }
    if (processing) return;

    setProcessing(true);
    try {
      // Récupérer le wallet actuel
      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      let currentCoins = 0;
      if (wallet) {
        currentCoins = (wallet as any).coins || 0;
      } else {
        await supabase.from("wallets").insert({
          user_id: userId,
          coins: 0,
        });
        currentCoins = 0;
      }

      const newCoins = currentCoins + offer.coins;

      const { error: updError } = await supabase
        .from("wallets")
        .update({ coins: newCoins })
        .eq("user_id", userId);

      if (updError) {
        console.log("SHOP UPDATE WALLET ERROR", updError);
        Alert.alert("Erreur", "Impossible de mettre à jour les coins.");
        setProcessing(false);
        return;
      }

      setCoins(newCoins);

      // Enregistrer une activité "achat"
      const { data: ses } = await supabase.auth.getSession();
      const pseudoActivity =
        ses.session?.user.user_metadata?.pseudo ||
        ses.session?.user.email ||
        "Un joueur";

      await supabase.from("activities").insert({
        user_id: userId,
        pseudo: pseudoActivity,
        type: "shop_purchase",
        challenge_id: null,
        message: `${pseudoActivity} a acheté ${offer.coins} coins (${offer.label})`,
      });

      Alert.alert(
        "Coins ajoutés",
        `Tu viens de recevoir ${offer.coins} coins.`
      );
    } catch (e: any) {
      console.log("SHOP BUY ERROR", e);
      Alert.alert("Erreur", e.message || "Impossible d'ajouter les coins.");
    } finally {
      setProcessing(false);
    }
  };

  const handleClaimDaily = async () => {
    if (!userId) {
      Alert.alert(
        "Non connecté",
        "Connecte-toi pour prendre ta récompense quotidienne."
      );
      return;
    }
    if (!canClaimDaily) {
      Alert.alert(
        "Déjà prise",
        "Tu as déjà pris ta récompense aujourd'hui. Reviens demain."
      );
      return;
    }
    if (processing) return;

    setProcessing(true);
    try {
      // 1️⃣ Récupérer wallet
      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      let currentCoins = 0;
      if (wallet) {
        currentCoins = (wallet as any).coins || 0;
      } else {
        await supabase.from("wallets").insert({
          user_id: userId,
          coins: 0,
        });
        currentCoins = 0;
      }

      const reward = DAILY_REWARD_AMOUNT;
      const newCoins = currentCoins + reward;

      const nowIso = new Date().toISOString();
      let newStreak = 1;

      // 2️⃣ Gérer la streak
      if (dailyInfo) {
        const last = new Date(dailyInfo.last_claimed_at).getTime();
        const now = Date.now();
        const diffMs = now - last;

        // Si le joueur revient entre 24h et 48h → streak++
        if (diffMs >= 24 * 60 * 60 * 1000 && diffMs <= 48 * 60 * 60 * 1000) {
          newStreak = (dailyInfo.streak || 1) + 1;
        } else {
          // Sinon streak reset à 1
          newStreak = 1;
        }

        const { error: updDailyError } = await supabase
          .from("daily_rewards")
          .update({
            last_claimed_at: nowIso,
            streak: newStreak,
          })
          .eq("user_id", userId);

        if (updDailyError) {
          console.log("DAILY UPDATE ERROR", updDailyError);
        }
      } else {
        // Première fois
        const { error: insDailyError } = await supabase.from("daily_rewards").insert(
          {
            user_id: userId,
            last_claimed_at: nowIso,
            streak: 1,
          }
        );
        if (insDailyError) {
          console.log("DAILY INSERT ERROR", insDailyError);
        }
        newStreak = 1;
      }

      setDailyInfo({
        user_id: userId,
        last_claimed_at: nowIso,
        streak: newStreak,
      });
      setCanClaimDaily(false);

      // 3️⃣ Mettre à jour wallet
      const { error: walletUpdateError } = await supabase
        .from("wallets")
        .update({ coins: newCoins })
        .eq("user_id", userId);

      if (walletUpdateError) {
        console.log("DAILY WALLET UPDATE ERROR", walletUpdateError);
        Alert.alert(
          "Attention",
          "Récompense enregistrée, mais erreur sur la mise à jour des coins."
        );
      } else {
        setCoins(newCoins);
      }

      // 4️⃣ Activité
      const { data: ses } = await supabase.auth.getSession();
      const pseudoActivity =
        ses.session?.user.user_metadata?.pseudo ||
        ses.session?.user.email ||
        "Un joueur";

      await supabase.from("activities").insert({
        user_id: userId,
        pseudo: pseudoActivity,
        type: "daily_bonus",
        challenge_id: null,
        message: `${pseudoActivity} a pris sa récompense quotidienne (+${reward} coins)`,
      });

      Alert.alert(
        "Récompense prise",
        `Tu viens de recevoir ${reward} coins. Streak: ${newStreak}.`
      );
    } catch (e: any) {
      console.log("DAILY CLAIM ERROR", e);
      Alert.alert("Erreur", e.message || "Impossible de prendre la récompense.");
    } finally {
      setProcessing(false);
    }
  };

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

  const dailyLabel = canClaimDaily
    ? "Prendre ma récompense quotidienne"
    : "Récompense déjà prise aujourd'hui";

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
            marginBottom: 8,
          }}
        >
          Boutique
        </Text>

        <Text
          style={{
            fontSize: 13,
            color: COLORS.textMuted,
            marginBottom: 16,
          }}
        >
          Ici tu peux tester l’économie de l’app : récompense quotidienne,
          packs de coins, défis classés…
        </Text>

        {/* BLOC JOUEUR + SOLDE */}
        <View
          style={{
            marginBottom: 18,
            padding: 12,
            borderRadius: 16,
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
            {pseudo || "Joueur"}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: COLORS.textMuted,
              marginBottom: 4,
            }}
          >
            Solde actuel
          </Text>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "900",
              color: COLORS.primary,
            }}
          >
            {coins} coins
          </Text>
        </View>

        {/* BLOC RECOMPENSE QUOTIDIENNE */}
        <View
          style={{
            marginBottom: 18,
            padding: 12,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: canClaimDaily ? COLORS.primary : COLORS.border,
            backgroundColor: "#020617",
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: COLORS.text,
              marginBottom: 6,
            }}
          >
            🎁 Récompense quotidienne
          </Text>

          <Text
            style={{
              fontSize: 13,
              color: COLORS.textMuted,
              marginBottom: 10,
            }}
          >
            Reviens chaque jour pour récupérer des coins gratuits et faire
            tourner la machine. Bonus actuel : {DAILY_REWARD_AMOUNT} coins.
          </Text>

          {dailyInfo && (
            <Text
              style={{
                fontSize: 12,
                color: COLORS.textMuted,
                marginBottom: 8,
              }}
            >
              Streak actuel : {dailyInfo.streak} jour(s) d’affilée.
            </Text>
          )}

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleClaimDaily}
            disabled={!canClaimDaily || processing}
            style={{
              marginTop: 4,
              paddingVertical: 10,
              borderRadius: 999,
              alignItems: "center",
              backgroundColor: canClaimDaily ? COLORS.primary : "#111827",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: canClaimDaily ? "#050505" : COLORS.textMuted,
              }}
            >
              {processing ? "Traitement..." : dailyLabel}
            </Text>
          </TouchableOpacity>
        </View>

        {/* PACKS DE COINS */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: "800",
            color: COLORS.text,
            marginBottom: 10,
          }}
        >
          Packs de coins (fictifs)
        </Text>

        {OFFERS.map((offer) => (
          <TouchableOpacity
            key={offer.id}
            activeOpacity={0.9}
            onPress={() => handleBuy(offer)}
            disabled={processing}
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: offer.highlight
                ? COLORS.primary
                : COLORS.border,
              backgroundColor: offer.highlight ? "#111827" : "#020617",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "800",
                  color: COLORS.text,
                }}
              >
                {offer.label}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: COLORS.primary,
                }}
              >
                +{offer.coins} coins
              </Text>
            </View>

            <Text
              style={{
                fontSize: 12,
                color: COLORS.textMuted,
                marginBottom: 6,
              }}
            >
              {offer.description}
            </Text>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: COLORS.textMuted,
                }}
              >
                {offer.priceLabel}
              </Text>

              <View
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: COLORS.primary,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: "#050505",
                  }}
                >
                  {processing ? "Traitement..." : "Acheter"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ marginTop: 16 }}>
          <Text
            style={{
              fontSize: 11,
              color: COLORS.textMuted,
            }}
          >
            Remarque : pour l’instant, tout est fictif. Ça te permet de tester
            l’économie (coins, paris, punitions, classement) sans vrai paiement.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
