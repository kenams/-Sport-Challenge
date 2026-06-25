import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, TYPO } from "../theme";
import { supabase } from "../supabase";
import AppButton from "../components/AppButton";

type AuditEntry = {
  id: number;
  user_id: string;
  created_at: string;
  object_type: string;
  object_id: string;
  action: string;
  payload?: any;
};

export default function AdminAuditScreen() {
  const { width } = useWindowDimensions();
  const isTiny = width < 420;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadAudit = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("admin_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        console.log("ADMIN LOGS ERROR", error);
        setRows([]);
        return;
      }
      setRows((data as AuditEntry[]) || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAudit();
  };

  const renderItem = ({ item }: { item: AuditEntry }) => {
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
        <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>
          {new Date(item.created_at).toLocaleString("fr-FR")}
        </Text>
        <Text
          style={{
            color: COLORS.text,
            fontWeight: "800",
            marginTop: 4,
          }}
        >
          {item.action} sur {item.object_type} #{item.object_id}
        </Text>
        <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }}>
          Par {item.user_id?.slice(0, 8) || "système"}
        </Text>
        {item.payload && (
          <Text
            style={{
              color: COLORS.text,
              fontSize: 12,
              marginTop: 6,
            }}
            numberOfLines={3}
            ellipsizeMode="tail"
          >
            {JSON.stringify(item.payload)}
          </Text>
        )}
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
        <View style={[styles.headerRow, isTiny && styles.headerRowStack]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pageTitle, isTiny && styles.pageTitleTiny]}>
              Admin Audit
            </Text>
            <Text style={styles.pageSubtitle}>
              Suivi des actions critiques (ban, reset, punition, etc.).
            </Text>
          </View>
          <AppButton
            label="Actualiser"
            size="sm"
            variant="ghost"
            onPress={loadAudit}
          />
        </View>
        <Text style={styles.pageMeta}>Dernières 50 entrées</Text>
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
              Aucun log admin pour le moment.
            </Text>
          }
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    ...TYPO.display,
    color: COLORS.text,
    marginBottom: 12,
  },
  pageTitleTiny: {
    fontSize: 24,
    lineHeight: 30,
  },
  pageSubtitle: {
    ...TYPO.subtitle,
    color: COLORS.textMuted,
    marginBottom: 16,
  },
  pageMeta: {
    ...TYPO.subtitle,
    color: COLORS.textMuted,
    marginBottom: 12,
    fontSize: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerRowStack: {
    flexDirection: "column",
    alignItems: "stretch",
  },
});