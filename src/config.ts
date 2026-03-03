// src/config.ts
export const SIMPLE_MODE =
  (process.env.EXPO_PUBLIC_SIMPLE_MODE ?? "true").toLowerCase() === "true";

export const ADMIN_EMAILS = (process.env.EXPO_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((email: string) => email.trim().toLowerCase())
  .filter(Boolean);