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
4. Web : fonction serveur de webhook Stripe avec vérification de signature qui appelle `apply_entitlement_event`, puis tests avec événements signés simulés (achat, renouvellement, expiration, remboursement, doublon, ordre inversé).
5. Déployer : `supabase functions deploy revenuecat-webhook --no-verify-jwt`, secrets via `supabase secrets set` (jamais dans le dépôt).
6. Achat de test en bac à sable, puis remboursement test, puis seulement activer `EXPO_PUBLIC_IAP_ENABLED`.
7. Mentions légales, CGV, droit de rétractation et résiliation visibles avant l'achat.
