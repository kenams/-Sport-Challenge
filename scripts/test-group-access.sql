-- Régression RLS non destructive. À exécuter uniquement sur la base locale de démo.
-- Toutes les fixtures sont annulées à la fin (ROLLBACK).
\set ON_ERROR_STOP on
begin;
select set_config('test.lea', (select id::text from auth.users where email = 'lea@immortal-demo.test'), true);
select set_config('test.moussa', (select id::text from auth.users where email = 'moussa@immortal-demo.test'), true);
select set_config('test.sarah', (select id::text from auth.users where email = 'sarah@immortal-demo.test'), true);
do $$ begin
  if nullif(current_setting('test.lea'), '') is null or nullif(current_setting('test.moussa'), '') is null or nullif(current_setting('test.sarah'), '') is null then
    raise exception 'Comptes de demo locaux requis';
  end if;
end $$;
insert into public.groups(id,owner_id,name,invite_code) values
 ('11111111-1111-4111-8111-111111111111',current_setting('test.lea')::uuid,'TEST RLS A','qa_rls_a'),
 ('22222222-2222-4222-8222-222222222222',current_setting('test.sarah')::uuid,'TEST RLS B','qa_rls_b');
insert into public.group_members(group_id,user_id) values
 ('11111111-1111-4111-8111-111111111111',current_setting('test.lea')::uuid),
 ('11111111-1111-4111-8111-111111111111',current_setting('test.moussa')::uuid),
 ('22222222-2222-4222-8222-222222222222',current_setting('test.sarah')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.lea'),true);
do $$ begin
  if (select count(*) from public.groups where name like 'TEST RLS %') <> 1 then raise exception 'FAIL: proprietaire doit voir son groupe uniquement'; end if;
  if (select count(*) from public.group_members where group_id = '11111111-1111-4111-8111-111111111111') <> 1 then raise exception 'FAIL: seules ses propres adhesions sont visibles'; end if;
  if exists(select 1 from public.group_members where user_id <> auth.uid()) then raise exception 'FAIL: fuite adhesions autres joueurs'; end if;
  raise notice 'PASS: proprietaire, groupe prive et adhesions personnelles';
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.moussa'),true);
do $$ begin
  if (select count(*) from public.groups where id = '11111111-1111-4111-8111-111111111111') <> 1 then raise exception 'FAIL: membre doit voir le groupe rejoint'; end if;
  if exists(select 1 from public.groups where id = '22222222-2222-4222-8222-222222222222') then raise exception 'FAIL: fuite groupe et code invitation'; end if;
  raise notice 'PASS: membre voit son groupe, pas les autres';
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.sarah'),true);
do $$ begin
  if exists(select 1 from public.groups where id = '11111111-1111-4111-8111-111111111111') then raise exception 'FAIL: non membre voit le groupe prive'; end if;
  raise notice 'PASS: non membre refuse';
end $$;
reset role;
set local role anon;
do $$ begin
  if exists(select 1 from public.groups) or exists(select 1 from public.group_members) then raise exception 'FAIL: visiteur voit des donnees privees'; end if;
  raise notice 'PASS: visiteur anonyme ne voit aucun groupe ni adhesion';
end $$;
reset role;
rollback;
