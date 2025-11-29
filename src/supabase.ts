// src/supabase.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://sjnlilbsqecznpxbqukw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqbmxpbGJzcWVjem5weGJxdWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0ODg2MDksImV4cCI6MjA3OTA2NDYwOX0.q2-e3zRiXWDHVdj8mQoH036D7qgCgG6PuiV0hrvfIKU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
