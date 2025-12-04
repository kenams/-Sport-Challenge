// App.tsx
import React, { useEffect, useState } from "react";
import { registerForPushNotifications } from "./src/notifications";
import { View, ActivityIndicator, Image, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { supabase } from "./src/supabase";

// Ecrans Auth
import LoginScreen from "./src/screens/Auth/LoginScreen";
import RegisterScreen from "./src/screens/Auth/RegisterScreen";

// Ecrans principaux
import HomeScreen from "./src/screens/HomeScreen";
import FeedScreen from "./src/screens/FeedScreen";
import LeaderboardScreen from "./src/screens/LeaderboardScreen";
import ShopScreen from "./src/screens/ShopScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

// Ecrans secondaires
import CreateChallengeScreen from "./src/screens/CreateChallengeScreen";
import ChallengeDetailScreen from "./src/screens/ChallengeDetailScreen";
import RespondChallengeScreen from "./src/screens/RespondChallengeScreen";
import PunishmentScreen from "./src/screens/PunishmentScreen";
import ArenaLiveScreen from "./src/screens/ArenaLiveScreen";
import ArenaHistoryScreen from "./src/screens/ArenaHistoryScreen";
import ImpitoyableDashboard from "./src/screens/ImpitoyableDashboard";
import FairPlayHelpScreen from "./src/screens/FairPlayHelpScreen";
import ArenaReportsScreen from "./src/screens/ArenaReportsScreen";
import CoachNotificationsScreen from "./src/screens/CoachNotificationsScreen";
import WalletHistoryScreen from "./src/screens/WalletHistoryScreen";
import AdminAuditScreen from "./src/screens/AdminAuditScreen";
import ArenaChallengesScreen from "./src/screens/ArenaChallengesScreen";
import LiveHubScreen from "./src/screens/LiveHubScreen";
import { ensurePlayerStats } from "./src/utils/playerStats";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const logoSource = require("./assets/immortal-k-logo.png");

function MainTabs() {
  const [dailyReady, setDailyReady] = useState(false);
  const [rivalAlert, setRivalAlert] = useState(false);
  const [coachAlert, setCoachAlert] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchBadges = async () => {
      try {
        const { data: ses } = await supabase.auth.getSession();
        const uid = ses.session?.user.id;

        if (!uid) {
          if (isMounted) {
            setDailyReady(false);
            setRivalAlert(false);
            setCoachAlert(false);
          }
          return;
        }

        const { data: daily } = await supabase
          .from("daily_rewards")
          .select("last_claimed_at")
          .eq("user_id", uid)
          .maybeSingle();

        if (isMounted) {
          if (!daily) {
            setDailyReady(true);
          } else {
            const last = new Date((daily as any).last_claimed_at).getTime();
            setDailyReady(Date.now() - last >= 24 * 60 * 60 * 1000);
          }
        }

        const { data: coachNotifs } = await supabase
          .from("coach_notifications")
          .select("id,type,seen")
          .eq("user_id", uid)
          .eq("seen", false);

        if (isMounted) {
          const rivalry = (coachNotifs || []).filter(
            (n) => n.type === "dept_rivalry"
          ).length;
          const otherCoach = (coachNotifs || []).filter(
            (n) => n.type !== "dept_rivalry"
          ).length;
          setRivalAlert(rivalry > 0);
          setCoachAlert(otherCoach > 0);
        }
      } catch (err) {
        console.log("MAIN TABS BADGE ERROR", err);
      }
    };

    fetchBadges();
    const interval = setInterval(fetchBadges, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#020617",
          borderTopColor: "#1F2933",
        },
        tabBarActiveTintColor: "#FACC15",
        tabBarInactiveTintColor: "#9CA3AF",
      }}
    >
      <Tab.Screen
        name="Defis"
        component={HomeScreen}
        options={{ tabBarLabel: "Arène" }}
      />
      <Tab.Screen
        name="Activite"
        component={FeedScreen}
        options={{ tabBarLabel: "Flux" }}
      />
      <Tab.Screen
        name="Classement"
        component={LeaderboardScreen}
        options={{
          tabBarLabel: "Tableau",
          tabBarBadge: rivalAlert ? "!" : undefined,
        }}
      />
      <Tab.Screen
        name="Boutique"
        component={ShopScreen}
        options={{
          tabBarLabel: "Boutique",
          tabBarBadge: dailyReady ? "!" : undefined,
        }}
      />
      <Tab.Screen
        name="Coach"
        component={ImpitoyableDashboard}
        options={{
          tabBarLabel: "Coach",
          tabBarBadge: coachAlert ? "!" : undefined,
        }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{ tabBarLabel: "Profil" }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<any>(null);
  useEffect(() => {
    if (session) {
      registerForPushNotifications().catch(() => {});
    }
  }, [session]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      setInitializing(false);
    };
    init();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    ensurePlayerStats(uid).catch(() => {
      // éviter de bloquer l'app en cas d'échec silencieux
    });
  }, [session?.user?.id]);

  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#020617",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Image
          source={logoSource}
          style={{ width: 120, height: 120, marginBottom: 16 }}
          resizeMode="contain"
        />
        <Text
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: "#FACC15",
            letterSpacing: 2,
            marginBottom: 8,
          }}
        >
          IMMORTAL-K
        </Text>
        <ActivityIndicator size="large" color="#FACC15" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
              name="CreateChallenge"
              component={CreateChallengeScreen}
            />
            <Stack.Screen
              name="ChallengeDetail"
              component={ChallengeDetailScreen}
            />
            <Stack.Screen
              name="RespondChallenge"
              component={RespondChallengeScreen}
            />
            <Stack.Screen
              name="PunishmentScreen"
              component={PunishmentScreen}
            />
            <Stack.Screen name="ArenaLive" component={ArenaLiveScreen} />
            <Stack.Screen name="ArenaHistory" component={ArenaHistoryScreen} />
            <Stack.Screen
              name="ImpitoyableDashboard"
              component={ImpitoyableDashboard}
            />
            <Stack.Screen
              name="FairPlayHelp"
              component={FairPlayHelpScreen}
            />
            <Stack.Screen
              name="ArenaReports"
              component={ArenaReportsScreen}
            />
            <Stack.Screen
              name="CoachNotifications"
              component={CoachNotificationsScreen}
            />
            <Stack.Screen
              name="WalletHistory"
              component={WalletHistoryScreen}
            />
            <Stack.Screen
              name="AdminAudit"
              component={AdminAuditScreen}
            />
            <Stack.Screen
              name="ArenaChallenges"
              component={ArenaChallengesScreen}
            />
            <Stack.Screen name="LiveHub" component={LiveHubScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
