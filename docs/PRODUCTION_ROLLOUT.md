# Passage en production — IMMORTAL (backend appliqué le 02/11/2026, voir section 0)

Projet Supabase de production : `sport-challenge-app` (ref `sjnlilbsqecznpxbqukw`, eu-west-2). **Le 02/11/2026 le projet a été restauré par le fondateur et le backend a été appliqué (section 0).** Les sections 1 à 5 restent la procédure de référence.

## 0. Exécuté le 02/11/2026 (projet `sjnlilbsqecznpxbqukw`, données d'origine conservées)
Base d'origine : 23 comptes, 3 profils, 6 players_stats, 11 wallets, 22 défis, 32 objets de stockage. **Comptes de lignes identiques avant/après (0 écart).**

**Sauvegarde** : schéma `pre_immortal_backup_20261102` dans la même base (37 tables copiées : toutes les tables `public`, `auth_users` (id, email, created_at, raw_user_meta_data), `storage_objects` (name, bucket_id, created_at) ; 251 lignes, comptes identiques). Accès retiré à `anon`/`authenticated`/`public`, RLS activée sur chaque copie. Restauration d'une table : `truncate public.<t>; insert into public.<t> select * from pre_immortal_backup_20261102.<t>;` (attention aux clés étrangères). À supprimer (`drop schema pre_immortal_backup_20261102 cascade`) une fois la production validée : il contient des e-mails.

**Migrations appliquées (ordre)** — noms Supabase : `immortal_server_authority`, `fix_group_members_recursion`, `support_event_not_participant`, `lock_profiles_writes`, `account_deletion`, `cheers_and_comments`, puis 4 correctifs propres à la production : `prod_hardening_legacy` (20261102160000), `views_invoker_and_search_path` (20261102170000), `ensure_public_users_row` (20261102180000). Le fichier du dépôt `20261101120000_immortal_server_authority.sql` a été adapté (commentaires « Adaptation prod »).

**Écarts prod / local découverts et traités**
- `add_points` n'existe pas en prod : le `revoke` direct aurait échoué (protégé par `to_regprocedure`). Note : `arena_rounds_validate` (ancien moteur) l'appelle déjà et est donc cassé depuis l'origine ; `finalize_challenge_votes` référence des colonnes absentes (`is_winner`, `pseudo`). Non touchés (tables vides ou fonctions inutilisées par IMMORTAL).
- Les politiques d'origine de la prod portent d'autres noms (« insert stats », « update stats », « insert challenges », « insert users »…) : les `drop policy` de la migration ne les atteignaient pas, donc un joueur connecté pouvait encore écrire ses points. Supprimées explicitement.
- Table `events` sans RLS en prod : RLS activée.
- Les 4 vues de points (`attempt_points`, `duel_results`, `player_points`, `player_stats_v2`) étaient lisibles par `anon` (droits Supabase par défaut) et contournaient la RLS : passées en `security_invoker`, droits `anon` retirés.
- `players_stats` et `push_tokens` référencent `public.users` ; 2 comptes anciens n'y avaient pas de ligne, ce qui faisait échouer `ensure_player` : corrigé (`ensure_public_users_row`).
- Droits d'écriture de table retirés à `anon`/`authenticated` sur les tables de points/pièces/duels/punitions/journaux ; fonctions de déclencheurs et du moteur d'origine non appelables par un joueur ; `search_path` fixé sur toutes les fonctions SECURITY DEFINER. L'Edge Function d'origine `auto-engine` (clé de service) fonctionne toujours.

**Contrôles (transactions terminées par ROLLBACK, aucune donnée de test conservée)** : anon ne peut écrire ni dans `profiles`, `attempts`, `players_stats`, `wallets` ; un joueur connecté ne peut ni `update profiles`, ni `update players_stats/wallets`, ni appeler `run_auto_engine`/`increment_points`/`apply_entitlement_event` ; `anon` n'exécute que `leaderboard`, `get_public_event`, `current_weekly_challenge` ; aucune table sans RLS ; toutes les fonctions SECURITY DEFINER ont un `search_path` ; bucket `attempt-videos` privé (50 Mo, mp4/quicktime/webm) avec ses 3 politiques. Parcours complet testé puis annulé : profil, soumission, refus score invalide, refus `card_theme` non Pro, refus validation non modérateur, validation par modérateur, points (60 = 10+5+25+20 duel), classement, encourager, commenter, suppression de compte.

**Edge Functions déployées** (v1) : `delete-account`, `create-checkout-session`, `customer-portal` (JWT requis) ; `stripe-webhook`, `revenuecat-webhook` (sans JWT). Test sans jeton : 401 / 503 « non configuré » / 405 (jamais 500). Anciennes fonctions (`arena-signal`, `send-push`, `auto-engine`) inchangées.

**Reste à faire (manuel)**
- Secrets à poser dans le tableau de bord (l'outil MCP ne transmet pas de valeur) : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_ALLOW_TEST_MODE=true` (mode test uniquement), `WEB_BASE_URL` (inconnu), `REVENUECAT_WEBHOOK_AUTH`.
- Aucun modérateur : `admin_users` est vide. `insert into public.admin_users (user_id) values ('<uuid du fondateur>');` avant d'ouvrir l'app.
- Aucune semaine dans `weekly_challenges` (le défi de la semaine est vide).
- Protection contre les mots de passe compromis (Auth) désactivée : à activer dans le tableau de bord.
- Hérité, non modifié : `live_events` modifiable par tout joueur connecté, `leaderboard_view` (SECURITY DEFINER) lisible par `anon`, buckets publics `videos` et `challenge-videos`, `auto-engine` avec secret par défaut codé en dur si `ENGINE_SECRET` n'est pas défini, `arena_rounds.winner_id` et `punishment_logs.user_id` sans suppression en cascade (bloqueraient la suppression d'un compte concerné ; tables vides au 02/11).

