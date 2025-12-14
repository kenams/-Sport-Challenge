# Roulette russe hebdomadaire

La roulette russe sélectionne automatiquement des duels obligatoires toutes les semaines. Les joueurs ciblés n'ont aucun droit de refus : s'ils n'envoient pas leur vidéo avant la deadline, une pénalité tombe immédiatement.

## Schéma Supabase

Créer la table `roulette_duels` (nom libre, mais utilisé dans le code) :

| colonne           | type        | description                                                           |
|-------------------|-------------|------------------------------------------------------------------------|
| id (PK)           | bigint      | identifiant                                                            |
| week_id           | text        | identifiant de semaine (`YYYY-MM-DD` du lundi)                         |
| player_a          | uuid        | premier joueur                                                         |
| player_b          | uuid        | deuxième joueur                                                        |
| sport             | text        | sport imposé (running, basket, …)                                      |
| status            | text        | `pending`, `challenge_created`, `completed`, `penalized`               |
| challenge_id      | bigint      | défi associé (null tant qu'il n'existe pas)                            |
| deadline          | timestamptz | date limite pour poster                                                |
| penalty_applied   | boolean     | drapeau pour ne pas rejouer la sanction                                |
| winner_id         | uuid        | optionnel si un vainqueur est déclaré                                  |
| created_at        | timestamptz | défaut `now()`                                                         |

Ajoutez une policy RLS lecture seule pour les joueurs (`or(player_a = auth.uid(), player_b = auth.uid())`) et laissez les updates réservées au service key.

## Script de tirage

`scripts/runRoulette.js` :

1. Applique d'abord les pénalités sur les duels dont la `deadline` est dépassée et toujours en `pending` / `challenge_created` (−10 fair-play, −20 points, log dans `activities`).
2. Calcule l'identifiant de semaine (lundi UTC).
3. Récupère les joueurs éligibles (`players_stats.level >= 2` et `fair_play_score >= 40`), les mélange puis les ordonne par niveau pour créer des duos équilibrés.
4. Insère chaque duo dans `roulette_duels` avec un sport imposé et une deadline à J+4.

Usage :

```bash
export SUPABASE_SERVICE_KEY=xxxxxxxx
# (optionnel) export SUPABASE_URL=https://… si vous n'utilisez pas l'URL par défaut
npm run cron:roulette
```

Planifier ce script via crontab / GitHub Actions (ex. lundi 06:00).

## Intégration app

- **HomeScreen** affiche un widget “Roulette russe” listant les duels actifs, leur sport, la deadline et l'action à entreprendre (créer un défi, ouvrir le défi existant).
- **CreateChallengeScreen** comprend les paramètres `rouletteDuelId`, `rouletteSport`, `rouletteOpponent` pour créer automatiquement un défi lié et marquer la ligne dans `roulette_duels` comme `challenge_created`.
- **Pénalités** : si rien n'est posté avant la date, le script appliquera les sanctions et changera le statut du duel en `penalized`. Les joueurs voient le statut “Pénalité appliquée” sur la Home.

## Checklist

- [ ] Le cron `npm run cron:roulette` s’exécute chaque semaine avec `SUPABASE_SERVICE_KEY`.
- [ ] La table `roulette_duels` existe avec les policies RLS adaptées.
- [ ] Les joueurs ciblés reçoivent une notification (extension possible via `coach_notifications`).
- [ ] Les récompenses/pénalités supplémentaires peuvent être branchées facilement (points bonus si `status = completed` avant la deadline).
