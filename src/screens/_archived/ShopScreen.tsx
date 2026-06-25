// src/screens/ShopScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";
import { supabase } from "../supabase";

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  color: string;
  category: "boost" | "badge" | "reward";
}

const ITEMS: ShopItem[] = [
  { id: "daily_bonus", name: "Bonus quotidien", description: "Récupère tes 50 coins gratuits chaque jour.", price: 0, icon: "gift", color: "#34D399", category: "reward" },
  { id: "boost_xp", name: "Boost XP x2", description: "Double tes points XP pendant 24h.", price: 150, icon: "bolt", color: "#F59E0B", category: "boost" },
  { id: "badge_gold", name: "Badge Gold", description: "Affiche ton statut premium dans l'arène.", price: 300, icon: "medal", color: "#D4AF37", category: "badge" },
  { id: "boost_fairplay", name: "Récupération Fair Play", description: "+10 points Fair Play instantanément.", price: 200, icon: "shield-alt", color: "#60A5FA", category: "boost" },
  { id: "badge_immortal", name: "Badge Immortal", description: "Le badge ultime. Réservé aux légendes.", price: 999, icon: "crown", color: "#C084FC", category: "badge" },
  { id: "boost_coins", name: "Pack 500 coins", description: "500 coins ajoutés à ton wallet.", price: 250, icon: "coins", color: "#FACC15", category: "boost" },
];

const CATEGORY_LABELS: Record<string, string> = {
  reward: "Gratuit",
  boost: "Boosts",
  badge: "Badges",
};

