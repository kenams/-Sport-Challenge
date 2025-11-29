// src/screens/LeaderboardScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, FlatList } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { COLORS } from "../theme";

type PlayerStatsRow = {
  user_id: string;
  points: number;
  level: number;
  title: string | null;
};

type LeaderItem = PlayerStatsRow & {
  isMe: boolean;
};

export default function LeaderboardScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<LeaderItem[]>([]);
  const [myId, setMyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const { data: ses } = await supabase.auth.getSession();
      const user = ses.session?.user || null;
      const currentId = user?.id || null;
      setMyId(currentId);

      const { data, error } = await supabase
        .from("players_stats")
        .select("*")
        .order("points", { ascending: false })
        .limit(50);

      if (error) {
        console.log("LEADERBOARD ERROR", error);
        setItems([]);
      } else if (data) {
        const list = (data as PlayerStatsRow[]).map((row) => ({
          ...row,
          isMe: row.user_id === currentId,
        }));
        setItems(list);
      }
    } catch (e) {
      console.log("LEADERBOARD LOAD ERROR", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const renderItem = ({
    item,
    index,
  }: {
    item: LeaderItem;
    index: number;
  }) => {
    const rank = index + 1;
    const isMe = item.isMe;

    let rankIcon = "";
    if (rank === 1) rankIcon = "👑";
    else if (rank === 2) rankIcon = "🥈";
    else if (rank === 3) rankIcon = "🥉";
    else rankIcon = "#" + rank;

    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 12,
          marginBottom: 6,
          backgroundColor: isMe ? "#111827" : "#020617",
          borderWidth: 1,
          borderColor: isMe ? COLORS.primary : COLORS.border,
        }}
      >
        <Text
          style={{
            width: 40,
            fontSize: 14,
            fontWeight: "800",
            color: COLORS.primary,
          }}
        >
          {rankIcon}
        </Text>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "800",
              color: COLORS.text,
            }}
          >
            Joueur {item.user_id.slice(0, 4)}…{item.user_id.slice(-4)}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: COLORS.textMuted,
            }}
          >
            {item.title || "Rookie"} • Niveau {item.level}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "900",
              color: COLORS.primary,
            }}
          >
            {item.points}
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: COLORS.textMuted,
            }}
          >
            points
          </Text>
        </View>
      </View>
    );
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

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            color: COLORS.text,
            marginBottom: 8,
          }}
        >
          Classement
        </Text>

        <Text
          style={{
            fontSize: 13,
            color: COLORS.textMuted,
            marginBottom: 16,
          }}
        >
          Top des joueurs les plus actifs et clutch sur les défis classés.
        </Text>

        {items.length === 0 ? (
          <Text style={{ fontSize: 14, color: COLORS.textMuted }}>
            Personne n’a encore de points. Lance des défis, gagne des battles
            et grimpe au sommet.
          </Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.user_id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}

        {myId && (
          <View style={{ marginTop: 8 }}>
            <Text
              style={{
                fontSize: 11,
                color: COLORS.textMuted,
              }}
            >
              Ton profil est surligné dans la liste.
            </Text>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
