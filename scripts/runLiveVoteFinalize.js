require("./loadEnv");
const { createClient } = require("@supabase/supabase-js");

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[cron:live-votes] SUPABASE_URL ou clé service manquante");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);
  const { data, error } = await supabase.rpc("finalize_live_votes_batch");
  if (error) {
    console.error("[cron:live-votes] error", error.message || error);
    process.exit(1);
  }
  console.log(`[cron:live-votes] finalize count: ${data ?? 0}`);
}

main().catch((err) => {
  console.error("[cron:live-votes]", err.message || err);
  process.exit(1);
});

