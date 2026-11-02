# IMMORTAL — défis vidéo de pompes et de tractions

Application Expo / React Native (iOS, Android, web) avec Supabase. Deux épreuves seulement : **pompes (60 s)** et **tractions (maximum)**.

## Boucle de jeu
Inscription → choix de l'épreuve → lancer un défi (vidéo) → inviter un ami → réponse vidéo → validation humaine par un modérateur → résultat → points et classements.

## Règles garanties par le serveur (migration `supabase/migrations/20261101120000_immortal_server_authority.sql`)
- Le client n'écrit jamais ses points : ils sont dérivés des performances validées.
- Personne ne valide sa propre performance ; seuls les modérateurs décident, et chaque décision est tracée (`moderation_log`).
- Limite de 10 performances par 24 h, vidéos privées (URL signées), signalements, retrait de vidéo.
- Classements territoriaux basés sur le territoire **déclaré**, non vérifié.
- Droits Pro écrits uniquement côté serveur (`apply_entitlement_event`).
- Suppression de compte (migration `20261102140000`, Edge Function `delete-account`) : profil, performances et vidéos effacés, performances des autres intactes.
- « Encourager » (un par joueur, retirable) et commentaires de 280 caractères au plus, sur performances validées seulement (migration `20261102150000`) : limites de débit, signalement, masquage par la modération, aucun effet sur points ni classements.
- Paiement web Stripe écrit et testé en local, **non déployé, non activé** : webhook (`stripe-webhook`), `create-checkout-session`, `customer-portal`. Bouton « S'abonner » web inactif tant que `EXPO_PUBLIC_STRIPE_WEB_ENABLED` n'est pas `true` (jamais sur iOS/Android). Procédure : `docs/PRO_SETUP.md`.

## Lancer en local
```
supabase start                      # base locale (Docker)
npm install
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:<port> EXPO_PUBLIC_SUPABASE_ANON_KEY=<clé anon locale> npx expo start --web
node scripts/seed-local-demo.mjs    # admin + 8 joueurs fictifs (base locale uniquement)
node scripts/test-server-rules.mjs  # 210 vérifications des règles serveur (base locale uniquement ; vide les performances)
node scripts/test-edge-functions.mjs # Edge Functions réelles en local (voir docs/PRO_SETUP.md)
npx tsc --noEmit && npx jest
```

## État honnête
- **Fait et testé** : règles serveur (210 vérifications), fonctions Edge (47 vérifications, avec faux Stripe local), logique des écrans (jest), typage.
- **Non fait** : abonnement Pro (rien n'est achetable ; le paiement web Stripe est prêt mais non déployé ni testé en mode test Stripe), parcours complet validé sur téléphone, arènes en direct (phase ultérieure, non livrée), export d'affiche en image et QR (dépendances à ajouter + nouveau build natif).
- La migration n'est pas appliquée à la base de production ; à faire seulement après sauvegarde et accord.

Voir `docs/PRO_SETUP.md` (abonnements) et `docs/COSTS.md` (coûts).
