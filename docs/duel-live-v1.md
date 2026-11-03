# Duel vidéo IMMORTAL — V1

Le parcours du duel reste unique : depuis un duel accepté et programmé, un joueur ouvre le live ; le second rejoint, puis les spectateurs connectés voient les deux flux, la progression provisoire et les réactions.

## Arbitre caméra bêta

- L'arbitrage caméra est proposé aux participants, avec un choix explicite entre analyse et comptage manuel.
- MediaPipe Pose Landmarker traite les images dans le navigateur, sur l'appareil du joueur. Le flux vidéo continue d'être transmis aux participants du live via LiveKit. MediaPipe peut envoyer des statistiques d'utilisation ; les images analysées ne sont pas envoyées à ce service.
- Les pompes sont comptées après un cycle complet : haut des bras tendus, descente approximativement jusqu'à 105° au coude, retour bras tendus, avec une tolérance d'alignement épaules-hanches-chevilles.
- Les tractions nécessitent un départ bras tendus et le passage d'un repère de barre placé par le participant. Le modèle n'ayant pas de point de menton, le passage est estimé depuis la bouche ; cette approximation peut se tromper.
- Si les articulations sont masquées ou insuffisamment visibles, l'application demande de replacer la caméra et ne compte pas. Les consignes restent courtes : aligner le corps, descendre davantage, tendre les bras, ou dépasser le repère.
- L'analyse tourne à fréquence réduite pour préserver le navigateur. C'est un outil bêta d'assistance, pas une preuve anti-triche : les erreurs de forme et l'élan restent à vérifier par le modérateur.

## Règle du score

- Le compteur provisoire est incrémenté par l'analyse caméra ou manuellement si le joueur choisit ce mode. Le compteur est visible par tous et n'attribue jamais une victoire à lui seul.
- Un modérateur connecté peut observer les deux flux puis saisir les répétitions complètes retenues. Cette validation clôt le live et fixe le score officiel.
- Si aucun modérateur n'est là, le score reste provisoire. Aucun résultat officiel n'est créé automatiquement et le vote/réaction du public ne décide pas du vainqueur.
- Le marqueur de 60 pompes ou 10 tractions sert seulement de repère visuel pour cette V1. Il n'arrête pas le compteur.

## Dépendances de déploiement

1. Créer un projet LiveKit Cloud et récupérer son URL, sa clé API et son secret API.
2. Dans **Supabase > Edge Functions > Secrets**, définir `LIVEKIT_URL`, `LIVEKIT_API_KEY` et `LIVEKIT_API_SECRET`. Garder le secret hors de Vercel et du code client.
3. Appliquer `supabase/migrations/20261103104452_duel_live_room_and_provisional_scores.sql` au projet IMMORTAL, puis déployer `duel-live-token`.
4. Déployer la branche web sur Vercel. L'accès caméra nécessite HTTPS et l'autorisation caméra/micro du navigateur.

L'écran vidéo V1 est ciblé sur la version web. Le fallback natif renvoie vers Chrome ou Safari ; une build mobile avec le SDK WebRTC natif LiveKit sera une étape séparée.
