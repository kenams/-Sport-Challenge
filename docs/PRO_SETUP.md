# IMMORTAL Pro — mise en place des abonnements

**État : rien n'est vendable.** Le bouton « S'abonner » est désactivé tant que `EXPO_PUBLIC_IAP_ENABLED` n'est pas `true` et que le parcours n'a pas été testé de bout en bout. Les prix (4,99 €/mois, 39,99 €/an) sont des **hypothèses**.

Le Pro ne donne aucun avantage sportif : statistiques avancées, personnalisation de la carte, groupes privés. Jamais de points, de validation prioritaire ni de meilleur classement.

## Ce qui existe
- Table `entitlements` + fonction `apply_entitlement_event` (service_role uniquement, idempotente, tolère les événements en désordre).
- Edge Function `supabase/functions/revenuecat-webhook` : secret partagé `REVENUECAT_WEBHOOK_AUTH`, refuse le bac à sable en production (`REVENUECAT_ALLOW_SANDBOX=true` pour les tests). Correspondance des événements testée (`src/__tests__/revenuecat.test.ts`), à valider avec un achat de test réel.
- Stripe (web) : produit « IMMORTAL Pro » `prod_VYADBlN3XWKJ9x` créé le 01/11/2026 avec deux prix (mensuel, annuel), **sans lien de paiement**. Les identifiants de prix sont à relever dans le dashboard Stripe.

## À faire avant d'ouvrir les ventes (manquants)
1. Comptes développeur Apple et Google Play ; produits `immortal_pro_monthly` et `immortal_pro_annual` dans chaque boutique.
2. Compte RevenueCat : entitlement `pro`, clés SDK publiques iOS/Android, webhook vers `revenuecat-webhook` avec l'en-tête d'autorisation.
3. Côté app : `react-native-purchases`, `Purchases.logIn(<id utilisateur Supabase>)`, restauration des achats, nouveau build natif.
4. Web : le webhook Stripe est écrit et testé en local (voir ci-dessous) ; reste à créer le point d'accès dans le dashboard Stripe, la session de paiement (Checkout) qui pose `metadata.user_id` sur l'abonnement, et un paiement de test en mode test.
5. Déployer : `supabase functions deploy revenuecat-webhook --no-verify-jwt`, secrets via `supabase secrets set` (jamais dans le dépôt).
6. Achat de test en bac à sable, puis remboursement test, puis seulement activer `EXPO_PUBLIC_IAP_ENABLED`.
7. Mentions légales, CGV, droit de rétractation et résiliation visibles avant l'achat.

## Webhook Stripe (web) — écrit, testé en local, non déployé
- `supabase/functions/stripe-webhook/index.ts` + logique pure `supabase/functions/_shared/stripe.ts`.
- Signature `Stripe-Signature` vérifiée à la main (HMAC-SHA256 sur `t.corps_brut`, comparaison à temps constant, tolérance 5 min dans les deux sens, plusieurs secrets acceptés pendant une rotation). Corps lu en texte brut avant tout JSON.parse.
- Idempotence : l'identifiant d'événement Stripe (`evt_...`) est la clé de `payment_events` ; un doublon renvoie 200 sans effet. Un événement plus ancien que le dernier appliqué est ignoré (`stale`). Limite connue : Stripe horodate à la seconde ; deux événements de la même seconde, le second est ignoré.
- Correspondance : `customer.subscription.created/updated` (active ou trialing = Pro, `cancel_at_period_end` = résilié mais valable jusqu'à la fin, past_due/unpaid = problème de facturation, canceled/incomplete_expired/paused = gratuit), `customer.subscription.deleted`, `invoice.paid` (renouvellement, fin de période prise sur la ligne de facture), `invoice.payment_failed` (accès maintenu au plus 7 jours), `charge.refunded` (remboursement total seulement). Le joueur est identifié par `metadata.user_id` posé à la création de l'abonnement ; sinon par l'identifiant client Stripe déjà vu dans `payment_events`.
- Événements du mode test refusés en production ; `STRIPE_ALLOW_TEST_MODE=true` pour les essais.
- À vérifier avant ouverture : noms de champs de la version d'API Stripe réellement configurée (la période de l'abonnement est lue sur l'objet ou sur ses lignes), un paiement de test, un remboursement de test.
- Déploiement : `supabase functions deploy stripe-webhook --no-verify-jwt` ; `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`.
- Tests : `npx jest src/__tests__/stripeWebhook.test.ts` (signature, correspondance, doublon, désordre, horodatage), `scripts/test-server-rules.mjs` section 12 (apply_entitlement_event et verrous Pro côté base), `scripts/test-edge-functions.mjs` (fonctions réelles dans le runtime Deno).

## Honnêteté de l'écran Pro
Le bouton d'abonnement reste désactivé quelle que soit la valeur de `EXPO_PUBLIC_IAP_ENABLED` tant qu'aucun module d'achat n'est branché (`subscribeCta`). Les fonctions Pro sont verrouillées côté serveur (`is_pro`) et ne s'ouvrent que sur un événement de paiement valide.

## Suppression de compte (Apple / Google / RGPD)
- Profil > « Supprimer mon compte » : deux fenêtres (explication de ce qui part, puis saisie de SUPPRIMER).
- `supabase/functions/delete-account` : vérifie le jeton, efface les vidéos du stockage, appelle `delete_my_account_data()` (migration `20261102140000`), puis supprime le compte d'authentification. Étapes rejouables ; si l'une échoue, rien d'irréversible n'est à moitié fait.
- Conservé : performances et classements des autres joueurs (leurs réponses à un défi supprimé restent, sans le défi ; leurs réponses encore en attente sont retirées). Perdu côté adversaires : le bonus de victoire en duel contre le compte supprimé. Historique de paiement conservé mais détaché de la personne.
- Un abonnement Pro actif n'est PAS résilié automatiquement : l'écran le dit et renvoie vers la boutique.
- Déploiement : `supabase functions deploy delete-account`.

## Tester les fonctions en local (sans le CLI Supabase)
```
docker run -d --name edge-test --network supabase_network_<projet> --env-file edge.env -p 18181:9000   -v <dossier>/main:/main:ro -v <dossier>/functions:/home/deno/functions:ro   public.ecr.aws/supabase/edge-runtime:v1.77.8 start --main-service=/main --port=9000 --policy=per_worker
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... EDGE_URL=http://127.0.0.1:18181 node scripts/test-edge-functions.mjs
```
(`main/index.ts` crée un worker utilisateur par fonction ; avec un antivirus qui intercepte le TLS, l'import esm.sh échoue : empaqueter supabase-js localement.)
