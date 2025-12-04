const { createClient } = require("@supabase/supabase-js");

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[cron:reminders] SUPABASE_URL ou clé service manquante");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);
  const now = new Date();
  const windowStart = new Date(now.getTime() + 14 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 16 * 60 * 1000);

  const { data: lives, error } = await supabase
    .from("lives_schedule")
    .select("id,user_id,challenge_id,title,scheduled_at,reminder_sent")
    .eq("reminder_sent", false)
    .gte("scheduled_at", windowStart.toISOString())
    .lte("scheduled_at", windowEnd.toISOString());

  if (error) {
    console.error("[cron:reminders] select error", error.message);
    process.exit(1);
  }

  if (!lives || lives.length === 0) {
    console.log("[cron:reminders] aucun live à rappeler");
    return;
  }

  for (const live of lives) {
    const scheduledDate = new Date(live.scheduled_at);
    const body = `${live.title} démarre à ${scheduledDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}. Prépare ton Arena Live.`;

    const { error: notifError } = await supabase.from("coach_notifications").insert({
      user_id: live.user_id,
      title: "Live dans 15 min",
      body,
      type: "live_reminder",
    });
    if (notifError) {
      console.error("[cron:reminders] notif error", notifError.message);
      continue;
    }

    await supabase
      .from("lives_schedule")
      .update({ reminder_sent: true })
      .eq("id", live.id);
    console.log(`[cron:reminders] rappel envoyé pour live #${live.id}`);
  }
}

main().catch((err) => {
  console.error("[cron:reminders]", err.message || err);
  process.exit(1);
});
