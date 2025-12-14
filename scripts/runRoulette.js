// scripts/runRoulette.js
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://sjnlilbsqecznpxbqukw.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error(
    "[roulette] Missing SUPABASE_SERVICE_KEY. Export it before running this script."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const ROULETTE_SPORTS = ["running", "basket", "pushups", "swim", "muscu", "foot"];
const MIN_LEVEL = 2;
const MIN_FAIR_PLAY = 40;
const DEADLINE_DAYS = 4;
const PENALTY_FAIR_PLAY = 10;
const PENALTY_POINTS = 20;

async function main() {
  await applyOverduePenalties();
  const weekId = getWeekId(new Date());
  const alreadySeeded = await hasWeekDraw(weekId);
  if (alreadySeeded) {
    console.log(`[roulette] Draw already exists for week ${weekId}.`);
    return;
  }
  const players = await fetchEligiblePlayers();
  if (players.length < 2) {
    console.log("[roulette] Not enough eligible players.");
    return;
  }
  const pairs = buildPairs(players);
  if (!pairs.length) {
    console.log("[roulette] No pairs generated.");
    return;
  }
  await insertDuels(pairs, weekId);
  console.log(
    `[roulette] Seeded ${pairs.length} duels for week ${weekId} (players: ${pairs
      .map((pair) => `${pair[0].user_id}/${pair[1].user_id}`)
      .join(", ")})`
  );
}

function getWeekId(date) {
  const ref = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = ref.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  ref.setUTCDate(ref.getUTCDate() + diff);
  ref.setUTCHours(0, 0, 0, 0);
  return ref.toISOString().slice(0, 10);
}

async function hasWeekDraw(weekId) {
  const { count, error } = await supabase
    .from("roulette_duels")
    .select("id", { count: "exact", head: true })
    .eq("week_id", weekId);
  if (error) {
    console.log("[roulette] Week check error", error);
    return true;
  }
  return (count || 0) > 0;
}

async function fetchEligiblePlayers() {
  const { data, error } = await supabase
    .from("players_stats")
    .select("user_id, level, fair_play_score, points")
    .gte("level", MIN_LEVEL)
    .gte("fair_play_score", MIN_FAIR_PLAY);
  if (error) {
    console.error("[roulette] Failed to fetch players", error);
    return [];
  }
  return (data || []).map((row) => ({
    user_id: row.user_id,
    level: row.level || 1,
    fair_play_score: row.fair_play_score || 100,
    points: row.points || 0,
  }));
}

function buildPairs(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const sorted = shuffled.sort((a, b) => a.level - b.level);
  const pairs = [];
  while (sorted.length > 1) {
    const current = sorted.shift();
    if (!current) break;
    let partnerIndex = sorted.findIndex(
      (other) => Math.abs(other.level - current.level) <= 1
    );
    if (partnerIndex === -1) partnerIndex = 0;
    const partner = sorted.splice(partnerIndex, 1)[0];
    if (partner) {
      pairs.push([current, partner]);
    }
  }
  return pairs;
}

async function insertDuels(pairs, weekId) {
  const now = new Date();
  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + DEADLINE_DAYS);
  const weekSeed = parseInt(weekId.replace(/-/g, ""), 10) || 1;
  const deadlineIso = deadline.toISOString();
  const payload = pairs.map((pair, index) => ({
    week_id: weekId,
    player_a: pair[0].user_id,
    player_b: pair[1].user_id,
    sport: ROULETTE_SPORTS[(index + weekSeed) % ROULETTE_SPORTS.length],
    status: "pending",
    penalty_applied: false,
    deadline: deadlineIso,
  }));
  const { error } = await supabase.from("roulette_duels").insert(payload);
  if (error) {
    console.error("[roulette] Failed to insert duels", error);
    return;
  }
  await notifyPlayers(pairs, weekSeed, deadlineIso);
}

async function applyOverduePenalties() {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("roulette_duels")
    .select("id, player_a, player_b, penalty_applied")
    .lte("deadline", nowIso)
    .in("status", ["pending", "challenge_created"])
    .eq("penalty_applied", false);
  if (error) {
    console.log("[roulette] Penalty fetch error", error);
    return;
  }
  for (const duel of data || []) {
    await penalizePlayer(duel.player_a, duel.id);
    await penalizePlayer(duel.player_b, duel.id);
    await supabase
      .from("roulette_duels")
      .update({ status: "penalized", penalty_applied: true })
      .eq("id", duel.id);
    console.log(`[roulette] Penalty applied to duel ${duel.id}`);
  }
}

async function penalizePlayer(userId, duelId) {
  if (!userId) return;
  const { data, error } = await supabase
    .from("players_stats")
    .select("fair_play_score, points")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return;
  const nextFairPlay = Math.max((data.fair_play_score || 0) - PENALTY_FAIR_PLAY, 0);
  const nextPoints = Math.max((data.points || 0) - PENALTY_POINTS, 0);
  await supabase
    .from("players_stats")
    .update({ fair_play_score: nextFairPlay, points: nextPoints })
    .eq("user_id", userId);
  await supabase.from("activities").insert({
    user_id: userId,
    type: "roulette_penalty",
    challenge_id: null,
    message: `Pénalité roulette (duel ${duelId}) : -${PENALTY_FAIR_PLAY} fair-play, -${PENALTY_POINTS} pts.`,
  });
}

async function notifyPlayers(pairs, weekSeed, deadlineIso) {
  const deadlineLabel = new Date(deadlineIso).toLocaleDateString("fr-FR");
  const rows = [];
  pairs.forEach((pair, index) => {
    const sport = ROULETTE_SPORTS[(index + weekSeed) % ROULETTE_SPORTS.length];
    pair.forEach((player) => {
      rows.push({
        user_id: player.user_id,
        title: "Roulette russe",
        body: `Tu es tiré au sort en ${sport}. Publie ta vidéo avant le ${deadlineLabel}.`,
        type: "roulette",
      });
    });
  });
  if (!rows.length) return;
  await supabase.from("coach_notifications").insert(rows);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[roulette] Fatal error", err);
    process.exit(1);
  });
