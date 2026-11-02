# IMMORTAL Pro — mise en place des abonnements

**État de production (2 novembre 2026)** : l'abonnement web Stripe a été activé à la demande du fondateur. Les fonctions Checkout, Portail et webhook sont déployées sur Supabase ; les secrets de production sont configurés et `WEB_BASE_URL` pointe vers l'application. Aucune transaction réelle n'a été lancée ici. Les prix affichés (4,99 €/mois, 39,99 €/an) doivent encore être confirmés dans Stripe. Les achats iOS/Android restent désactivés.

Le Pro ne donne aucun avantage sportif : statistiques avancées, personnalisation de la carte, groupes privés. Jamais de points, de validation prioritaire ni de meilleur classement.

## Ce qui existe
- Table `entitlements` + fonction `apply_entitlement_event` (service_role uniquement, idempotente, tolère les événements en désordre).
- Edge Function `supabase/functions/revenuecat-webhook` : secret partagé `REVENUECAT_WEBHOOK_AUTH`, refuse le bac à sable en production (`REVENUECAT_ALLOW_SANDBOX=true` pour les tests). Correspondance des événements testée (`src/__tests__/revenuecat.test.ts`), à valider avec un achat de test réel.
- Stripe (web) : produit « IMMORTAL Pro » `prod_VYADBlN3XWKJ9x` créé le 01/11/2026 avec deux prix (mensuel, annuel), **sans lien de paiement**. Les identifiants de prix sont à relever dans le dashboard Stripe.

## À faire avant d'ouvrir les ventes (manquants)
1. Comptes développeur Apple et Google Play ; produits `immortal_pro_monthly` et `immortal_pro_annual` dans chaque boutique.
2. Compte RevenueCat : entitlement `pro`, clés SDK publiques iOS/Android, webhook vers `revenuecat-webhook` avec l'en-tête d'autorisation.
3. Côté app : `react-native-purchases`, `Purchases.logIn(<id utilisateur Supabase>)`, restauration des achats, nouveau build natif.
4. Web : Checkout, Portail et webhook sont déployés. Avant toute vente, vérifier le premier parcours réel dans Stripe, le montant des prix et les mentions/CGV nécessaires.
5. Déployer : `supabase functions deploy revenuecat-webhook --no-verify-jwt`, secrets via `supabase secrets set` (jamais dans le dépôt).
6. Achat de test en bac à sable, puis remboursement test, puis seulement activer `EXPO_PUBLIC_IAP_ENABLED`.
7. Mentions légales, CGV, droit de rétractation et résiliation visibles avant l'achat.

