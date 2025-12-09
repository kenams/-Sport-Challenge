// src/screens/ShopScreen_Improved.tsx
// Version beautifiée et simplifiée du ShopScreen

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  FlatList,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { COLORS } from "../theme";
import SectionHeader from "../components/SectionHeader";
import SimpleCard from "../components/SimpleCard";
import StatBox from "../components/StatBox";
import AppButton from "../components/AppButton";

type Offer = {
  id: string;
  label: string;
  description: string;
  coins?: number;
  price: number;
  icon: string;
  color: string;
};

const COIN_PACKAGES: Offer[] = [
  {
    id: "starter",
    label: "Pack Starter",
    description: "Pour débuter tranquille",
    coins: 100,
    price: 199,
    icon: "💫",
    color: COLORS.blue,
  },
  {
    id: "street",
    label: "Pack Street",
    description: "Le classique favori",
    coins: 300,
    price: 399,
    icon: "🌟",
    color: COLORS.yellow,
  },
  {
    id: "pro",
    label: "Pack Pro",
    description: "Pour dominer",
    coins: 800,
    price: 799,
    icon: "👑",
    color: COLORS.purple,
  },
  {
    id: "boss",
    label: "Pack Boss",
    description: "Maximum power",
    coins: 2000,
    price: 1499,
    icon: "🔥",
    color: COLORS.red,
  },
];

const SPECIALS: Offer[] = [
  {
    id: "arena_ticket",
    label: "Ticket Arena Live",
    description: "1 session supplémentaire",
    price: 600,
    icon: "🎪",
    color: COLORS.cyan,
  },
  {
    id: "fairplay_boost",
    label: "Boost Fair-Play",
    description: "Recharge ta réputation",
    price: 450,
    icon: "⭐",
    color: COLORS.green,
  },
  {
    id: "revival",
    label: "Ticket Revival",
    description: "Efface une punition",
    price: 800,
    icon: "🔄",
    color: COLORS.orange,
  },
];

