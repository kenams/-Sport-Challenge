import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS } from "../theme";
import { supabase } from "../supabase";

type WalletLog = {
  id: number;
  created_at: string;
  delta: number;
  balance_after: number;
  reason: string;
};

export default function WalletHistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<WalletLog[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        setRows([]);
        return;
      }
      const { data, error } = await supabase
        .from("wallet_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) {
        console.log("WALLET LOG ERROR", error);
        setRows([]);
        return;
      }
      setRows((data as WalletLog[]) || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const renderItem = ({ item }: { item: WalletLog }) => {
    const isGain = item.delta >= 0;
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: COLORS.border,
          borderRadius: 14,
          padding: 12,
          marginBottom: 10,
          backgroundColor: COLORS.surface,
        }}
      >
        <Text
          style={{
            color: COLORS.text,
            fontWeight: "700",
            fontSize: 14,
          }}
        >
          {item.reason}
        </Text>
        <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>
          {new Date(item.created_at).toLocaleString("fr-FR")}
        </Text>
        <Text
          style={{
            marginTop: 6,
            color: isGain ? COLORS.success : COLORS.danger,
            fontWeight: "800",
            fontSize: 16,
          }}
        >
          {isGain ? "+" : ""}
          {item.delta} coins
        </Text>
        <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
          Balance après opération : {item.balance_after} coins
        </Text>
      </View>
    );
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

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            color: COLORS.text,
            marginBottom: 12,
          }}
        >
          Historique coins
        </Text>
        <Text style={{ color: COLORS.textMuted, marginBottom: 16 }}>
          Suis les entrées et sorties de coins liées à tes défis, shop et daily reward.
        </Text>
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={{ color: COLORS.textMuted }}>
              Aucun mouvement de coins enregistré.
            </Text>
          }
        />
      </View>
    </ScreenContainer>
  );
}
