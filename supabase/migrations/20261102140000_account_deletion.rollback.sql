-- Annule 20261102140000_account_deletion.sql (les données déjà supprimées ne reviennent pas).
drop function if exists public.delete_my_account_data();
alter table public.attempts drop constraint if exists attempts_response_has_challenge;
alter table public.attempts add constraint attempts_response_has_challenge check (kind <> 'response' or challenge_id is not null);
-- À exécuter seulement si aucune ligne n'a moderator_id nul :
-- alter table public.moderation_log alter column moderator_id set not null;
