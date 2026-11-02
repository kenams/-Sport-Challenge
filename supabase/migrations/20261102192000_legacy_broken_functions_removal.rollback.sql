-- Recree les fonctions et declencheurs casses d'origine depuis la sauvegarde (ils resteront casses).
do $$
declare r record;
begin
  for r in select definition from pre_immortal_backup_20261102.legacy_function_defs
           where kind='function' and name in ('arena_rounds_validate()','maybe_finalize_votes_after_vote()','finalize_challenge_votes(p_challenge_id bigint)') loop
    execute r.definition;
  end loop;
  for r in select name, definition from pre_immortal_backup_20261102.legacy_function_defs
           where kind='trigger' and name in ('arena_rounds.tr_arena_rounds_validate','challenge_response_votes.trg_finalize_votes_on_insert') loop
    execute r.definition;
  end loop;
end $$;
