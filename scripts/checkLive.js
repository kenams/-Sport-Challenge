require("./loadEnv");
const { createClient } = require("@supabase/supabase-js");

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    console.error("[check:live] SUPABASE_URL ou clé manquante");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);
  const suffix = Date.now();
  const email1 = `live_bot_a_${suffix}@immortal-k.test`;
  const email2 = `live_bot_b_${suffix}@immortal-k.test`;
  const password = "Test1234!";

  console.log("[1/5] Création des joueurs...");
  const { data: userA, error: errA } = await supabase.auth.admin.createUser({
    email: email1,
    password,
    email_confirm: true,
    user_metadata: { pseudo: "Live Bot A" },
  });
  if (errA || !userA?.user?.id) {
    throw new Error(`Creation user A échouée: ${errA?.message}`);
  }
  const { data: userB, error: errB } = await supabase.auth.admin.createUser({
    email: email2,
    password,
    email_confirm: true,
    user_metadata: { pseudo: "Live Bot B" },
  });
  if (errB || !userB?.user?.id) {
    throw new Error(`Creation user B échouée: ${errB?.message}`);
  }

  const userIdA = userA.user.id;
  const userIdB = userB.user.id;

  await supabase.from("profiles").upsert([
    { user_id: userIdA, pseudo: "Live Bot A", department: "75" },
    { user_id: userIdB, pseudo: "Live Bot B", department: "92" },
  ]);

  console.log("[2/5] Création challenge_type et live_event...");
  const { data: challengeType, error: ctError } = await supabase
    .from("challenge_types")
    .insert({
      name: `QA Live ${suffix}`,
      sport: "pushups",
      unit: "reps",
      default_target: 20,
      description: "QA live type",
    })
    .select("id")
    .single();
  if (ctError || !challengeType) {
    throw new Error(`Creation challenge_type échouée: ${ctError?.message}`);
  }

  const { data: liveEvent, error: liveError } = await supabase
    .from("live_events")
    .insert({
      challenge_type_id: challengeType.id,
      player1_id: userIdA,
      player2_id: userIdB,
      scheduled_at: new Date().toISOString(),
      status: "scheduled",
    })
    .select("id")
    .single();
  if (liveError || !liveEvent) {
    throw new Error(`Creation live_event échouée: ${liveError?.message}`);
  }

  const liveId = liveEvent.id;

  console.log("[3/5] Passage en live + fin du live...");
  await supabase.from("live_events").update({ status: "live" }).eq("id", liveId);
  await supabase
    .from("live_events")
    .update({ status: "finished" })
    .eq("id", liveId);

  console.log("[4/5] Votes + commentaires...");
  const { error: voteError } = await supabase.from("live_votes").insert([
    { live_event_id: liveId, user_id: userIdA, voted_for: "player1" },
    { live_event_id: liveId, user_id: userIdB, voted_for: "player1" },
  ]);
  if (voteError) {
    throw new Error(`Vote live échoué: ${voteError.message}`);
  }

  const { error: commentError } = await supabase.from("live_comments").insert({
    live_event_id: liveId,
    user_id: userIdA,
    pseudo: "Live Bot A",
    message: "Test commentaire live",
  });
  if (commentError) {
    throw new Error(`Commentaire live échoué: ${commentError.message}`);
  }

  console.log("[5/5] Finalisation + vérifications...");
  const { error: finalizeError } = await supabase.rpc("finalize_live_votes", {
    p_live_event_id: liveId,
  });
  if (finalizeError) {
    throw new Error(`Finalize live votes échoué: ${finalizeError.message}`);
  }

  const { data: liveCheck } = await supabase
    .from("live_events")
    .select("winner_id,status")
    .eq("id", liveId)
    .maybeSingle();

  if (!liveCheck?.winner_id) {
    throw new Error("Winner_id non défini après finalize.");
  }

  const { data: notifCheck } = await supabase
    .from("notifications")
    .select("id,type")
    .eq("user_id", userIdA)
    .in("type", ["live_started", "live_finished", "live_vote_open", "live_winner"]);

  console.log(
    `[check:live] Notifs live pour user A: ${notifCheck?.length ?? 0}`
  );
  console.log("Flow Live QA terminé avec succès.");

  await supabase.from("live_comments").delete().eq("live_event_id", liveId);
  await supabase.from("live_votes").delete().eq("live_event_id", liveId);
  await supabase.from("live_events").delete().eq("id", liveId);
  await supabase.from("challenge_types").delete().eq("id", challengeType.id);
  await supabase.from("profiles").delete().in("user_id", [userIdA, userIdB]);
  await supabase.auth.admin.deleteUser(userIdA);
  await supabase.auth.admin.deleteUser(userIdB);
}

main().catch((err) => {
  console.error("[check:live]", err.message || err);
  process.exit(1);
});
