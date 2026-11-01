// src/utils/demoData.ts
import { Challenge, ChallengeResponse, PlayerStats, UserProfile } from "../types";

export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === "true";

export const demoData = {
  challenges: [] as Challenge[],
  responsesByChallenge: new Map<number, ChallengeResponse[]>(),
  profilesMap: new Map<string, UserProfile>(),
  activities: [] as any[],
  notifications: [] as any[],
};

export const getDemoChallenge = (_id: number) => null;
export const getDemoResponses = (_id: number) => [] as ChallengeResponse[];
export const getDemoParticipantCount = (_id: number) => 0;
export const getDemoUserProfile = (_userId: string) => null as UserProfile | null;
export const getDemoProfilesList = () => [] as UserProfile[];
export const getDemoUserChallenges = (_userId: string) => [] as Challenge[];
export const getDemoUserResponses = (_userId: string) => [] as ChallengeResponse[];
export const getDemoVotesReceived = (_userId: string) => 0;
export const getDemoUserStats = (_userId: string): PlayerStats => ({
  user_id: _userId,
  level: 1,
  points: 0,
});
export const getDemoActivities = () => [] as any[];
export const getDemoNotifications = () => [] as any[];
export const getDemoUnreadCount = () => 0;
