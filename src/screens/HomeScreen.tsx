// src/screens/HomeScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Share,
} from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { Challenge } from "../types";
import ChallengeCard from "../components/ChallengeCard";
import AnimatedPress from "../components/AnimatedPress";
import { COLORS } from "../theme";
import { feedbackTap } from "../utils/feedback";

const HomeScreen = ({ navigation }: any) => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChallenges = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.log("HOME LOAD ERROR", error);
        setChallenges([]);
      } else if (data) {
        setChallenges(data as Challenge[]);
      }
    } catch (e) {
      console.log("HOME LOAD EXCEPTION", e);
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChallenges();
    setRefreshing(false);
  };

  const handleOpenDetail = (challenge: Challenge) => {
    feedbackTap();
    navigation.navigate("ChallengeDetail", { challengeId: challenge.id });
  };

  const handleShare = async (challenge: Challenge) => {
    try {
      feedbackTap();

      const message = `🔥 Viens me défier sur ${challenge.sport} !

Titre : ${challenge.title}
Objectif : ${challenge.target_value} ${challenge.unit}

Application Sport Challenge – on règle ça en vidéo.`;

      await Share.share({ message });
    } catch (e) {
      console.log("SHARE ERROR", e);
    }
  };

  const renderItem = ({ item }: { item: Challenge }) => {
    return (
      <View style={{ marginBottom: 16 }}>
        <AnimatedPress onPress={() => handleOpenDetail(item)}>
          <ChallengeCard challenge={item} />
        </AnimatedPress>

        <View
          style={{
            marginTop: 6,
            flexDirection: "row",
            justifyContent: "flex-end",
          }}
        >
          <TouchableOpacity
            onPress={() => handleShare(item)}
            style={{
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: "#020617",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: COLORS.primary,
              }}
            >
              📤 Partager ce défi
            </Text>
          </TouchableOpacity>
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
      <FlatList
        data={challenges}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 24,
                fontWeight: "900",
                color: COLORS.text,
                marginBottom: 4,
              }}
            >
              Défis du moment
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: COLORS.textMuted,
              }}
            >
              Scroll, choisis ton terrain, et viens clasher la street.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={{ marginTop: 40 }}>
            <Text
              style={{
                fontSize: 14,
                color: COLORS.textMuted,
                textAlign: "center",
              }}
            >
              Aucun défi pour l’instant. Sois le premier à en créer un.
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
};

export default HomeScreen;
