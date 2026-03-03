# Supabase setup

## 1) Schema
- Execute `supabase/schema.sql` in the SQL editor of your Supabase project.

## 2) Storage
- Create a bucket `videos` (public or signed URLs).

## 3) Edge Function (Arena Live signal)
- Deploy the function in `supabase/functions/arena-signal`.
- Env vars required for the function:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

## 4) App env
- `.env.local` should contain:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_ARENA_SIGNAL_URL` (ex: `https://<project>.supabase.co/functions/v1/arena-signal`)