export default function ShopScreen({ navigation }: any) {
  const [coins, setCoins] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [lastClaim, setLastClaim] = useState<Date | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [category, setCategory] = useState<"all" | "boost" | "badge" | "reward">("all");

  const loadWallet = useCallback(async () => {
    const { data: ses } = await supabase.auth.getSession();
    const uid = ses.session?.user.id;
    if (!uid) return;
    setUserId(uid);
    const [{ data: wal }, { data: daily }] = await Promise.all([
      supabase.from("wallets").select("coins").eq("user_id", uid).maybeSingle(),
      supabase.from("daily_rewards").select("last_claimed_at").eq("user_id", uid).maybeSingle(),
    ]);
    if (wal) setCoins((wal as any).coins ?? 0);
    if (daily) setLastClaim(new Date((daily as any).last_claimed_at));
  }, []);

  useEffect(() => { loadWallet(); }, [loadWallet]);

  const canClaimDaily = !lastClaim || Date.now() - lastClaim.getTime() >= 24 * 3600 * 1000;

  const handleBuy = async (item: ShopItem) => {
    if (!userId) return Alert.alert("Connexion requise", "Connecte-toi pour acheter.");
    if (item.id === "daily_bonus") {
      if (!canClaimDaily) {
        const next = new Date((lastClaim?.getTime() ?? 0) + 24 * 3600 * 1000);
        return Alert.alert("Déjà réclamé", `Prochain bonus dans ${Math.ceil((next.getTime() - Date.now()) / 3600000)}h.`);
      }
      setBuying(item.id);
      await supabase.from("wallets").upsert({ user_id: userId, coins: (coins ?? 0) + 50 }, { onConflict: "user_id" });
      await supabase.from("daily_rewards").upsert({ user_id: userId, last_claimed_at: new Date().toISOString(), streak: 1 }, { onConflict: "user_id" });
      await loadWallet();
      setBuying(null);
      Alert.alert("Bonus réclamé !", "+50 coins ajoutés à ton wallet.");
      return;
    }
    if ((coins ?? 0) < item.price) {
      return Alert.alert("Coins insuffisants", `Il te faut ${item.price} coins. Tu en as ${coins ?? 0}.`);
    }
    Alert.alert(`Acheter ${item.name}`, `${item.price} coins seront déduits. Confirmer ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Confirmer", onPress: async () => {
          setBuying(item.id);
          await supabase.from("wallets").upsert({ user_id: userId, coins: (coins ?? 0) - item.price }, { onConflict: "user_id" });
          if (item.id === "boost_coins") {
            await supabase.from("wallets").upsert({ user_id: userId, coins: (coins ?? 0) - item.price + 500 }, { onConflict: "user_id" });
          }
          await loadWallet();
          setBuying(null);
          Alert.alert("Achat confirmé !", `${item.name} est maintenant actif.`);
        }
      },
    ]);
  };

  const filtered = category === "all" ? ITEMS : ITEMS.filter((i) => i.category === category);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Hero wallet */}
        <View style={styles.walletCard}>
          <View style={styles.walletLeft}>
            <Text style={styles.kicker}>BOUTIQUE</Text>
            <Text style={styles.title}>Arène Shop</Text>
            <Text style={styles.subtitle}>Boosts, badges et récompenses.</Text>
          </View>
          <View style={styles.walletBadge}>
            <FontAwesome5 name="coins" size={20} color={COLORS.primary} />
            <Text style={styles.walletAmount}>
              {coins !== null ? coins.toLocaleString("fr-FR") : "—"}
            </Text>
            <Text style={styles.walletLabel}>coins</Text>
          </View>
        </View>

        {/* Daily bonus banner */}
        {canClaimDaily && userId && (
          <TouchableOpacity
            style={styles.dailyBanner}
            onPress={() => handleBuy(ITEMS[0])}
            activeOpacity={0.85}
          >
            <View style={styles.dailyLeft}>
              <FontAwesome5 name="gift" size={18} color="#34D399" />
              <View>
                <Text style={styles.dailyTitle}>Bonus quotidien disponible !</Text>
                <Text style={styles.dailyText}>Récupère tes 50 coins gratuits maintenant.</Text>
              </View>
            </View>
            <FontAwesome5 name="chevron-right" size={12} color="#34D399" />
          </TouchableOpacity>
        )}

        {/* Filtres catégories */}
        <View style={styles.categories}>
          {(["all", "reward", "boost", "badge"] as const).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, category === cat && styles.catChipActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.catLabel, category === cat && styles.catLabelActive]}>
                {cat === "all" ? "Tout" : CATEGORY_LABELS[cat]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Grille articles */}
        <View style={styles.grid}>
          {filtered.map((item) => {
            const isFree = item.price === 0;
            const canAfford = (coins ?? 0) >= item.price;
            const isClaimed = isFree && !canClaimDaily;
            const isLoading = buying === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.itemCard,
                  { borderColor: item.color + "44" },
                  isClaimed && styles.itemCardDim,
                ]}
                onPress={() => !isClaimed && handleBuy(item)}
                activeOpacity={isClaimed ? 1 : 0.85}
              >
                <View style={[styles.itemIcon, { backgroundColor: item.color + "18" }]}>
                  <FontAwesome5 name={item.icon as any} size={22} color={item.color} />
                </View>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
                <View style={[
                  styles.pricePill,
                  isFree && styles.pricePillFree,
                  !isFree && !canAfford && styles.pricePillLocked,
                ]}>
                  {isLoading ? (
                    <Text style={styles.priceText}>...</Text>
                  ) : isFree ? (
                    <>
                      <FontAwesome5 name={isClaimed ? "check" : "gift"} size={10} color={isClaimed ? COLORS.textMuted : "#34D399"} />
                      <Text style={[styles.priceText, isClaimed && { color: COLORS.textMuted }]}>
                        {isClaimed ? "Réclamé" : "Gratuit"}
                      </Text>
                    </>
                  ) : (
                    <>
                      <FontAwesome5 name="coins" size={10} color={canAfford ? COLORS.primary : COLORS.textMuted} />
                      <Text style={[styles.priceText, !canAfford && { color: COLORS.textMuted }]}>
                        {item.price}
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {!userId && (
          <TouchableOpacity
            style={styles.loginBanner}
            onPress={() => navigation?.navigate("Login")}
          >
            <FontAwesome5 name="lock" size={14} color={COLORS.primary} />
            <Text style={styles.loginBannerText}>Connecte-toi pour accéder à la boutique</Text>
            <FontAwesome5 name="chevron-right" size={11} color={COLORS.primary} />
          </TouchableOpacity>
        )}

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 80, gap: 16 },
  walletCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, borderRadius: 22, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.35)", backgroundColor: "rgba(12,12,16,0.92)",
  },
  walletLeft: { flex: 1 },
  kicker: { fontSize: 11, letterSpacing: 3, color: COLORS.textMuted, fontWeight: "700" },
  title: { ...TYPO.display, color: COLORS.text, marginTop: 4 },
  subtitle: { ...TYPO.subtitle, color: COLORS.textMuted, marginTop: 2 },
  walletBadge: {
    alignItems: "center", gap: 4, padding: 14, borderRadius: 18, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.4)", backgroundColor: "rgba(212,175,55,0.1)", minWidth: 80,
  },
  walletAmount: { color: COLORS.primary, fontSize: 22, fontWeight: "900" },
  walletLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  dailyBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 14, borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(52,211,153,0.4)", backgroundColor: "rgba(52,211,153,0.08)",
  },
  dailyLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  dailyTitle: { color: "#34D399", fontWeight: "800", fontSize: 13 },
  dailyText: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  categories: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  catChipActive: { borderColor: COLORS.primary, backgroundColor: "rgba(212,175,55,0.14)" },
  catLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  catLabelActive: { color: COLORS.primary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  itemCard: {
    flex: 1, minWidth: 140, maxWidth: "48%", padding: 16,
    borderRadius: 18, borderWidth: 1, backgroundColor: COLORS.surface,
    gap: 8, alignItems: "flex-start",
  },
  itemCardDim: { opacity: 0.5 },
  itemIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  itemName: { color: COLORS.text, fontWeight: "800", fontSize: 13 },
  itemDesc: { color: COLORS.textMuted, fontSize: 11, lineHeight: 15 },
  pricePill: {
    flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "rgba(212,175,55,0.1)", borderWidth: 1, borderColor: "rgba(212,175,55,0.3)",
  },
  pricePillFree: { backgroundColor: "rgba(52,211,153,0.1)", borderColor: "rgba(52,211,153,0.3)" },
  pricePillLocked: { backgroundColor: "rgba(148,163,184,0.08)", borderColor: "rgba(148,163,184,0.2)" },
  priceText: { color: COLORS.primary, fontSize: 12, fontWeight: "800" },
  loginBanner: {
    flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center",
    padding: 14, borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)", backgroundColor: "rgba(212,175,55,0.06)",
  },
  loginBannerText: { color: COLORS.primary, fontWeight: "700", fontSize: 13 },
});
