// src/screens/ShopScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextStyle,
  ViewStyle,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { COLORS } from "../theme";
import { ARENA_FAIR_PLAY_THRESHOLD } from "../services/arenaLive";

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
  coins?: number;
  priceLabel: string;
  highlight?: boolean;
};

const COIN_OFFERS: Offer[] = [
  {
    id: "starter",
    label: "Pack Starter",
    description: "Boost léger pour lancer tes défis.",
    coins: 100,
    priceLabel: "1,99€ (fictif)",
  },
  {
    id: "street",
    label: "Pack Street",
    description: "De quoi spammer quelques défis classés.",
    coins: 300,
    priceLabel: "3,99€ (fictif)",
    highlight: true,
  },
  {
    id: "pro",
    label: "Pack Pro",
    description: "Tu veux dominer le classement.",
    coins: 800,
    priceLabel: "7,99€ (fictif)",
  },
  {
    id: "boss",
    label: "Pack Boss",
    description: "Pour les gros tryharders du game.",
    coins: 2000,
    priceLabel: "14,99€ (fictif)",
  },
];

type BadgeOffer = {
  id: string;
  label: string;
  description: string;
  priceLabel: string;
  color: string;
};

const BADGES: BadgeOffer[] = [
  {
    id: "glow",
    label: "Badge Glow Level",
    description: "Rajoute un halo doré autour de tes cartes défi.",
    priceLabel: "500 coins",
    color: "#FACC15",
  },
  {
    id: "steel",
    label: "Badge Steel Core",
    description: "Idéal pour la team muscu, ton pseudo devient métallisé.",
    priceLabel: "400 coins",
    color: "#94A3B8",
  },
  {
    id: "storm",
    label: "Badge Storm",
    description: "Fond électrique sur ton profil pendant 48h.",
    priceLabel: "300 coins",
    color: "#38BDF8",
  },
];

type TicketOffer = {
  id: string;
  label: string;
  description: string;
  requirements: string;
  priceLabel: string;
  priceCoins: number;
  rewardPoints: number;
};

const TICKETS: TicketOffer[] = [
  {
    id: "arena_basic",
    label: "Ticket Arena Basic",
    description: "Autorise 1 Arena Live supplémentaire ce soir.",
    requirements: "Niveau 3+",
    priceLabel: "600 coins",
    priceCoins: 600,
    rewardPoints: 25,
  },
  {
    id: "arena_elite",
    label: "Ticket Arena Elite",
    description: "Débloque un mode pyramidal spécial (mise 1000 coins).",
    requirements: "Niveau 6+",
    priceLabel: "1200 coins",
    priceCoins: 1200,
    rewardPoints: 50,
  },
  {
    id: "revival",
    label: "Ticket Revival",
    description: "Efface la dernière punition subie (1 fois / semaine).",
    requirements: "Niveau 4+",
    priceLabel: "800 coins",
    priceCoins: 800,
    rewardPoints: 40,
  },
];

type BoostOffer = {
  id: string;
  label: string;
  description: string;
  priceCoins: number;
  rewardFairPlay: number;
};

const BOOSTS: BoostOffer[] = [
  {
    id: "boost_light",
    label: "Boost Fair-Play +5",
    description: "Regagne 5 points de fair-play (max 100).",
    priceCoins: 250,
    rewardFairPlay: 5,
  },
  {
    id: "boost_medium",
    label: "Boost Fair-Play +10",
    description: "Signale ta bonne foi, recharge +10.",
    priceCoins: 450,
    rewardFairPlay: 10,
  },
  {
    id: "boost_admin",
    label: "Pardon des arbitres",
    description: "Laisse un mod te faire remonter +15 (fictif).",
    priceCoins: 700,
    rewardFairPlay: 15,
  },
];

const DAILY_REWARD_AMOUNT = 50;

