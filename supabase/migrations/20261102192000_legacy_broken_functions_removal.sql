-- D. Retrait des declencheurs/fonctions casses (definitions sauvegardees dans
-- pre_immortal_backup_20261102.legacy_function_defs par 20261102190000).
-- arena_rounds_validate appelle public.add_points (inexistante) ; finalize_challenge_votes utilise
-- challenge_responses.is_winner / .pseudo (colonnes absentes) ; tables sources vides, inutiles a IMMORTAL.
drop trigger if exists tr_arena_rounds_validate on public.arena_rounds;
drop trigger if exists trg_finalize_votes_on_insert on public.challenge_response_votes;
drop function if exists public.arena_rounds_validate();
drop function if exists public.maybe_finalize_votes_after_vote();
drop function if exists public.finalize_challenge_votes(bigint);
