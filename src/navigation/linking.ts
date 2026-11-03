import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

export const WEB_BASE_URL = ((process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "").trim() || "https://immortal-arena.vercel.app").replace(/\/$/, "");

// Chaque URL produite doit aussi être reconnue après rechargement ou ouverture dans un autre navigateur.
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [WEB_BASE_URL, "immortal://"],
  config: {
    screens: {
      MainTabs: {
        path: "MainTabs",
        screens: { Defis: "Defis", Creer: "Creer", Classement: "Classement", Evenements: "Evenements", Groupes: "Groupes", Profil: "Profil" },
      },
      PublicEvent: "e/:slug",
      ChallengeDetail: "d/:challengeId",
      EventDetail: "duels/:eventId",
      DuelLive: "duels/:eventId/live",
      CameraJudgeTest: "camera-test",
      CreateChallenge: "CreateChallenge",
      RespondChallenge: "RespondChallenge",
      ProposeEvent: "ProposeEvent",
      Moderation: "Moderation",
      Pro: "Pro",
      Onboarding: "Onboarding",
      Login: "connexion",
      ResetPassword: "reinitialiser-mot-de-passe",
      Register: "inscription",
    },
  },
};