export default function ShopScreen() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [coins, setCoins] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState<string>("");
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
        return;
      }

      setUserId(user.id);
      setPseudo(user.user_metadata?.pseudo || user.email || "Joueur");

      // Get wallet
      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      setCoins(wallet?.coins || 0);

      // Check daily reward
      const { data: daily } = await supabase
        .from("daily_rewards")
        .select("last_claimed_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (daily) {
        const last = new Date(daily.last_claimed_at).getTime();
        setCanClaimDaily(Date.now() - last >= 24 * 60 * 60 * 1000);
      } else {
        setCanClaimDaily(true);
      }
    } catch (error) {
      console.log("Shop load error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const claimDaily = async () => {
    if (!userId || !canClaimDaily) return;

    try {
      setProcessing(true);

      // Update or insert daily reward
      const { data: existing } = await supabase
        .from("daily_rewards")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const streak = existing ? (existing.streak || 0) + 1 : 1;

      if (existing) {
        await supabase
          .from("daily_rewards")
          .update({ last_claimed_at: new Date().toISOString(), streak })
          .eq("user_id", userId);
      } else {
        await supabase.from("daily_rewards").insert({
          user_id: userId,
          last_claimed_at: new Date().toISOString(),
          streak: 1,
        });
      }

      // Add coins
      const reward = 50 + streak * 5;
      const { data: wallet } = await supabase
        .from("wallets")
        .select("coins")
        .eq("user_id", userId)
        .maybeSingle();

      const newCoins = (wallet?.coins || 0) + reward;
      await supabase
        .from("wallets")
        .update({ coins: newCoins })
        .eq("user_id", userId);

      setCoins(newCoins);
      setCanClaimDaily(false);

      Alert.alert(
        "Succès!",
        `Tu as gagné ${reward} coins! 🎉\nSérie: ${streak} jours`
      );
    } catch (error) {
      console.log("Claim error:", error);
      Alert.alert("Erreur", "Impossible de réclamer la récompense");
    } finally {
      setProcessing(false);
    }
  };

  const handlePurchase = (offer: Offer) => {
    Alert.alert(
      `Acheter ${offer.label}?`,
      `Coût: ${offer.price}€\n${offer.description}`,
      [
        {
          text: "Annuler",
          style: "cancel",
        },
        {
          text: "Acheter",
          onPress: () => {
            Alert.alert(
              "Paiement",
              "Redirection vers système de paiement (fictif)"
            );
          },
        },
      ]
    );
  };

  const handleSpecial = (offer: Offer) => {
    if (coins < offer.price) {
      Alert.alert("Coins insuffisants", "Vous n'avez pas assez de coins");
      return;
    }

    Alert.alert(
      `Utiliser ${offer.label}?`,
      `Coût: ${offer.price} coins`,
      [
        {
          text: "Annuler",
          style: "cancel",
        },
        {
          text: "Utiliser",
          onPress: () => {
            Alert.alert(
              "Succès",
              `${offer.label} activé! 🎉`
            );
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Wallet Section */}
        <View style={styles.walletSection}>
          <View style={styles.walletContent}>
            <Text style={styles.walletLabel}>Ta Wallet</Text>
            <View style={styles.coinsRow}>
              <Text style={styles.coinsEmoji}>💰</Text>
              <Text style={styles.coinsValue}>{coins}</Text>
              <Text style={styles.coinsLabel}>coins</Text>
            </View>
          </View>
          {canClaimDaily && (
            <AppButton
              label="📦 Récompense"
              onPress={claimDaily}
              disabled={processing}
              variant="accent"
            />
          )}
        </View>

        {/* Daily Reward Info */}
        {!canClaimDaily && (
          <SimpleCard variant="info">
            <Text style={styles.infoText}>
              ✨ Reviens demain pour ta récompense quotidienne!
            </Text>
          </SimpleCard>
        )}

        {/* Coin Packages */}
        <SectionHeader
          title="Paquets de Coins"
          subtitle="Achetez des coins avec €"
          icon="💳"
          color={COLORS.yellow}
        />

        <View style={styles.packagesGrid}>
          {COIN_PACKAGES.map((offer) => (
            <TouchableOpacity
              key={offer.id}
              onPress={() => handlePurchase(offer)}
              style={[
                styles.packageCard,
                {
                  backgroundColor: `${offer.color}15`,
                  borderColor: offer.color,
                },
              ]}
            >
              <Text style={styles.packageIcon}>{offer.icon}</Text>
              <Text style={styles.packageTitle}>{offer.label}</Text>
              <Text style={styles.packageCoins}>+{offer.coins}</Text>
              <Text style={styles.packagePrice}>{offer.price}€</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Specials Section */}
        <SectionHeader
          title="Offres Spéciales"
          subtitle="Dépensez vos coins"
          icon="✨"
          color={COLORS.cyan}
        />

        <FlatList
          scrollEnabled={false}
          data={SPECIALS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleSpecial(item)}
              style={[
                styles.specialCard,
                {
                  backgroundColor: `${item.color}10`,
                  borderColor: item.color,
                },
              ]}
            >
              <View style={styles.specialContent}>
                <Text style={styles.specialIcon}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.specialTitle}>{item.label}</Text>
                  <Text style={styles.specialDesc}>{item.description}</Text>
                </View>
              </View>
              <Text
                style={[
                  styles.specialPrice,
                  { color: item.color },
                ]}
              >
                {item.price} 💰
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  walletSection: {
    marginHorizontal: 16,
    marginVertical: 16,
    padding: 20,
    backgroundColor: `${COLORS.primary}15`,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: `${COLORS.primary}40`,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  walletContent: {
    flex: 1,
  },
  walletLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  coinsRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  coinsEmoji: {
    fontSize: 28,
  },
  coinsValue: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.primary,
  },
  coinsLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  infoText: {
    color: COLORS.blue,
    fontSize: 14,
    fontWeight: "500",
  },
  packagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  packageCard: {
    flex: 1,
    minWidth: "45%",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
  },
  packageIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  packageTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
    textAlign: "center",
  },
  packageCoins: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.yellow,
    marginBottom: 4,
  },
  packagePrice: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  specialCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  specialContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  specialIcon: {
    fontSize: 24,
  },
  specialTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  specialDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  specialPrice: {
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 12,
  },
});