export default function ShopScreen() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [coins, setCoins] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState<string>("");
  const [fairPlayScore, setFairPlayScore] = useState(100);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerPoints, setPlayerPoints] = useState(0);

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
      const metaPseudo = user.user_metadata?.pseudo || user.email || "Joueur";
      setPseudo(metaPseudo);

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

      const { data: daily } = await supabase
        .from("daily_rewards")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (daily) {
        const d = daily as DailyRow;
        setDailyInfo(d);

        const last = new Date(d.last_claimed_at).getTime();
        const diffMs = Date.now() - last;
        setCanClaimDaily(diffMs >= 24 * 60 * 60 * 1000);
      } else {
        setDailyInfo(null);
        setCanClaimDaily(true);
      }

      const { data: stats } = await supabase
        .from("players_stats")
        .select("level,fair_play_score,points")
        .eq("user_id", user.id)
        .maybeSingle();
      if (stats) {
        setPlayerLevel((stats as any).level || 1);
        setFairPlayScore(
          typeof (stats as any).fair_play_score === "number"
            ? (stats as any).fair_play_score
            : 100
        );
        setPlayerPoints((stats as any).points || 0);
      } else {
        setPlayerLevel(1);
        setFairPlayScore(100);
        setPlayerPoints(0);
      }
    } catch (e) {
      console.log("SHOP LOAD ERROR", e);
      setCoins(0);
      setDailyInfo(null);
      setCanClaimDaily(false);
      setPlayerLevel(1);
      setFairPlayScore(100);
      setPlayerPoints(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

const handleBuyCoins = async (offer: Offer) => {
    if (!userId) {
      Alert.alert("Non connecté", "Connecte-toi pour acheter des coins (tests).");
      return;
    }
    if (processing || !offer.coins) return;

    setProcessing(true);
    try {
      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      let currentCoins = wallet ? (wallet as any).coins || 0 : 0;
      if (!wallet) {
        await supabase.from("wallets").insert({
          user_id: userId,
          coins: 0,
        });
      }

      const newCoins = currentCoins + offer.coins;
      const { error: updError } = await supabase
        .from("wallets")
        .update({ coins: newCoins })
        .eq("user_id", userId);

      if (updError) {
        Alert.alert("Erreur", "Impossible de mettre à jour les coins.");
        return;
      }

      setCoins(newCoins);

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
      await supabase.from("wallet_logs").insert({
        user_id: userId,
        delta: offer.coins || 0,
        balance_after: newCoins,
        reason: `Pack ${offer.label}`,
      });

      Alert.alert("Coins ajoutés", `Tu viens de recevoir ${offer.coins} coins.`);
    } catch (err: any) {
      Alert.alert("Erreur", err.message || "Impossible d'ajouter les coins.");
    } finally {
      setProcessing(false);
    }
  };

const handleBuyBoost = async (offer: BoostOffer) => {
    if (!userId) {
      Alert.alert("Non connecté", "Connecte-toi pour acheter un boost.");
      return;
    }
    if (processing) return;
    if (coins < offer.priceCoins) {
      Alert.alert("Coins insuffisants", "Prends ta récompense quotidienne ou achète des packs.");
      return;
    }
    setProcessing(true);
    try {
      const newCoins = coins - offer.priceCoins;
      const updatedFairPlay = Math.min(100, fairPlayScore + offer.rewardFairPlay);
      const { error: walletError } = await supabase
        .from("wallets")
        .update({ coins: newCoins })
        .eq("user_id", userId);
      if (walletError) throw walletError;

      const { error: statsError } = await supabase
        .from("players_stats")
        .update({ fair_play_score: updatedFairPlay })
        .eq("user_id", userId);
      if (statsError) throw statsError;

      setCoins(newCoins);
      setFairPlayScore(updatedFairPlay);

      const { data: ses } = await supabase.auth.getSession();
      const pseudoActivity =
        ses.session?.user.user_metadata?.pseudo ||
        ses.session?.user.email ||
        "Un joueur";
      await supabase.from("activities").insert({
        user_id: userId,
        type: "shop_purchase",
        challenge_id: null,
        message: `${pseudoActivity} a acheté ${offer.label} (+${offer.rewardFairPlay} FP)`,
      });
      await supabase.from("wallet_logs").insert({
        user_id: userId,
        delta: -offer.priceCoins,
        balance_after: newCoins,
        reason: offer.label,
      });

      Alert.alert("Boost appliqué", `Ton fair-play remonte à ${updatedFairPlay}/100.`);
    } catch (err: any) {
      Alert.alert("Erreur", err.message || "Impossible d'appliquer le boost.");
    } finally {
      setProcessing(false);
    }
  };

const handleBuyTicket = async (offer: TicketOffer) => {
    if (!userId) {
      Alert.alert("Non connecté", "Connecte-toi pour acheter des tickets.");
      return;
    }
    if (processing) return;
    if (coins < offer.priceCoins) {
      Alert.alert("Coins insuffisants", "Gagne plus de coins pour acheter ce ticket.");
      return;
    }
    setProcessing(true);
    try {
      const newCoins = coins - offer.priceCoins;
      const newPoints = playerPoints + offer.rewardPoints;

      const { error: walletError } = await supabase
        .from("wallets")
        .update({ coins: newCoins })
        .eq("user_id", userId);
      if (walletError) throw walletError;

      const { error: statsError } = await supabase
        .from("players_stats")
        .update({ points: newPoints })
        .eq("user_id", userId);
      if (statsError) throw statsError;

      setCoins(newCoins);
      setPlayerPoints(newPoints);

      const { data: ses } = await supabase.auth.getSession();
      const pseudoActivity =
        ses.session?.user.user_metadata?.pseudo ||
        ses.session?.user.email ||
        "Un joueur";

      await supabase.from("activities").insert({
        user_id: userId,
        type: "shop_purchase",
        challenge_id: null,
        message: `${pseudoActivity} a acheté ${offer.label} (+${offer.rewardPoints} pts)`,
      });
      await supabase.from("wallet_logs").insert({
        user_id: userId,
        delta: -offer.priceCoins,
        balance_after: newCoins,
        reason: offer.label,
      });

      Alert.alert("Ticket validé", "Tes points progressent et un admin verra ce ticket dans l'historique.");
    } catch (err: any) {
      Alert.alert("Erreur", err.message || "Impossible d'acheter ce ticket.");
    } finally {
      setProcessing(false);
    }
  };

  const handleClaimDaily = async () => {
    if (!userId) {
      Alert.alert("Non connecté", "Connecte-toi pour prendre ta récompense quotidienne.");
      return;
    }
    if (!canClaimDaily || processing) return;

    setProcessing(true);
    try {
      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      let currentCoins = wallet ? (wallet as any).coins || 0 : 0;
      if (!wallet) {
        await supabase.from("wallets").insert({ user_id: userId, coins: 0 });
      }

      const reward = DAILY_REWARD_AMOUNT;
      const newCoins = currentCoins + reward;
      const nowIso = new Date().toISOString();
      let newStreak = 1;

      if (dailyInfo) {
        const last = new Date(dailyInfo.last_claimed_at).getTime();
        const diffMs = Date.now() - last;
        if (diffMs >= 24 * 60 * 60 * 1000 && diffMs <= 48 * 60 * 60 * 1000) {
          newStreak = (dailyInfo.streak || 1) + 1;
        } else {
          newStreak = 1;
        }

        await supabase
          .from("daily_rewards")
          .update({
            last_claimed_at: nowIso,
            streak: newStreak,
          })
          .eq("user_id", userId);
      } else {
        await supabase.from("daily_rewards").insert({
          user_id: userId,
          last_claimed_at: nowIso,
          streak: 1,
        });
      }

      setDailyInfo({
        user_id: userId,
        last_claimed_at: nowIso,
        streak: newStreak,
      });
      setCanClaimDaily(false);

      await supabase
        .from("wallets")
        .update({ coins: newCoins })
        .eq("user_id", userId);
      setCoins(newCoins);

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
    } catch (err: any) {
      Alert.alert("Erreur", err.message || "Impossible de prendre la récompense.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
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
          Boutique agressive
        </Text>

        <Text
          style={{
            fontSize: 13,
            color: COLORS.textMuted,
            marginBottom: 16,
          }}
        >
          Packs de coins, badges impitoyables, tickets Arena : toute l’économie IMMORTAL-K.
        </Text>

        <View style={card("primary")}>
          <Text style={cardTitle}>Soldes</Text>
          <Text style={cardMetric}>{coins} coins</Text>
          <Text style={cardMuted}>Pseudo : {pseudo || "Joueur"}</Text>
        </View>

        <View style={card("neutral")}>
          <Text style={cardTitle}>Statut joueur</Text>
          <Text style={cardMuted}>
            Niveau {playerLevel} • Points {playerPoints}
          </Text>
          <Text style={cardMuted}>
            Fair-play : {fairPlayScore}/100 (seuil Arena {ARENA_FAIR_PLAY_THRESHOLD}+)
          </Text>
        </View>

        <View style={card(canClaimDaily ? "accent" : "neutral")}>
          <Text style={cardTitle}>Récompense quotidienne</Text>
          <Text style={cardMuted}>
            Bonus actuel : {DAILY_REWARD_AMOUNT} coins. Streak :{" "}
            {dailyInfo?.streak || 0} jour(s).
          </Text>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleClaimDaily}
            disabled={!canClaimDaily || processing}
            style={{
              marginTop: 12,
              paddingVertical: 12,
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

        <Text style={sectionTitle}>Packs de coins (fictifs)</Text>
        {COIN_OFFERS.map((offer) => (
          <ShopCard
            key={offer.id}
            title={offer.label}
            subtitle={offer.description}
            badge={`+${offer.coins} coins`}
            footer={offer.priceLabel}
            highlight={offer.highlight}
            onPress={() => handleBuyCoins(offer)}
            disabled={processing}
          />
        ))}

        <Text style={sectionTitle}>Boost Fair-Play</Text>
        {BOOSTS.map((boost) => (
          <ShopCard
            key={boost.id}
            title={boost.label}
            subtitle={boost.description}
            badge={`-${boost.priceCoins} coins`}
            footer={`+${boost.rewardFairPlay} fair-play`}
            onPress={() => handleBuyBoost(boost)}
            disabled={processing}
          />
        ))}

        <Text style={sectionTitle}>Badges / Cosmétiques</Text>
        {BADGES.map((badge) => (
          <ShopCard
            key={badge.id}
            title={badge.label}
            subtitle={badge.description}
            badge={`Prix : ${badge.priceLabel}`}
            badgeColor={badge.color}
            footer="Débloque un style unique (fictif)."
            disabled
          />
        ))}

        <Text style={sectionTitle}>Tickets Arena (fictifs)</Text>
        {TICKETS.map((ticket) => (
          <ShopCard
            key={ticket.id}
            title={ticket.label}
            subtitle={ticket.description}
            badge={`-${ticket.priceCoins} coins`}
            footer={`Exigence : ${ticket.requirements} • Récompense +${ticket.rewardPoints} pts`}
            onPress={() => handleBuyTicket(ticket)}
            disabled={processing}
          />
        ))}

        <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 18 }}>
          Remarque : tout est fictif. Cela te permet de tester l’économie (coins, paris, punitions, classement) sans réel paiement.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

type CardTheme = "primary" | "accent" | "neutral";

const card = (theme: CardTheme): ViewStyle => ({
  marginBottom: 18,
  padding: 16,
  borderRadius: 20,
  borderWidth: 1,
  borderColor:
    theme === "primary"
      ? COLORS.border
      : theme === "accent"
      ? COLORS.primary
      : COLORS.border,
  backgroundColor:
    theme === "primary" ? COLORS.surface : theme === "accent" ? "#111827" : "#020617",
});

const cardTitle: TextStyle = {
  fontSize: 16,
  fontWeight: "800",
  color: COLORS.text,
  marginBottom: 4,
};

const cardMetric: TextStyle = {
  fontSize: 22,
  fontWeight: "900",
  color: COLORS.primary,
  marginBottom: 6,
};

const cardMuted: TextStyle = {
  fontSize: 13,
  color: COLORS.textMuted,
};

const sectionTitle: TextStyle = {
  fontSize: 16,
  fontWeight: "800",
  color: COLORS.text,
  marginBottom: 10,
  marginTop: 10,
};

type ShopCardProps = {
  title: string;
  subtitle: string;
  badge: string;
  footer: string;
  highlight?: boolean;
  badgeColor?: string;
  onPress?: () => void;
  disabled?: boolean;
};

function ShopCard({
  title,
  subtitle,
  badge,
  footer,
  highlight,
  badgeColor,
  onPress,
  disabled,
}: ShopCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={disabled}
      style={{
        marginBottom: 12,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: highlight ? COLORS.primary : COLORS.border,
        backgroundColor: highlight ? "#111827" : "#020617",
        opacity: disabled ? 0.65 : 1,
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
          {title}
        </Text>
        <View
          style={{
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: badgeColor || COLORS.primary,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "800",
              color: badgeColor ? "#050505" : "#050505",
            }}
          >
            {badge}
          </Text>
        </View>
      </View>

      <Text
        style={{
          fontSize: 12,
          color: COLORS.textMuted,
          marginBottom: 8,
        }}
      >
        {subtitle}
      </Text>

      <Text
        style={{
          fontSize: 12,
          color: COLORS.text,
          opacity: 0.8,
        }}
      >
        {footer}
      </Text>
    </TouchableOpacity>
  );
}
