const { createClient } = require("@supabase/supabase-js");
const { randomUUID } = require("crypto");

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    console.error("[check:flows] SUPABASE_URL ou clé manquante");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);
  console.log("[1/3] Test inscription (admin.createUser)...");
  const email = `bot_${Date.now()}@immortal-k.test`;
  const password = "Test1234!";
  const { data: createdUser, error: userError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { pseudo: "QA Bot" },
  });
  if (userError || !createdUser?.user?.id) {
    throw new Error(`Création utilisateur échouée: ${userError?.message}`);
  }
  const userId = createdUser.user.id;
  console.log(`    -> OK (${email})`);

  console.log("[2/3] Test création de défi...");
  const challengePayload = {
    user_id: userId,
    title: "QA Flow",
    description: "Défi automatique",
    sport: "pushup",
    target_value: 10,
    unit: "reps",
    video_url: "https://example.com/video.mp4",
  };
  const { data: insertedChallenge, error: challengeError } = await supabase
    .from("challenges")
    .insert(challengePayload)
    .select("*")
    .single();
  if (challengeError || !insertedChallenge) {
    throw new Error(`Création défi échouée: ${challengeError?.message}`);
  }
  console.log("    -> OK (challenge id", insertedChallenge.id, ")");

  console.log("[3/3] Test programmation live...");
  const schedulePayload = {
    user_id: userId,
    challenge_id: insertedChallenge.id,
    title: "QA Live",
    scheduled_at: new Date(Date.now() + 15 * 60000).toISOString(),
  };
  const { error: scheduleError } = await supabase
    .from("lives_schedule")
    .insert(schedulePayload);
  if (scheduleError) {
    throw new Error(`Programmation live échouée: ${scheduleError.message}`);
  }
  console.log("    -> OK (live programmé)");

  console.log("Flow QA terminé avec succès.");

  await supabase.auth.admin.deleteUser(userId);
}

main().catch((err) => {
  console.error("[check:flows]", err.message || err);
  process.exit(1);
});
