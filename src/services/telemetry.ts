import { supabase } from "../supabase";

export async function logEvent(
  type: string,
  payload?: Record<string, any>
): Promise<void> {
  try {
    await supabase.from("events").insert({
      type,
      payload: payload || null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.log("TELEMETRY ERROR", err);
  }
}
