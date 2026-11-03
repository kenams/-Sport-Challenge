# Duel vidéo IMMORTAL — V1

Le parcours du duel reste unique : depuis un duel accepté et programmé, un joueur ouvre le live ; le second rejoint, puis les spectateurs connectés voient les deux flux, la progression provisoire et les réactions.

## Règle du score

- Les joueurs incrémentent leur compteur pendant le direct. Le compteur est visible par tous et n'attribue jamais une victoire à lui seul.
- Un modérateur connecté peut observer les deux flux puis saisir les répétitions complètes retenues. Cette validation clôt le live et fixe le score officiel.
- Si aucun modérateur n'est là, le score reste provisoire. Aucun résultat officiel n'est créé automatiquement et le vote/réaction du public ne décide pas du vainqueur.
- Le marqueur de 60 pompes ou 10 tractions sert seulement de repère visuel pour cette V1. Il n'arrête pas le compteur.

## Dépendances de déploiement

1. Créer un projet LiveKit Cloud et récupérer son URL, sa clé API et son secret API.
2. Dans **Supabase > Edge Functions > Secrets**, définir `LIVEKIT_URL`, `LIVEKIT_API_KEY` et `LIVEKIT_API_SECRET`. Garder le secret hors de Vercel et du code client.
3. Appliquer `supabase/migrations/20261103104452_duel_live_room_and_provisional_scores.sql` au projet IMMORTAL, puis déployer `duel-live-token`.
4. Déployer la branche web sur Vercel. L'accès caméra nécessite HTTPS et l'autorisation caméra/micro du navigateur.

L'écran vidéo V1 est ciblé sur la version web. Le fallback natif renvoie vers Chrome ou Safari ; une build mobile avec le SDK WebRTC natif LiveKit sera une étape séparée.
