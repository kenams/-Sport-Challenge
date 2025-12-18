# IMMORTAL-K (Arena Rivalité)

Application React Native / Expo permettant de lancer des défis sportifs en vidéo, suivre des rivalités entre territoires (Île‑de‑France vs Tarn‑et‑Garonne), organiser des sessions Arena Live et piloter sa progression via un coach intégré.

## Features principales

- **Défis vidéo** : création de défis avec preuve vidéo et mise éventuelle en coins.
- **Rivalité territoriale** : chaque utilisateur choisit son camp (IDF ou Tarn) et peut filtrer les défis par territoire.
- **Arena Live Hub** :
  - Annoncer un live ou rejoindre ceux en cours.
  - Programmer un live (script cron `npm run cron:reminders` envoie un rappel 15 min avant via `coach_notifications`).
  - Section “Lives programmés” et mode démo.
  - Partage enrichi (mention du territoire + lien).
- **Coach de rue** :
  - Dashboard “Coach” avec objectifs quotidiens et rappel du cash/punitions.
  - Tips d’onboarding (Rivalité / Live / Boutique) présentés une fois.
- **Moderation / sanctions** :
  - Écran “Arena Reports” affichant les signalements avec actions rapidess (Valider = sanction 3 pubs, Rejeter).
  - Quota anti-spam : max 5 défis publiés par utilisateur sur 24h (vérifié dans `CreateChallengeScreen`).
- **Télémétrie** :
  - `src/services/telemetry.ts` logge des événements (live_programmé, live_share, rivalité_perdue) dans la table `events`.

## Prérequis

- Node.js 18+
- npm ou yarn
- Compte Supabase (variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` pour certains scripts)

## Installation

```sh
npm install
```

Crée un fichier `.env.local` (ou configure la plateforme) avec :

```sh
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=... # requis pour les scripts admin
```

## Développement

```sh
npm run start         # Expo
npm run android       # Expo Go / device
npm run ios           # Expo Go / iOS
npm run web           # Expo web
```

### Scripts utilitaires

- `npm run check:flows` : test end-to-end des flows critiques (création user -> défi -> live_programmé). Nécessite `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`.
- `npm run cron:reminders` : script à lancer via un cron (ou service planifié) pour envoyer les notifications `live_reminder` 15 minutes avant une session programmée.
- `npm run lint` / `npm run test` (si configuré plus tard).

## Utilisation (rapide)

- Démarrer l'application en mode développement :

```bash
npm install
npm run start
```

- Tester sur un appareil Android connecté :

```bash
npm run android
```

- Variables d'environnement essentielles :

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # nécessaire pour scripts admin
```

- Commandes utiles :
  - `npm run start` : lance Metro / Expo
  - `npm run android` / `npm run ios` : lance l'app sur un device via Expo
  - `node scripts/checkFlows.js` : vérifie les flows critiques (requiert service role key)

Conserver `schema_source.sql` et dumps de données dans un bucket sécurisé si vous effectuez des migrations.

## Structure

- `src/screens` : écrans principaux (Home, Coach, LiveHub, etc.)
- `src/services/telemetry.ts` : logging d’événements.
- `scripts/` :
  - `checkFlows.js` : QA flows critiques Supabase.
  - `runLiveReminders.js` : scheduler de notifications Arena Live.

## Workflows importants

1. **Programmation Live** :
   - Dans le Hub, un utilisateur choisit un défi, clique sur “Programmer”.
   - `lives_schedule` reçoit `reminder_sent:false`.
   - Le cron `runLiveReminders` (exécuté toutes les minutes) envoie une `coach_notification` 15 min avant le créneau.

2. **Déclaration gagnant** :
   - `ChallengeDetailScreen` logge un événement `rivalité_perdue` lorsqu’un challenger d’un autre territoire prend l’avantage, et génère une notification “dept_rivalry”.

3. **Modération** :
   - `ArenaReportsScreen` liste les signalements. L’admin peut valider/annuler.
   - Validation = `punishments` (3 pubs) + statut mis à jour.

## TODO / pistes restantes

- Filtre plus riche et pagination côté Hub Live.
- Rappels push natifs (expo-notifications) en complément des notifications coach.
- Génération d’un visuel de partage (story format).
- Tests automatiques supplémentaires (unitaires/e2e).

## License

Projet interne (copyright propriétaire).