**Annulation** : appliquer les `.rollback.sql` dans l'ordre inverse (`views_invoker_and_search_path`, `prod_hardening_legacy`, `cheers_and_comments`, `account_deletion`, `lock_profiles_writes`, `support_event_not_participant` (rétablir l'ancienne définition), `fix_group_members_recursion`, `immortal_server_authority`). Le rollback de la première ne recrée pas les politiques d'origine propres à la prod ; pour les retrouver, se référer à l'état du 02/11 (liste dans l'historique de ce document) ou à la sauvegarde. Les données d'origine n'ont jamais été modifiées : la restauration depuis `pre_immortal_backup_20261102` ne sert que si une table est altérée.

## Avertissements
- Ces migrations **resserrent** les règles de l'ancienne app (points, portefeuilles, profils, duels, etc.). Toute ancienne version de l'app cliente cessera de fonctionner : c'est voulu, mais à ne faire qu'avec la nouvelle version prête.
- L'offre gratuite se met en pause après 7 jours d'inactivité et plafonne la base (~500 Mo selon la grille connue) et le stockage ; pour un lancement réel, prévoir l'offre Pro Supabase (voir `docs/COSTS.md`, tarifs à revérifier).
- Ne jamais coller de clés dans le dépôt ni dans le chat : `supabase secrets set` et variables EAS/Vercel.

## 1. Avant tout
1. Décision du fondateur : restaurer le projet de production (action sur le tableau de bord ou `restore_project`).
2. **Sauvegarde complète** : `supabase db dump --linked -f backup-avant-immortal-AAAAMMJJ.sql` (+ export des tables dans un dossier hors dépôt). Vérifier que le fichier se relit.
3. Compter les données existantes (`profiles`, `challenges`, `players_stats`, `wallets`, vidéos du bucket). S'il y a de vrais utilisateurs, les prévenir et décider de la migration de leurs points (non couverte : l'ancien système de points est remplacé par des points dérivés des performances validées).
4. Tester d'abord sur une **branche Supabase** (ou un projet jetable) créée depuis la production, jamais directement en prod.

## 2. Appliquer les migrations (ordre strict, un fichier à la fois)
Appliquer dans l'ordre de leurs noms tous les fichiers de `supabase/migrations/` postérieurs à `20261101120000` (inclus), sans les `.rollback.sql` :
`20261101120000_immortal_server_authority` → `20261101193245_fix_group_members_recursion` → `20261102120000_support_event_not_participant` → `20261102130000_lock_profiles_writes` → `20261102140000_account_deletion` → `20261102150000_cheers_and_comments`.
Après chaque fichier : `select * from supabase_migrations.schema_migrations order by version desc limit 3;` et un test rapide. En cas de problème : le `.rollback.sql` du fichier concerné, ou restauration de la sauvegarde.

## 3. Contrôles après migration (script prêt)
`SUPABASE_URL=<url prod> ... node scripts/test-server-rules.mjs` **ne doit jamais être lancé en production** (il supprime des données). Utiliser à la place :
- les conseillers de sécurité Supabase (`get_advisors` : RLS manquante) ;
- un compte test créé exprès, sur lequel on vérifie : inscription, profil, performance, refus d'auto-validation, refus d'écriture directe dans `profiles`/`players_stats`, suppression du compte test.
- `select count(*) from pg_policies where tablename in ('profiles','attempts','players_stats');` cohérent avec le local.

## 4. Fonctions Edge et secrets
```
supabase functions deploy delete-account   # (JWT requis)
supabase functions deploy revenuecat-webhook --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy create-checkout-session   # (JWT requis) paiement web Stripe
supabase functions deploy customer-portal           # (JWT requis) portail client Stripe
supabase secrets set REVENUECAT_WEBHOOK_AUTH=<secret> STRIPE_WEBHOOK_SECRET=<whsec_...>
```
Secrets de facturation web (mode TEST d'abord, jamais dans le chat ni le dépôt) : `supabase secrets set STRIPE_SECRET_KEY=... STRIPE_PRICE_MONTHLY=price_... STRIPE_PRICE_ANNUAL=price_... WEB_BASE_URL=https://<domaine de l'app>` (liste complète et ordre dans `docs/PRO_SETUP.md`). Ne jamais définir `STRIPE_API_BASE` en production (réservé au faux Stripe local).

Ne déployer revenuecat/stripe/create-checkout-session/customer-portal que lorsque les ventes sont préparées (voir `docs/PRO_SETUP.md`).

## 5. Application
- Variables : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_WEB_BASE_URL` (liens publics de duel). Pas de `EXPO_PUBLIC_IAP_ENABLED` tant que le paiement n'est pas testé.
- Web : export Expo (`npx expo export -p web`) puis déploiement (Vercel) ; domaine à choisir.
- Mobile : `eas build` iOS/Android, comptes développeur Apple/Google à créer, politique de confidentialité et suppression de compte déclarées dans les fiches des boutiques.
- Définir le premier modérateur : insertion manuelle dans `admin_users` par le fondateur (SQL éditeur), jamais depuis l'app.

## 6. Lancement
Procédure du premier duel : créer 2 comptes réels (le fondateur et un ami), un défi avec vidéo réelle, réponse, validation par le modérateur, vérification du classement, puis seulement ouvrir au public. **Pas de faux joueurs en production** : les agents de simulation (`scripts/sim-agents.mjs`) refusent d'ailleurs toute base non locale.

## 7. Retour arrière
Sauvegarde du §1 + `.rollback.sql` en ordre inverse. Mettre l'app en maintenance avant.
