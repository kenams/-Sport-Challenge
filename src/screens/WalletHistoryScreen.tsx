import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  SectionList,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS } from "../theme";
import { supabase } from "../supabase";
import SectionHeader from "../components/SectionHeader";
import SimpleCard from "../components/SimpleCard";

type WalletLog = {
  id: number;
  created_at: string;
  delta: number;
  balance_after: number;
  reason: string;
};

type SectionData = {
  title: string;
  data: WalletLog[];
};

export default function WalletHistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<WalletLog[]>([]);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [totalGains, setTotalGains] = useState(0);
  const [totalLosses, setTotalLosses] = useState(0);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        setLogs([]);
        return;
      }

      // Get wallet logs
      const { data, error } = await supabase
        .from("wallet_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.log("Wallet log error:", error);
        setLogs([]);
        return;
      }

      const logData = (data as WalletLog[]) || [];
      setLogs(logData);

      // Calculate stats
      if (logData.length > 0) {
        setCurrentBalance(logData[0].balance_after || 0);
        const gains = logData
          .filter((l) => l.delta > 0)
          .reduce((sum, l) => sum + l.delta, 0);
        const losses = Math.abs(
          logData
            .filter((l) => l.delta < 0)
            .reduce((sum, l) => sum + l.delta, 0)
        );
        setTotalGains(gains);
        setTotalLosses(losses);
      }
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

  const getReasonIcon = (reason: string): string => {
    if (reason.includes("daily")) return "📦";
    if (reason.includes("buy") || reason.includes("purchase")) return "💳";
    if (reason.includes("challenge")) return "🎯";
    if (reason.includes("arena")) return "🎪";
    if (reason.includes("reward")) return "🏆";
    if (reason.includes("bet")) return "💰";
    return "📝";
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return "À l'instant";
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return date.toLocaleDateString("fr-FR");
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <FlatList
        scrollEnabled
        data={logs}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Balance Hero */}
            <View style={styles.balanceSection}>
              <View>
                <Text style={styles.balanceLabel}>Solde Actuel</Text>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceEmoji}>💰</Text>
                  <Text style={styles.balanceValue}>{currentBalance}</Text>
                </View>
              </View>
            </View>

            {/* Stats Cards */}
            <View style={styles.statsRow}>
              <SimpleCard
                color={COLORS.green}
                variant="success"
                style={{ flex: 1, marginRight: 6 }}
              >
                <Text style={styles.statsLabel}>Gains</Text>
                <Text
                  style={[styles.statsValue, { color: COLORS.green }]}
                >
                  +{totalGains}
                </Text>
              </SimpleCard>
              <SimpleCard
                color={COLORS.red}
                variant="danger"
                style={{ flex: 1, marginLeft: 6 }}
              >
                <Text style={styles.statsLabel}>Dépenses</Text>
                <Text
                  style={[styles.statsValue, { color: COLORS.red }]}
                >
                  -{totalLosses}
                </Text>
              </SimpleCard>
            </View>

            {/* Section Header */}
            <SectionHeader
              title="Historique des Transactions"
              subtitle={`${logs.length} transactions`}
              icon="📋"
              color={COLORS.primary}
            />
          </View>
        }
        renderItem={({ item }) => {
          const isGain = item.delta >= 0;
          const icon = getReasonIcon(item.reason);
          const color = isGain ? COLORS.green : COLORS.red;

          return (
            <View
              style={[
                styles.transactionCard,
                {
                  backgroundColor: `${color}08`,
                  borderColor: `${color}30`,
                },
              ]}
            >
              <View style={styles.transactionLeft}>
                <Text style={styles.transactionIcon}>{icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.transactionReason}>{item.reason}</Text>
                  <Text style={styles.transactionTime}>
                    {formatDate(item.created_at)}
                  </Text>
                </View>
              </View>
              <View style={styles.transactionRight}>
                <Text style={[styles.transactionDelta, { color }]}>
                  {isGain ? "+" : "-"}{Math.abs(item.delta)}
                </Text>
                <Text style={styles.transactionBalance}>
                  {item.balance_after} coins
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContent}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>Pas d'historique</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.textMuted,
    marginTop: 12,
    fontSize: 14,
  },
  balanceSection: {
    marginHorizontal: 16,
    marginVertical: 20,
    padding: 24,
    backgroundColor: `${COLORS.primary}15`,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: `${COLORS.primary}40`,
  },
  balanceLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  balanceEmoji: {
    fontSize: 28,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.primary,
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginVertical: 12,
    gap: 12,
  },
  statsLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  transactionCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  transactionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  transactionIcon: {
    fontSize: 24,
  },
  transactionReason: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  transactionTime: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  transactionRight: {
    alignItems: "flex-end",
  },
  transactionDelta: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  transactionBalance: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContent: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
});
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
