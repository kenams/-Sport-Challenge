// App.tsx
import React, { useEffect, useState } from "react";
import { registerForPushNotifications } from "./src/notifications";
import { View, ActivityIndicator, Text, Platform, TouchableOpacity } from "react-native";
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
import SimpleHomeScreen from "./src/screens/SimpleHomeScreen";
import PublicTopVotesScreen from "./src/screens/PublicTopVotesScreen";
import PublicProfileScreen from "./src/screens/PublicProfileScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import LiveEventsScreen from "./src/screens/LiveEventsScreen";
import LiveEventDetailScreen from "./src/screens/LiveEventDetailScreen";
import TerritoryDetailScreen from "./src/screens/TerritoryDetailScreen";

// Ecrans secondaires
import CreateChallengeScreen from "./src/screens/CreateChallengeScreen";
import ChallengeDetailScreen from "./src/screens/ChallengeDetailScreen";
import SimpleChallengeDetailScreen from "./src/screens/SimpleChallengeDetailScreen";
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
import ModerationScreen from "./src/screens/ModerationScreen";
import TopVotesScreen from "./src/screens/TopVotesScreen";
import { ensurePlayerStats } from "./src/utils/playerStats";
import { SIMPLE_MODE } from "./src/config";
import { COLORS, TYPO } from "./src/theme";
import LogoMark from "./src/components/LogoMark";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const isWeb = Platform.OS === "web";
const tabBarBaseStyle = {
  backgroundColor: COLORS.background,
  borderTopColor: "rgba(255,255,255,0.08)",
};
const tabBarWebStyle = isWeb
  ? {
      position: "absolute" as const,
      left: 16,
      right: 16,
      bottom: 10,
      borderRadius: 22,
      height: 64,
      paddingBottom: 10,
      paddingTop: 6,
      backgroundColor: "rgba(10,10,14,0.95)",
      borderWidth: 1,
      borderColor: "rgba(212,175,55,0.2)",
      shadowColor: "#000",
      shadowOpacity: 0.4,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    }
  : null;
function SimpleTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [tabBarBaseStyle, tabBarWebStyle],
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: "#8C8C95",
        tabBarLabelStyle: {
          ...TYPO.subtitle,
          fontSize: 10,
          letterSpacing: 1.4,
        },
      }}
    >
      <Tab.Screen
        name="Accueil"
        component={SimpleHomeScreen}
        options={{ tabBarLabel: "Accueil" }}
      />
      <Tab.Screen
        name="Creer"
        component={CreateChallengeScreen}
        options={{ tabBarLabel: "Créer" }}
      />
      <Tab.Screen
        name="Classement"
        component={LeaderboardScreen}
        options={{ tabBarLabel: "Classement" }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{ tabBarLabel: "Profil" }}
      />
    </Tab.Navigator>
  );
}

function GuestTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [tabBarBaseStyle, tabBarWebStyle],
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: "#8C8C95",
        tabBarLabelStyle: {
          ...TYPO.subtitle,
          fontSize: 10,
          letterSpacing: 1.4,
        },
      }}
    >
      <Tab.Screen
        name="AccueilInvite"
        component={SimpleHomeScreen}
        options={{ tabBarLabel: "Accueil" }}
      />
      <Tab.Screen
        name="ClassementInvite"
        component={LeaderboardScreen}
        options={{ tabBarLabel: "Classement" }}
      />
      <Tab.Screen
        name="TopVotesInvite"
        component={PublicTopVotesScreen}
        options={{ tabBarLabel: "Top votes" }}
      />
    </Tab.Navigator>
  );
}

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
        tabBarStyle: [tabBarBaseStyle, tabBarWebStyle],
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: "#8C8C95",
        tabBarLabelStyle: {
          ...TYPO.subtitle,
          fontSize: 10,
          letterSpacing: 1.4,
        },
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
          backgroundColor: COLORS.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setInitializing(false)}
          style={{ alignItems: "center" }}
        >
          <LogoMark size={96} style={{ marginBottom: 16 }} />
          <Text
            style={{
              ...TYPO.display,
              color: COLORS.primary,
              marginBottom: 8,
            }}
          >
            IMMORTAL ARENA
          </Text>
        </TouchableOpacity>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen
              name="MainTabs"
              component={SIMPLE_MODE ? SimpleTabs : MainTabs}
            />
            {!SIMPLE_MODE && (
              <Stack.Screen
                name="CreateChallenge"
                component={CreateChallengeScreen}
              />
            )}
            <Stack.Screen
              name="ChallengeDetail"
              component={
                (SIMPLE_MODE
                  ? SimpleChallengeDetailScreen
                  : ChallengeDetailScreen) as any
              }
            />
            <Stack.Screen name="Moderation" component={ModerationScreen} />
            <Stack.Screen name="TopVotes" component={TopVotesScreen as any} />
            <Stack.Screen
              name="PublicTopVotes"
              component={PublicTopVotesScreen as any}
            />
            <Stack.Screen
              name="PublicProfile"
              component={PublicProfileScreen as any}
            />
            <Stack.Screen name="LiveEvents" component={LiveEventsScreen} />
            <Stack.Screen name="LiveEventDetail" component={LiveEventDetailScreen} />
            <Stack.Screen
              name="TerritoryDetail"
              component={TerritoryDetailScreen as any}
            />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen
              name="RespondChallenge"
              component={RespondChallengeScreen}
            />
            {!SIMPLE_MODE && (
              <>
                <Stack.Screen
                  name="PunishmentScreen"
                  component={PunishmentScreen as any}
                />
                <Stack.Screen
                  name="ArenaLive"
                  component={ArenaLiveScreen as any}
                />
                <Stack.Screen
                  name="ArenaHistory"
                  component={ArenaHistoryScreen}
                />
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
            )}
          </>
        ) : (
          <>
            <Stack.Screen name="GuestTabs" component={GuestTabs} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} />
            <Stack.Screen
              name="PublicProfile"
              component={PublicProfileScreen as any}
            />
            <Stack.Screen name="LiveEvents" component={LiveEventsScreen} />
            <Stack.Screen name="LiveEventDetail" component={LiveEventDetailScreen} />
            <Stack.Screen
              name="TerritoryDetail"
              component={TerritoryDetailScreen as any}
            />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
