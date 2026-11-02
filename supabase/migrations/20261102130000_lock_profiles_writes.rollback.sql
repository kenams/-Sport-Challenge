grant insert, update, delete on public.profiles to authenticated;
create policy "allow upsert own profile" on public.profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "allow update own profile" on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
