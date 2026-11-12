# IMMORTAL — défis vidéo de pompes et de tractions

Application Expo / React Native (iOS, Android, web) avec Supabase. Deux épreuves seulement : **pompes (60 s)** et **tractions (maximum)**.

## Boucle de jeu
Inscription → choix de l'épreuve → lancer un défi (vidéo) → inviter un ami → réponse vidéo → validation humaine par un modérateur → résultat → points et classements.

## Règles garanties par le serveur (migration `supabase/migrations/20261101120000_immortal_server_authority.sql`)
- Le client n'écrit jamais ses points : ils sont dérivés des performances validées.
- Personne ne valide sa propre performance ; seuls les modérateurs décident, et chaque décision est tracée (`moderation_log`).
- Limite de 10 performances par 24 h, vidéos privées (URL signées), signalements, retrait de vidéo.
- Classements territoriaux basés sur le territoire **déclaré**, non vérifié.
- Profil sportif privé (`player_private_profiles`, RLS propriétaire) : date de naissance, sexe, taille et poids ; l’âge est calculé à l’affichage. Galerie de neuf avatars illustrés sélectionnables ; les défis nominatifs et duels vérifient côté serveur un écart maximal de 10 niveaux.
- Droits Pro écrits uniquement côté serveur (`apply_entitlement_event`).
- Suppression de compte (migration `20261102140000`, Edge Function `delete-account`) : profil, performances et vidéos effacés, performances des autres intactes.
- « Encourager » (un par joueur, retirable) et commentaires de 280 caractères au plus, sur performances validées seulement (migration `20261102150000`) : limites de débit, signalement, masquage par la modération, aucun effet sur points ni classements.
- Paiement web Stripe **réel (live)** activé le 12/11/2026 (jusque-là le serveur était resté en mode test) : webhook live `we_1Ub3QFGSZgm5QCNLelUSt7kL`, prix live 4,99 €/mois et 39,99 €/an, case obligatoire CGV + renonciation au droit de rétractation (preuve horodatée dans les métadonnées Stripe), CGV sur `/cgv.html`. Fonctions : `stripe-webhook`, `create-checkout-session`, `customer-portal`. Les achats iOS/Android restent désactivés. Prix affichés à confirmer avant de considérer l'offre prête à vendre. Procédure : `docs/PRO_SETUP.md`.

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

## Générer l’APK Android

Le profil `preview` produit un APK installable pour les essais internes :

```sh
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Dans l’environnement EAS `preview`, configure `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Pour le live vidéo, configure aussi `LIVEKIT_URL`, `LIVEKIT_API_KEY` et `LIVEKIT_API_SECRET` comme secrets de la fonction Supabase `duel-live-token` (jamais dans l’application mobile). Le compteur mobile reste manuel et le résultat officiel passe par un modérateur.

## État honnête
- **Fait et testé** : règles serveur (210 vérifications), fonctions Edge (47 vérifications, avec faux Stripe local), logique des écrans (jest), typage.
- **À valider sur téléphone** : parcours complet sur appareil Android, permissions caméra/micro, et flux live avec deux comptes. L’arbitre automatique par caméra est disponible en bêta web ; sur Android, les répétitions sont comptées manuellement et validées par un modérateur. Le serveur LiveKit doit être configuré pour activer la vidéo en direct.
- **Paiement mobile** : les achats iOS/Android restent désactivés ; l’abonnement Pro se gère sur le web.
- Les migrations `20261102210000_immortal_private_sports_profile_level_gap.sql` et `20261102220000_immortal_avatar_library.sql` sont appliquées en production ; les champs date de naissance, sexe, taille et poids restent privés et absents des vues publiques.

Voir `docs/PRO_SETUP.md` (abonnements) et `docs/COSTS.md` (coûts).
