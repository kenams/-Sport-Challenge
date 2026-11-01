import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

// Chaque URL produite doit aussi être reconnue après rechargement ou ouverture dans un autre navigateur.
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [(process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "").trim() || "immortal://"],
  config: {
    screens: {
      MainTabs: {
        path: "MainTabs",
        screens: { Defis: "Defis", Creer: "Creer", Classement: "Classement", Evenements: "Evenements", Profil: "Profil" },
      },
      PublicEvent: "e/:slug",
      ChallengeDetail: "d/:challengeId",
      EventDetail: "duels/:eventId",
      CreateChallenge: "CreateChallenge",
      RespondChallenge: "RespondChallenge",
      ProposeEvent: "ProposeEvent",
      Moderation: "Moderation",
      Pro: "Pro",
      Onboarding: "Onboarding",
      Login: "connexion",
      Register: "inscription",
    },
  },
};
