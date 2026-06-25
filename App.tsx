import React, { useEffect, useState } from "react";
import { registerForPushNotifications } from "./src/notifications";
import { View, ActivityIndicator, Image, Text, TouchableOpacity } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { FontAwesome5 } from "@expo/vector-icons";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "./src/supabase";

import LoginScreen from "./src/screens/Auth/LoginScreen";
import RegisterScreen from "./src/screens/Auth/RegisterScreen";
import OnboardingScreen, { hasSeenOnboarding } from "./src/screens/OnboardingScreen";

import ChallengesScreen from "./src/screens/ChallengesScreen";
import CreateChallengeScreen from "./src/screens/CreateChallengeScreen";
import ChallengeDetailScreen from "./src/screens/ChallengeDetailScreen";
import RespondChallengeScreen from "./src/screens/RespondChallengeScreen";
import LeaderboardScreen from "./src/screens/LeaderboardScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

import { ensurePlayerStats } from "./src/utils/playerStats";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const logoSource = require("./assets/immortal-k-logo.png");

function CreateButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "#D4AF37",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
        shadowColor: "#D4AF37",
        shadowOpacity: 0.5,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      }}
    >
      <FontAwesome5 name="plus" size={20} color="#08080C" />
    </TouchableOpacity>
  );
}

function MainTabs({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 0);
  const tabBarHeight = 64 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#08080C",
          borderTopColor: "rgba(255,255,255,0.06)",
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: Math.max(bottomInset, 8),
          paddingTop: 6,
        },
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: "#D4AF37",
        tabBarInactiveTintColor: "#5A5B62",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
      }}
    >
      <Tab.Screen
        name="Defis"
        component={ChallengesScreen}
        options={{
          tabBarLabel: "Défis",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="fire" size={size - 2} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Creer"
        component={CreateChallengeScreen}
        options={{
          tabBarLabel: "",
          tabBarButton: () => (
            <CreateButton onPress={() => navigation.navigate("CreateChallenge")} />
          ),
        }}
      />
      <Tab.Screen
        name="Classement"
        component={LeaderboardScreen}
        options={{
          tabBarLabel: "Top",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="trophy" size={size - 2} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Moi",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="user" size={size - 2} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (session) registerForPushNotifications().catch(() => {});
  }, [session]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      if (!data.session) {
        const seen = await hasSeenOnboarding();
        setShowOnboarding(!seen);
      }
      setInitializing(false);
    };
    init();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    ensurePlayerStats(uid).catch(() => {});
    supabase
      .from("players_stats")
      .update({ last_active_at: new Date().toISOString() })
      .eq("user_id", uid)
      .then(() => {});
  }, [session?.user?.id]);

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: "#020617", justifyContent: "center", alignItems: "center" }}>
        <Image source={logoSource} style={{ width: 120, height: 120, marginBottom: 16 }} resizeMode="contain" />
        <Text style={{ fontSize: 20, fontWeight: "900", color: "#FACC15", letterSpacing: 2, marginBottom: 8 }}>
          IMMORTAL-K
        </Text>
        <ActivityIndicator size="large" color="#FACC15" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {session ? (
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen name="CreateChallenge" component={CreateChallengeScreen} />
              <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen as any} />
              <Stack.Screen name="RespondChallenge" component={RespondChallengeScreen} />
            </>
          ) : showOnboarding ? (
            <>
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
