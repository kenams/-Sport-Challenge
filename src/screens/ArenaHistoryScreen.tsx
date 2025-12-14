// src/screens/ArenaHistoryScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { COLORS, getSportPalette } from "../theme";
import SportTag from "../components/SportTag";
import { supabase } from "../supabase";
import { getFairPlayTier } from "../utils/fairPlay";
import { useNavigation } from "@react-navigation/native";
import { logNotification } from "../notifications";

type ArenaActivity = {
  id: number;
  user_id: string;
  message: string;
  created_at: string;
  challenge_id: number;
  type: string;
  challenge?: {
    title: string;
    sport: string;
    bet_amount?: number;
  };
};

type ArenaRoomRow = {
  id: string;
  host_id: string;
  guest_id?: string | null;
  status: string;
  stake: number;
  created_at: string;
  challenge?: {
    title: string;
    sport: string;
  };
};

export default function ArenaHistoryScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<ArenaActivity[]>([]);
  const [profilesMap, setProfilesMap] = useState<
    Map<string, { pseudo?: string | null }>
  >(new Map());
  const [fairPlayMap, setFairPlayMap] = useState<Map<string, number>>(
    new Map()
  );
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [rooms, setRooms] = useState<ArenaRoomRow[]>([]);
  const [roomStatusFilter, setRoomStatusFilter] = useState<string>("all");

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("activities")
        .select(
          "*, challenge:challenges!activities_challenge_id_fkey(title,sport,bet_amount)"
        )
        .in("type", ["arena_live_start", "arena_finished"])
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.log("ARENA HISTORY ERROR", error);
        setRows([]);
        return;
      }

      const activities = (data as ArenaActivity[]) || [];
      setRows(activities);

      const uniqueUserIds = Array.from(
        new Set(activities.map((row) => row.user_id).filter(Boolean))
      );
      if (uniqueUserIds.length > 0) {
        const [{ data: profilesData }, { data: statsData }] = await Promise.all([
          supabase
            .from("profiles")
            .select("user_id,pseudo")
            .in("user_id", uniqueUserIds),
          supabase
            .from("players_stats")
            .select("user_id,fair_play_score")
            .in("user_id", uniqueUserIds),
        ]);
        const profileMap = new Map<string, { pseudo?: string | null }>();
        (profilesData || []).forEach((p: any) => {
          profileMap.set(p.user_id, { pseudo: p.pseudo });
        });
        setProfilesMap(profileMap);

        const fairMap = new Map<string, number>();
        (statsData || []).forEach((row: any) => {
          fairMap.set(row.user_id, row.fair_play_score ?? 100);
        });
        setFairPlayMap(fairMap);
      } else {
        setProfilesMap(new Map());
        setFairPlayMap(new Map());
      }

      const { data: roomsData, error: roomsError } = await supabase
        .from("arena_rooms")
        .select(
          "*, challenge:challenges!arena_rooms_challenge_id_fkey(id,title,sport)"
        )
        .order("created_at", { ascending: false })
        .limit(20);
      if (roomsError) {
        console.log("ARENA ROOMS ERROR", roomsError);
        setRooms([]);
      } else {
        setRooms((roomsData as ArenaRoomRow[]) || []);
      }
    } catch (e) {
      console.log("ARENA HISTORY EXCEPTION", e);
      setRows([]);
      setProfilesMap(new Map());
      setFairPlayMap(new Map());
      setRooms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const sports = useMemo(() => {
    const values = new Set<string>();
    rows.forEach((row) => {
      if (row.challenge?.sport) values.add(row.challenge.sport);
    });
    return Array.from(values);
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (sportFilter !== "all" && row.challenge?.sport !== sportFilter) {
        return false;
      }
      if (tierFilter !== "all") {
        const fp = fairPlayMap.get(row.user_id);
        if (typeof fp !== "number") return false;
        const tier = getFairPlayTier(fp);
        if (tier.label !== tierFilter) {
          return false;
        }
      }
      return true;
    });
  }, [rows, sportFilter, tierFilter, fairPlayMap]);

  const filteredRooms = useMemo(() => {
    if (roomStatusFilter === "all") return rooms;
    return rooms.filter((room) => room.status === roomStatusFilter);
  }, [rooms, roomStatusFilter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const handleRematch = async (item: ArenaActivity) => {
    if (!item.challenge_id) return;
    try {
      const { data } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", item.challenge_id)
        .maybeSingle();
      if (!data) {
        navigation.navigate("CreateChallenge", {
          rematchSport: item.challenge?.sport,
          rematchTitle: item.challenge?.title,
          rematchBet: item.challenge?.bet_amount || 0,
        });
        return;
      }
      const clone = {
        user_id: data.user_id,
        title: `${data.title} - revanche`,
        description: data.description,
        sport: data.sport,
        target_value: data.target_value,
        unit: data.unit,
        video_url: data.video_url,
        bet_enabled: data.bet_enabled,
        bet_amount: data.bet_amount,
        min_level: data.min_level,
      };
      const { data: inserted, error } = await supabase
        .from("challenges")
        .insert(clone)
        .select("*")
        .single();
      if (error || !inserted) {
        navigation.navigate("CreateChallenge", {
          rematchSport: item.challenge?.sport,
          rematchTitle: item.challenge?.title,
          rematchBet: item.challenge?.bet_amount || 0,
        });
        return;
      }
      await supabase.from("activities").insert({
        user_id: inserted.user_id,
        type: "arena_rematch",
        challenge_id: inserted.id,
        message: `Revanche programmée sur ${inserted.sport}`,
      });
      await logNotification(
        {
          title: "Revanche lancee",
          body: `Nouveau defi : ${inserted.title}`,
        },
        "rematch"
      );
      Alert.alert("Revanche", "Defi revanche cree automatiquement !");
    } catch (e) {
      navigation.navigate("CreateChallenge", {
        rematchSport: item.challenge?.sport,
        rematchTitle: item.challenge?.title,
        rematchBet: item.challenge?.bet_amount || 0,
      });
    }
  };

  const renderItem = ({ item }: { item: ArenaActivity }) => {
    const palette = getSportPalette(item.challenge?.sport || "");
    const isFinished = item.type === "arena_finished";
    const stake = item.challenge?.bet_amount || 0;
    const pseudo =
      profilesMap.get(item.user_id)?.pseudo ||
      `Joueur ${item.user_id.slice(0, 4)}`;
    const fairPlay = fairPlayMap.get(item.user_id);
    const tier = typeof fairPlay === "number" ? getFairPlayTier(fairPlay) : null;
    const typeLabel =
      item.type === "arena_live_start" ? "LANCEMENT" : "FINISH";
    const typeColor =
      item.type === "arena_live_start" ? COLORS.primary : COLORS.accent;
    const resultIcon = isFinished ? "🏁" : "⚡";

    return (
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: palette.border,
          padding: 14,
          marginBottom: 12,
          backgroundColor: palette.card,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: palette.text,
                fontSize: 15,
                fontWeight: "800",
              }}
            >
              {item.challenge?.title || "Defi"}
            </Text>
            <Text
              style={{
                color: palette.text,
                fontSize: 12,
                opacity: 0.7,
                marginTop: 2,
              }}
            >
              {new Date(item.created_at).toLocaleString("fr-FR")}
            </Text>
          </View>
          <View
            style={{
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: typeColor,
              marginRight: 8,
              backgroundColor: typeColor + "11",
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: typeColor,
              }}
            >
              {typeLabel}
            </Text>
          </View>
          <SportTag sport={item.challenge?.sport || ""} />
        </View>

        <Text
          style={{
            marginTop: 10,
            color: palette.text,
            fontSize: 13,
          }}
        >
          {item.message}
        </Text>

       <View
         style={{
           marginTop: 10,
           padding: 10,
           borderRadius: 12,
           borderWidth: 1,
           borderColor: palette.border,
           backgroundColor: palette.background,
         }}
       >
          <Text
            style={{
              color: palette.text,
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            {isFinished ? `Gagnant : ${pseudo}` : "Session en cours..."}
          </Text>
          <Text
            style={{
              color: palette.text,
              fontSize: 12,
              marginTop: 4,
            }}
          >
            Mise : {stake} coins
          </Text>
          {tier && (
            <Text
              style={{
                color: tier.color,
                fontSize: 12,
                marginTop: 4,
              }}
            >
              Tier {tier.label} • Fair-play {fairPlay}
            </Text>
          )}
          <Text
            style={{
              color: palette.text,
              fontSize: 20,
              marginTop: 6,
            }}
          >
            {resultIcon}
          </Text>
          <TouchableOpacity
            onPress={() => handleRematch(item)}
            style={{
              marginTop: 8,
              paddingVertical: 6,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: COLORS.primary,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: COLORS.primary,
                fontWeight: "700",
              }}
            >
              Lancer une revanche
            </Text>
          </TouchableOpacity>
       </View>
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
          marginBottom: 16,
        }}
      >
        Historique Arena
      </Text>
      <View style={{ marginBottom: 14 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterChip
            label="Tous sports"
            active={sportFilter === "all"}
            onPress={() => setSportFilter("all")}
          />
          {sports.map((sport) => (
            <FilterChip
              key={sport}
              label={sport}
              active={sportFilter === sport}
              onPress={() => setSportFilter(sport)}
            />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 8 }}
        >
          {["all", "Legend", "Clean Fighter", "Surveillance", "Danger"].map(
            (tier) => (
              <FilterChip
                key={tier}
                label={tier === "all" ? "Tous tiers" : tier}
                active={tierFilter === tier}
                onPress={() => setTierFilter(tier)}
              />
            )
          )}
        </ScrollView>
      </View>

      <View
        style={{
          borderWidth: 1,
          borderColor: COLORS.border,
          borderRadius: 18,
          padding: 14,
          marginBottom: 18,
          backgroundColor: COLORS.surface,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "800",
            color: COLORS.text,
            marginBottom: 8,
          }}
        >
          Salles récentes
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {["all", "waiting", "live", "finished", "canceled"].map((status) => (
            <FilterChip
              key={status}
              label={status === "all" ? "Tous statuts" : status}
              active={roomStatusFilter === status}
              onPress={() => setRoomStatusFilter(status)}
            />
          ))}
        </ScrollView>
        {filteredRooms.length === 0 ? (
          <Text style={{ color: COLORS.textMuted, marginTop: 10 }}>
            Aucune salle n'a encore été enregistrée.
          </Text>
        ) : (
          filteredRooms.map((room) => {
            const palette = getSportPalette(room.challenge?.sport || "");
            return (
              <View
                key={room.id}
                style={{
                  marginTop: 10,
                  borderWidth: 1,
                  borderRadius: 14,
                  borderColor: palette.border,
                  padding: 10,
                  backgroundColor: palette.card,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <Text
                    style={{
                      color: palette.text,
                      fontWeight: "800",
                    }}
                  >
                    {room.challenge?.title || `Room ${room.id}`}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: COLORS.textMuted,
                    }}
                  >
                    {room.status.toUpperCase()}
                  </Text>
                </View>
                <Text style={{ color: palette.text, fontSize: 12 }}>
                  Host : {room.host_id.slice(0, 6)}…{" "}
                  | Guest :{" "}
                  {room.guest_id ? room.guest_id.slice(0, 6) + "…" : "—"}
                </Text>
                <Text style={{ color: palette.text, fontSize: 12 }}>
                  Mise : {room.stake} coins
                </Text>
                <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>
                  {new Date(room.created_at).toLocaleString("fr-FR")}
                </Text>
              </View>
            );
          })
        )}
      </View>

      {filteredRows.length === 0 ? (
        <Text style={{ color: COLORS.textMuted }}>
          Aucun log Arena pour le moment.
        </Text>
      ) : (
        <FlatList
          data={filteredRows}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </ScreenContainer>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <View style={{ marginRight: 8 }}>
      <Text
        onPress={onPress}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: active ? COLORS.primary : COLORS.border,
          color: active ? "#050505" : COLORS.text,
          backgroundColor: active ? COLORS.primary : "transparent",
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </View>
  );
}
