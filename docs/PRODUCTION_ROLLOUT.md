# Passage en production — IMMORTAL (procédure préparée, rien d'exécuté)

Projet Supabase de production : `sport-challenge-app` (ref `sjnlilbsqecznpxbqukw`, eu-west-2). **État relevé le 02/11/2026 : INACTIF (en pause depuis l'offre gratuite).** Rien n'a été restauré, modifié ni déployé.

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
supabase secrets set REVENUECAT_WEBHOOK_AUTH=<secret> STRIPE_WEBHOOK_SECRET=<whsec_...>
```
Ne déployer revenuecat/stripe que lorsque les ventes sont préparées (voir `docs/PRO_SETUP.md`).

## 5. Application
- Variables : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_WEB_BASE_URL` (liens publics de duel). Pas de `EXPO_PUBLIC_IAP_ENABLED` tant que le paiement n'est pas testé.
- Web : export Expo (`npx expo export -p web`) puis déploiement (Vercel) ; domaine à choisir.
- Mobile : `eas build` iOS/Android, comptes développeur Apple/Google à créer, politique de confidentialité et suppression de compte déclarées dans les fiches des boutiques.
- Définir le premier modérateur : insertion manuelle dans `admin_users` par le fondateur (SQL éditeur), jamais depuis l'app.

## 6. Lancement
Procédure du premier duel : créer 2 comptes réels (le fondateur et un ami), un défi avec vidéo réelle, réponse, validation par le modérateur, vérification du classement, puis seulement ouvrir au public. **Pas de faux joueurs en production** : les agents de simulation (`scripts/sim-agents.mjs`) refusent d'ailleurs toute base non locale.

## 7. Retour arrière
Sauvegarde du §1 + `.rollback.sql` en ordre inverse. Mettre l'app en maintenance avant.
