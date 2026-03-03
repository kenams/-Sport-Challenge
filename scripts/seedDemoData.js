const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value.replace(/^"|"$/g, "");
    }
  });
};

loadEnvFile(path.resolve(process.cwd(), ".env.local"));

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL/EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const seedTag = `demo_${Date.now()}`;
const sampleVideos = [
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
];

const demoUsers = [
  { pseudo: "Kah Alpha", department: "75" },
  { pseudo: "Maya Flash", department: "92" },
  { pseudo: "Noah Sprint", department: "93" },
  { pseudo: "Sanaa Drift", department: "91" },
  { pseudo: "Lina Force", department: "94" },
  { pseudo: "Rayan Pulse", department: "77" },
];

const challengeTemplates = [
  {
    title: "Sprint 100m",
    description: "Sprint sec, chrono en main. Pas de depart anticipe.",
    sport: "course",
    target_value: 100,
    unit: "m",
    proof_hint: "Ligne de depart visible + chrono en gros plan.",
  },
  {
    title: "Pompes explosives",
    description: "50 repetitions propres, torse au sol a chaque rep.",
    sport: "pushups",
    target_value: 50,
    unit: "reps",
    proof_hint: "Repere sous la poitrine obligatoire.",
  },
  {
    title: "Tirs franc",
    description: "10 tirs consecutifs, panier visible.",
    sport: "basket",
    target_value: 10,
    unit: "tirs",
    proof_hint: "Panier et joueur visibles en continu.",
  },
  {
    title: "Nage 200m",
    description: "Distance complete sans coupure. Chrono affiche.",
    sport: "nage",
    target_value: 200,
    unit: "m",
    proof_hint: "Plan large avec ligne d'eau.",
  },
  {
    title: "Dribble slalom",
    description: "Slalom 6 plots, vitesse et controle.",
    sport: "foot",
    target_value: 6,
    unit: "plots",
    proof_hint: "Plots visibles et ordre respecte.",
  },
  {
    title: "Tractions strictes",
    description: "10 reps, menton au-dessus de la barre.",
    sport: "traction",
    target_value: 10,
    unit: "reps",
    proof_hint: "Plan de profil, bras tendus en bas.",
  },
];

async function main() {
  console.log("Seeding demo data...");

  const createdUsers = [];
  for (const [index, user] of demoUsers.entries()) {
    const email = `demo.${seedTag}.${index}@immortal-k.test`;
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: "DemoPass123!",
      email_confirm: true,
      user_metadata: { pseudo: user.pseudo },
    });
    if (error) {
      console.error("createUser error", error.message);
      continue;
    }
    createdUsers.push({
      id: data.user.id,
      email,
      pseudo: user.pseudo,
      department: user.department,
    });
  }

  if (!createdUsers.length) {
    console.error("No users created. Abort.");
    process.exit(1);
  }

  const profiles = createdUsers.map((u) => ({
    user_id: u.id,
    pseudo: u.pseudo,
    department: u.department,
    allow_mixed: true,
    allow_inter_department: true,
  }));
  await supabase.from("profiles").insert(profiles);

  await supabase
    .from("players_stats")
    .insert(createdUsers.map((u) => ({ user_id: u.id, level: 3, points: 120 })));

  await supabase
    .from("wallets")
    .insert(createdUsers.map((u) => ({ user_id: u.id, coins: 50 })));

  const challengesPayload = challengeTemplates.map((template, index) => {
    const owner = createdUsers[index % createdUsers.length];
    return {
      user_id: owner.id,
      pseudo: owner.pseudo,
      title: template.title,
      description: template.description,
      sport: template.sport,
      target_value: template.target_value,
      unit: template.unit,
      video_url: sampleVideos[index % sampleVideos.length],
      proof_hint: template.proof_hint,
      ranked: true,
      min_level: 1,
    };
  });

  const { data: challenges, error: challengesError } = await supabase
    .from("challenges")
    .insert(challengesPayload)
    .select("id,user_id");

  if (challengesError) {
    console.error("Challenges insert error", challengesError.message);
    process.exit(1);
  }

  const responses = [];
  challenges.forEach((challenge, idx) => {
    const participants = createdUsers.filter((u) => u.id !== challenge.user_id);
    const pickA = participants[idx % participants.length];
    const pickB = participants[(idx + 2) % participants.length];
    [pickA, pickB].forEach((p, i) => {
      responses.push({
        challenge_id: challenge.id,
        user_id: p.id,
        pseudo: p.pseudo,
        video_url: sampleVideos[(idx + i + 1) % sampleVideos.length],
        ai_status: "ok",
      });
    });
  });

  const { data: insertedResponses, error: respError } = await supabase
    .from("challenge_responses")
    .insert(responses)
    .select("id,user_id");

  if (respError) {
    console.error("Responses insert error", respError.message);
    process.exit(1);
  }

  const votes = [];
  insertedResponses.forEach((resp, idx) => {
    const voters = createdUsers.filter((u) => u.id !== resp.user_id);
    voters.slice(0, (idx % 3) + 1).forEach((voter) => {
      votes.push({
        response_id: resp.id,
        user_id: voter.id,
      });
    });
  });

  if (votes.length) {
    const { error: voteError } = await supabase
      .from("challenge_response_votes")
      .insert(votes);
    if (voteError) {
      console.warn("Votes insert warning", voteError.message);
    }
  }

  console.log(
    `Done. Seeded ${createdUsers.length} users, ${challenges.length} challenges, ${responses.length} responses.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
