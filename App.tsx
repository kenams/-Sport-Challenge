// App.tsx
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
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
      <Tab.Screen name="Defis" component={HomeScreen} />
      <Tab.Screen name="Activite" component={FeedScreen} />
      <Tab.Screen name="Classement" component={LeaderboardScreen} />
      <Tab.Screen name="Boutique" component={ShopScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<any>(null);

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
