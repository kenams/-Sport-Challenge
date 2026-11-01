// Paramètres de navigation partagés par tous les écrans.
export type RootStackParamList = {
  // Authentification
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  // Application
  MainTabs: undefined;
  CreateChallenge: { formatKey?: "pushups_60s" | "pullups_max"; recipientId?: string; recipientPseudo?: string } | undefined;
  ChallengeDetail: { challengeId: string };
  RespondChallenge: { challengeId: string };
  Moderation: undefined;
  Events: undefined;
  ProposeEvent: { opponentId?: string; opponentPseudo?: string } | undefined;
  EventDetail: { eventId: string };
  Pro: undefined;
  // Accessible avec ou sans compte (lien partagé)
  PublicEvent: { slug: string };
};

export type MainTabParamList = {
  Defis: undefined;
  Creer: undefined;
  Classement: undefined;
  Evenements: undefined;
  Profil: undefined;
};
