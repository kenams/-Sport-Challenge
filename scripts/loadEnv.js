const fs = require("fs");
const path = require("path");

function applyEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function loadEnv() {
  const root = process.cwd();
  applyEnvFile(path.join(root, ".env.local"));
  applyEnvFile(path.join(root, ".env"));

  if (!process.env.SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
  }
  if (!process.env.SUPABASE_ANON_KEY && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    process.env.SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  }
}

loadEnv();
