// src/screens/LeaderboardScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { COLORS } from "../theme";
import { fetchProfilesMap } from "../services/profile";
import { getDepartmentLabel } from "../utils/departments";

type PlayerStatsRow = {
  user_id: string;
  points: number;
  level: number;
  title: string | null;
};

type LeaderItem = PlayerStatsRow & {
  isMe: boolean;
};

type DepartmentStat = {
  code: string;
  label: string;
  count: number;
};

export default function LeaderboardScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<LeaderItem[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [deptStats, setDeptStats] = useState<DepartmentStat[]>([]);
  const [myDepartment, setMyDepartment] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"players" | "territories" | "challenges">("players");
  const [topChallenges, setTopChallenges] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const { data: ses } = await supabase.auth.getSession();
      const user = ses.session?.user || null;
      const currentId = user?.id || null;
      setMyId(currentId);
      const currentDept =
        typeof user?.user_metadata?.department === "string"
          ? (user.user_metadata?.department as string)
          : null;
      setMyDepartment(currentDept);

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

      const { data: challengeRows } = await supabase
        .from("challenges")
        .select("*")
        .order("created_at", { ascending: false });

      if (challengeRows && challengeRows.length > 0) {
        const userIds = Array.from(new Set(challengeRows.map((r) => r.user_id)));
        const profileMap = await fetchProfilesMap(userIds);
        const counts: Record<string, number> = {};

        challengeRows.forEach((row) => {
          const dep = profileMap.get(row.user_id)?.department;
          if (!dep) return;
          counts[dep] = (counts[dep] || 0) + 1;
        });

        const stats = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([code, count]) => ({
            code,
            label: getDepartmentLabel(code) || `Territoire ${code}`,
            count,
          }));
        setDeptStats(stats);

        const topChallengeMapped = (challengeRows as any[])
          .slice(0, 10)
          .map((challenge) => {
            const owner = profileMap.get(challenge.user_id);
            return {
              id: challenge.id,
              title: challenge.title,
              sport: challenge.sport,
              ownerPseudo:
                owner?.pseudo ||
                challenge.pseudo ||
                `Joueur ${challenge.user_id.slice(0, 6)}`,
              territory: getDepartmentLabel(owner?.department || "") || owner?.department || "N/A",
              created_at: challenge.created_at,
              bet: challenge.bet_amount || 0,
            };
          });
        setTopChallenges(topChallengeMapped);
      } else {
        setDeptStats([]);
        setTopChallenges([]);
      }
    } catch (e) {
      console.log("LEADERBOARD LOAD ERROR", e);
      setItems([]);
      setDeptStats([]);
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
            Joueur {item.user_id.slice(0, 4)}...{item.user_id.slice(-4)}
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

  const renderTopChallenges = () => {
    if (topChallenges.length === 0) {
      return (
        <Text style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 10 }}>
          Pas de défi brûlant pour l'instant. Allume la mèche.
        </Text>
      );
    }

    return topChallenges.map((challenge) => (
      <View
        key={challenge.id}
        style={{
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: "#020617",
          borderRadius: 14,
          padding: 12,
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: "800",
            color: COLORS.text,
            marginBottom: 4,
          }}
        >
          {challenge.title}
        </Text>
        <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
          Sport : {challenge.sport}
        </Text>
        <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
          Créateur : {challenge.ownerPseudo}
        </Text>
        <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
          Territoire : {challenge.territory}
        </Text>
        {challenge.bet > 0 && (
          <Text style={{ fontSize: 12, color: COLORS.primary }}>
            Mise : {challenge.bet} coins
          </Text>
        )}
      </View>
    ));
  };

  const renderNonPlayerContent = () => {
    if (activeTab === "territories") {
      return (
        <View style={{ marginTop: 12 }}>
          {deptStats.length === 0 ? (
            <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>
              Aucun territoire ne s'affiche. Balance un défi et fais du bruit.
            </Text>
          ) : (
            deptStats.slice(0, 8).map((dept, idx) => {
              const isMine = dept.code === myDepartment;
              return (
                <View
                  key={dept.code}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: 12,
                    marginBottom: 6,
                    borderWidth: 1,
                    borderColor: isMine ? COLORS.primary : COLORS.border,
                    backgroundColor: isMine ? "#111827" : "#020617",
                  }}
                >
                  <View>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "800",
                        color: COLORS.text,
                      }}
                    >
                      #{idx + 1} {dept.label}
                    </Text>
                    <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
                      Code {dept.code}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "900",
                      color: COLORS.primary,
                    }}
                  >
                    {dept.count}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      );
    }

    return <View style={{ marginTop: 12 }}>{renderTopChallenges()}</View>;
  };

  const renderTabs = () => (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        marginBottom: 16,
      }}
    >
      {[
        { key: "players", label: "Boss du moment" },
        { key: "territories", label: "Territoires en feu" },
        { key: "challenges", label: "Défis chauds" },
      ].map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key as any)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: isActive ? COLORS.primary : COLORS.border,
              backgroundColor: isActive ? COLORS.primary : "transparent",
            }}
          >
            <Text
              style={{
                textAlign: "center",
                fontWeight: "700",
                color: isActive ? "#050505" : COLORS.text,
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

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
          Tableau de chasse
        </Text>

        <Text
          style={{
            fontSize: 13,
            color: COLORS.textMuted,
            marginBottom: 16,
          }}
        >
          Qui tient la rue en ce moment ? Regarde qui frappe fort, quel
          territoire domine et quels défis mettent la pression.
        </Text>

        {renderTabs()}

        {activeTab === "players" ? (
          items.length === 0 ? (
            <Text style={{ fontSize: 14, color: COLORS.textMuted }}>
              Personne n'a encore de points. Lance des défis, gagne des battles
              et grimpe au sommet.
            </Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.user_id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListFooterComponent={
                myId ? (
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
                ) : null
              }
            />
          )
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            {renderNonPlayerContent()}
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
          </ScrollView>
        )}
      </View>
    </ScreenContainer>
  );
}
