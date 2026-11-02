-- Les profils ne s'écrivent plus que par update_my_profile / set_card_theme / ensure_player (SECURITY DEFINER).
-- Avant : les politiques d'origine laissaient un joueur modifier directement son profil, donc contourner
-- la validation du pseudo/territoire et la porte Pro de card_theme.
drop policy if exists "allow upsert own profile" on public.profiles;
drop policy if exists "allow update own profile" on public.profiles;
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
