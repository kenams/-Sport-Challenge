import { supabase } from "../supabase";
import { UserProfile } from "../types";

export async function fetchProfilesMap(
  userIds: string[]
): Promise<Map<string, UserProfile>> {
  const unique = Array.from(
    new Set(userIds.filter((id): id is string => !!id && id.length > 0))
  );

  const map = new Map<string, UserProfile>();

  if (unique.length === 0) {
    return map;
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("user_id", unique);

    if (error) {
      console.log("PROFILES FETCH ERROR", error);
      return map;
    }

    (data || []).forEach((row) => {
      const profile = row as UserProfile;
      map.set(profile.user_id, profile);
    });
  } catch (e) {
    console.log("PROFILES FETCH EXCEPTION", e);
  }

  return map;
}
