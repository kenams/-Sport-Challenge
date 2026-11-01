import React, { useEffect, useState } from "react";
import { registerForPushNotifications } from "./src/notifications";
import { View, ActivityIndicator, Image, Text, TouchableOpacity } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { FontAwesome5 } from "@expo/vector-icons";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "./src/supabase";
import { ensurePlayer } from "./src/services/api";

import LoginScreen from "./src/screens/Auth/LoginScreen";
import RegisterScreen from "./src/screens/Auth/RegisterScreen";
import OnboardingScreen, { hasSeenOnboarding } from "./src/screens/OnboardingScreen";

import ChallengesScreen from "./src/screens/ChallengesScreen";
import CreateChallengeScreen from "./src/screens/CreateChallengeScreen";
import ChallengeDetailScreen from "./src/screens/ChallengeDetailScreen";
import RespondChallengeScreen from "./src/screens/RespondChallengeScreen";
import LeaderboardScreen from "./src/screens/LeaderboardScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import ModerationScreen from "./src/screens/ModerationScreen";
import EventsScreen from "./src/screens/EventsScreen";
import ProposeEventScreen from "./src/screens/ProposeEventScreen";
import EventDetailScreen from "./src/screens/EventDetailScreen";
import PublicEventScreen from "./src/screens/PublicEventScreen";
import ProScreen from "./src/screens/ProScreen";

import { linking } from "./src/navigation/linking";
import type { MainTabParamList, RootStackParamList } from "./src/navigation/types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const logoSource = require("./assets/immortal-k-logo.png");

function CreateButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Lancer un défi"
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
        tabBarInactiveTintColor: "#9A9BA3",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
      }}
    >
      <Tab.Screen
        name="Defis"
        component={ChallengesScreen}
        options={{
          tabBarLabel: "Défis",
          tabBarAccessibilityLabel: "Défis",
          tabBarIcon: ({ color, size }) => <FontAwesome5 name="fire" size={size - 2} color={color} />,
        }}
      />
      <Tab.Screen
        name="Classement"
        component={LeaderboardScreen}
        options={{
          tabBarLabel: "Records",
          tabBarAccessibilityLabel: "Records et classements",
          tabBarIcon: ({ color, size }) => <FontAwesome5 name="trophy" size={size - 2} color={color} />,
        }}
      />
      <Tab.Screen
        name="Creer"
        component={CreateChallengeScreen}
        options={{
          tabBarLabel: "",
          tabBarAccessibilityLabel: "Lancer un défi",
          tabBarButton: () => <CreateButton onPress={() => navigation.navigate("CreateChallenge")} />,
        }}
      />
      <Tab.Screen
        name="Evenements"
        component={EventsScreen}
        options={{
          tabBarLabel: "Duels",
          tabBarAccessibilityLabel: "Duels et événements",
          tabBarIcon: ({ color, size }) => <FontAwesome5 name="calendar-alt" size={size - 2} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Moi",
          tabBarAccessibilityLabel: "Mon profil",
          tabBarIcon: ({ color, size }) => <FontAwesome5 name="user" size={size - 2} color={color} />,
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

  // Le serveur crée la ligne de profil et de statistiques : le client n'écrit jamais ses propres points.
  useEffect(() => {
    if (!session?.user?.id) return;
    ensurePlayer().catch(() => {});
  }, [session?.user?.id]);

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: "#050507", justifyContent: "center", alignItems: "center" }}>
        <Image source={logoSource} style={{ width: 120, height: 120, marginBottom: 16 }} resizeMode="contain" />
        <Text style={{ fontSize: 20, fontWeight: "900", color: "#D4AF37", letterSpacing: 2, marginBottom: 8 }}>IMMORTAL</Text>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {session ? (
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen name="CreateChallenge" component={CreateChallengeScreen} />
              <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen as any} />
              <Stack.Screen name="RespondChallenge" component={RespondChallengeScreen as any} />
              <Stack.Screen name="Moderation" component={ModerationScreen} />
              <Stack.Screen name="ProposeEvent" component={ProposeEventScreen as any} />
              <Stack.Screen name="EventDetail" component={EventDetailScreen as any} />
              <Stack.Screen name="Pro" component={ProScreen} />
              <Stack.Screen name="PublicEvent" component={PublicEventScreen as any} />
            </>
          ) : showOnboarding ? (
            <>
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="PublicEvent" component={PublicEventScreen as any} />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="PublicEvent" component={PublicEventScreen as any} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
