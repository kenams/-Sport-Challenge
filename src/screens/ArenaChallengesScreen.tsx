// src/screens/ArenaChallengesScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { Challenge, UserProfile } from "../types";
import { COLORS, getSportPalette } from "../theme";
import SportTag from "../components/SportTag";
import UserAvatar from "../components/UserAvatar";
import { fetchProfilesMap } from "../services/profile";
import AppButton from "../components/AppButton";

const STAKE_FILTERS = [0, 25, 50, 100, 200];

export default function ArenaChallengesScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<Challenge[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, UserProfile>>(
    new Map()
  );
  const [stakeFilter, setStakeFilter] = useState(0);

  const loadChallenges = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("bet_enabled", true)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) {
        console.log("ARENA CHALLENGES ERROR", error);
        setRows([]);
        setProfilesMap(new Map());
        return;
      }
      const parsed = (data as Challenge[]) || [];
      setRows(parsed);
      if (parsed.length > 0) {
        const map = await fetchProfilesMap(parsed.map((c) => c.user_id));
        setProfilesMap(map);
      } else {
        setProfilesMap(new Map());
      }
    } catch (e) {
      console.log("ARENA CHALLENGES EXCEPTION", e);
      setRows([]);
      setProfilesMap(new Map());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  const onRefresh = () => {
    setRefreshing(true);
    loadChallenges();
  };

  const filteredRows = useMemo(() => {
    return rows.filter(
      (row) => (row.bet_amount || 0) >= stakeFilter
    );
  }, [rows, stakeFilter]);

  const handleExpressMatch = () => {
    if (filteredRows.length === 0) {
      Alert.alert("Aucun défi", "Aucun défi classé ne correspond à ton filtre.");
      return;
    }
    const random =
      filteredRows[Math.floor(Math.random() * filteredRows.length)];
    navigation.navigate("ArenaLive", {
      challengeId: random.id,
      role: "host",
    });
  };

  const renderItem = ({ item }: { item: Challenge }) => {
    const palette = getSportPalette(item.sport);
    const stake = item.bet_amount || 0;
    const profile = profilesMap.get(item.user_id);
    const creatorLabel =
      profile?.pseudo ||
      item.pseudo ||
      `Joueur ${item.user_id.slice(0, 4)}...${item.user_id.slice(-4)}`;
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: 18,
          padding: 16,
          marginBottom: 14,
          backgroundColor: palette.card,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <UserAvatar
            uri={profile?.avatar_url || item.avatar_url || undefined}
            label={creatorLabel}
            size={48}
          />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text
              style={{
                color: palette.text,
                fontSize: 16,
                fontWeight: "800",
              }}
            >
              {item.title}
            </Text>
            <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
              {creatorLabel}
            </Text>
          </View>
          <SportTag sport={item.sport} />
        </View>
        <Text
          style={{
            color: palette.text,
            marginTop: 10,
            fontSize: 13,
          }}
        >
          Objectif : {item.target_value} {item.unit}
        </Text>
        <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 4 }}>
          Niveau min : {item.min_level || item.level_required || 1}
        </Text>
        <Text
          style={{
            marginTop: 6,
            color: COLORS.primary,
            fontWeight: "800",
            fontSize: 14,
          }}
        >
          Mise : {stake} coins
        </Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate("ArenaLive", {
              challengeId: item.id,
              role: "host",
            })
          }
          style={{
            marginTop: 12,
            paddingVertical: 10,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: COLORS.primary,
            alignItems: "center",
            backgroundColor: COLORS.primary,
          }}
        >
          <Text
            style={{
              fontWeight: "900",
              color: "#050505",
            }}
          >
            Ouvrir en Arena
          </Text>
        </TouchableOpacity>
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
      <Text
        style={{
          fontSize: 24,
          fontWeight: "900",
          color: COLORS.text,
          marginBottom: 12,
        }}
      >
        Défis Arena
      </Text>
      <Text
        style={{
          color: COLORS.textMuted,
          marginBottom: 16,
        }}
      >
        Sélectionne un défi classé pour ouvrir ou rejoindre une Arena Live.
      </Text>
      <View style={{ flexDirection: "row", marginBottom: 16 }}>
        {STAKE_FILTERS.map((value) => (
          <TouchableOpacity
            key={value}
            onPress={() => setStakeFilter(value)}
            style={{
              marginRight: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor:
                stakeFilter === value ? COLORS.primary : COLORS.border,
              backgroundColor:
                stakeFilter === value ? COLORS.primary : "transparent",
            }}
          >
            <Text
              style={{
                color: stakeFilter === value ? "#050505" : COLORS.text,
                fontWeight: "700",
                fontSize: 12,
              }}
            >
              {value === 0 ? "Toutes mises" : `≥ ${value}`}
            </Text>
          </TouchableOpacity>
        ))}
        </View>
      <AppButton
        label="Match express"
        onPress={handleExpressMatch}
        style={{ marginBottom: 16 }}
      />
      <FlatList
        data={filteredRows}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={{ color: COLORS.textMuted }}>
            Aucun défi classé disponible. Crée ton propre défi dans l’onglet défils.
          </Text>
        }
      />
    </ScreenContainer>
  );
}