## Webhook Stripe (web) — déployé en production
- `supabase/functions/stripe-webhook/index.ts` + logique pure `supabase/functions/_shared/stripe.ts`.
- Signature `Stripe-Signature` vérifiée à la main (HMAC-SHA256 sur `t.corps_brut`, comparaison à temps constant, tolérance 5 min dans les deux sens, plusieurs secrets acceptés pendant une rotation). Corps lu en texte brut avant tout JSON.parse.
- Idempotence : l'identifiant d'événement Stripe (`evt_...`) est la clé de `payment_events` ; un doublon renvoie 200 sans effet. Un événement plus ancien que le dernier appliqué est ignoré (`stale`). Limite connue : Stripe horodate à la seconde ; deux événements de la même seconde, le second est ignoré.
- Correspondance : `customer.subscription.created/updated` (active ou trialing = Pro, `cancel_at_period_end` = résilié mais valable jusqu'à la fin, past_due/unpaid = problème de facturation, canceled/incomplete_expired/paused = gratuit), `customer.subscription.deleted`, `invoice.paid` (renouvellement, fin de période prise sur la ligne de facture), `invoice.payment_failed` (accès maintenu au plus 7 jours), `charge.refunded` (remboursement total seulement). Le joueur est identifié par `metadata.user_id` posé à la création de l'abonnement ; sinon par l'identifiant client Stripe déjà vu dans `payment_events`.
- `STRIPE_ALLOW_TEST_MODE=true` est actuellement configuré en production. Il accepte aussi les webhooks Stripe de test ; repasser à `false` après la phase de validation si la production ne doit traiter que les événements live.
- À vérifier avant ouverture : noms de champs de la version d'API Stripe réellement configurée (la période de l'abonnement est lue sur l'objet ou sur ses lignes), un paiement de test, un remboursement de test.
- Déploiement : `supabase functions deploy stripe-webhook --no-verify-jwt` ; `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`.
- Tests : `npx jest src/__tests__/stripeWebhook.test.ts` (signature, correspondance, doublon, désordre, horodatage), `scripts/test-server-rules.mjs` section 12 (apply_entitlement_event et verrous Pro côté base), `scripts/test-edge-functions.mjs` (fonctions réelles dans le runtime Deno).

## Paiement web Stripe : Checkout + portail — activé en production
- `supabase/functions/create-checkout-session` : exige un joueur connecté, accepte `{plan: "monthly"|"annual"}` uniquement (liste blanche). Les `price_...` viennent des secrets `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL`, jamais du client. Refuse (409) si le joueur est déjà Pro. Crée une session `mode=subscription` avec `client_reference_id`, `metadata.user_id` et `subscription_data.metadata.user_id` = id du joueur (c'est ce que lit le webhook), réutilise le client Stripe déjà connu (`payment_events`), sinon préremplit l'e-mail. Retours : `WEB_BASE_URL` + `/Pro?checkout=success|cancel` (https obligatoire, localhost toléré ; aucune URL fournie par le client).
- `supabase/functions/customer-portal` : session du portail client (changer de carte, résilier) pour un joueur dont un client Stripe est connu ; sinon 409 `no_customer`.
- Logique pure : `supabase/functions/_shared/billing.ts` (fetch injecté ; la clé n'est ni journalisée ni renvoyée ; erreurs Stripe réduites à `stripe_error`). Tests : `npx jest src/__tests__/billing.test.ts src/__tests__/billingClient.test.ts` et `scripts/test-edge-functions.mjs` (faux Stripe HTTP local, 47 vérifications ; le runtime local doit avoir `STRIPE_API_BASE=http://host.docker.internal:18999`, une fausse `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY=price_fake_monthly`, `STRIPE_PRICE_ANNUAL=price_fake_annual`, `WEB_BASE_URL=http://localhost:8099`).
- Client : `startCheckout(plan)` / `openBillingPortal()` dans `src/services/api.ts` ; écran Pro. Bouton actif SEULEMENT sur le web et si `EXPO_PUBLIC_STRIPE_WEB_ENABLED === "true"` (défaut : désactivé, message « bientôt disponible »). Jamais sur iOS/Android (achats numériques via les boutiques). Au retour de paiement, l'écran ne se fie pas à l'URL : il interroge `is_pro` toutes les 3 s jusqu'à 90 s (« paiement en cours de confirmation » tant que le webhook n'a pas écrit le droit, « confirmé » seulement quand le serveur le dit).
- Vérifié dans le navigateur (base locale, faux Stripe) : drapeau absent = écran honnête inchangé ; drapeau actif = clic sur « S'abonner » redirige vers l'URL renvoyée par le faux Stripe ; retour `?checkout=success` sans droit = « en cours de confirmation », puis « confirmé » après écriture du droit en base ; « Gérer mon abonnement » visible pour un Pro Stripe.
- Prix affichés (4,99 €/mois, 39,99 €/an) = **hypothèses** tant que non validées. Le texte de l'écran dit « tu peux résilier depuis cet écran » : vrai seulement une fois le portail activé (étape 5 ci-dessous).
- **À confirmer avant ouverture (juridique)** : droit de rétractation de 14 jours pour un abonnement numérique (renoncement exprès à recueillir avant paiement si accès immédiat), CGV et mentions visibles avant l'achat, mode de résiliation décrit, TVA. Rien de cela n'est encore dans l'app.
- Identifiants de prix : lecture automatique du catalogue impossible (connexion MCP Stripe expirée le 02/11). À relever : https://dashboard.stripe.com/acct_1TDQW0GSZgm5QCNL/products/prod_VYADBlN3XWKJ9x (mensuel `price_...` = ________ ; annuel `price_...` = ________). En mode test, produits et prix sont distincts du mode live (étape 2).

### Actions du fondateur dans le tableau de bord Stripe (dans cet ordre ; ne jamais coller une clé dans le chat)
1. **Mode test** : basculer sur « Mode test » : https://dashboard.stripe.com/acct_1TDQW0GSZgm5QCNL/test/dashboard
2. **Produit et prix de test** : le produit du 01/11 est en mode live. Recréer « IMMORTAL Pro » à 4,99 €/mois et 39,99 €/an en mode test : https://dashboard.stripe.com/acct_1TDQW0GSZgm5QCNL/test/products. Noter les deux `price_...` de test.
3. **Clé secrète de test** : https://dashboard.stripe.com/acct_1TDQW0GSZgm5QCNL/test/apikeys. Une clé restreinte suffit (écriture « Checkout Sessions » et « Customer portal sessions »). Elle se saisit uniquement dans `supabase secrets set` (étape 7).
4. **Déployer** (terminal, projet Supabase lié) : `supabase functions deploy create-checkout-session`, `supabase functions deploy customer-portal`, `supabase functions deploy stripe-webhook --no-verify-jwt`.
5. **Portail client** : activer et enregistrer la configuration (annulation d'abonnement, moyen de paiement, factures) : https://dashboard.stripe.com/acct_1TDQW0GSZgm5QCNL/test/settings/billing/portal
6. **Webhook** (après déploiement) : https://dashboard.stripe.com/acct_1TDQW0GSZgm5QCNL/test/workbench/webhooks → point d'accès `https://<ref-projet>.supabase.co/functions/v1/stripe-webhook`, événements EXACTEMENT : `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`. Copier le secret de signature `whsec_...`.
7. **Secrets** (terminal) : `supabase secrets set STRIPE_SECRET_KEY=<clé test> STRIPE_PRICE_MONTHLY=<price test mensuel> STRIPE_PRICE_ANNUAL=<price test annuel> WEB_BASE_URL=https://<domaine web de l'app> STRIPE_WEBHOOK_SECRET=<whsec test> STRIPE_ALLOW_TEST_MODE=true`. Ne jamais définir `STRIPE_API_BASE`.
8. **Activer le bouton** sur une préversion seulement : `EXPO_PUBLIC_STRIPE_WEB_ENABLED=true` dans le build web de test (pas en production).
9. **Paiement de test** : carte `4242 4242 4242 4242` (date future, CVC et code postal quelconques). Vérifier : « en cours de confirmation » puis « Pro actif », webhook « Réussi » dans Stripe, `entitlements` = `pro/active/stripe`, « Gérer mon abonnement » ouvre le portail.
10. **Tests complémentaires** : résilier depuis le portail (« Pro actif, non renouvelé ») ; carte `4000 0000 0000 0341` (échec de paiement) ; **remboursement test** : https://dashboard.stripe.com/acct_1TDQW0GSZgm5QCNL/test/payments → le Pro est retiré.
11. **Seulement ensuite, bascule en live** : refaire 3 à 7 en mode live (clé live, `price_...` live de `prod_VYADBlN3XWKJ9x`, nouveau webhook live, nouveau `whsec_`), retirer `STRIPE_ALLOW_TEST_MODE`, valider avec un paiement réel que vous remboursez vous-même, puis activer le drapeau en production. Avant : CGV, rétractation et mentions légales en place.

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

## Branchement Stripe — état au 02/11/2026 (mode TEST, aucun paiement réel)
Fait dans le tableau de bord Stripe (compte `acct_1TDQW0GSZgm5QCNL`, mode test) :
- Produit de test « IMMORTAL Pro » `prod_VYXpdaoZjQCVtg` : mensuel 4,99 € `price_1UXQjeGSZgm5QCNLqEwEkBhP`, annuel 39,99 € `price_1UXQjeGSZgm5QCNLNwEuFmiK` (à mettre dans `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL`). Le produit live du 01/11 (`prod_VYADBlN3XWKJ9x`) reste inerte, sans lien de paiement.
- Webhook de test `immortal-pro-test` (`we_1UXQicGSZgm5QCNLlwOfgobK`), instantané, 6 événements (subscription created/updated/deleted, invoice.paid, invoice.payment_failed, charge.refunded), vers `https://sjnlilbsqecznpxbqukw.supabase.co/functions/v1/stripe-webhook`. **Cette adresse ne répond pas** tant que le projet de production est en pause et la fonction non déployée.
- Portail client de test enregistré (annulation à la fin de la période, factures, moyens de paiement).
Reste à faire : clé secrète restreinte de test et secret de signature du webhook (jamais dans le chat) → `supabase secrets set` ; restaurer le projet, déployer les 3 fonctions ; paiement de test (carte 4242 4242 4242 4242) ; remboursement test ; puis recréer les mêmes éléments en mode live.
