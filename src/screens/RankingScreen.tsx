import React, { useEffect, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { supabase } from "../supabase";
import ScreenContainer from "../components/ScreenContainer";

export default function RankingScreen() {
  const [ranking, setRanking] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("players_stats")
      .select("user_id, points, level")
      .order("points", { ascending: false });
    if (!data) return;

    const profiles = [];
    for (let p of data) {
      const { data: user } = await supabase
        .from("users")
        .select("email")
        .eq("id", p.user_id)
        .single();
      profiles.push({ ...p, email: user?.email ?? "joueur" });
    }
    setRanking(profiles);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 22, fontWeight: "bold", marginBottom: 12 }}>
        🏆 Classement
      </Text>
      <FlatList
        data={ranking}
        keyExtractor={(item) => item.user_id}
        renderItem={({ item, index }) => (
          <View
            style={{
              marginBottom: 10,
              borderWidth: 1,
              borderRadius: 10,
              padding: 12,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>
              #{index + 1} — {item.email}
            </Text>
            <Text>Points : {item.points}</Text>
            <Text>Niveau : {item.level}</Text>
          </View>
        )}
      />
    </ScreenContainer>
  );
}
