# Vérification duels et Pro — 1 novembre 2026

## Corrections
- Toutes les routes actives produisent des URL reconnues au rechargement, notamment les duels et les onglets.
- Dates inexistantes ou ambiguës au changement d'heure refusées avec une explication.
- L'affichage Pro suit le droit effectif côté serveur ; les erreurs de lecture ne sont plus présentées comme un abonnement gratuit.
- Aucun bouton d'achat actif sans module de paiement réellement intégré.
- Règle récursive group_members remplacée par la lecture de ses propres adhésions. Les groupes restent limités aux propriétaires et membres.
- États de groupe vide et d'erreur améliorés ; bouton Réessayer accessible.
- Invitation à se connecter masquée après authentification d'un supporter.
- Texte de partage sans détails de configuration ; rappel enregistré distingué d'une notification effectivement envoyée.

## Vérifications
- 93 tests Jest / 7 suites ; TypeScript sans émission.
- Proposition Admin → Moussa, acceptation par Moussa depuis un contexte séparé, confirmation côté serveur.
- Soutien et rappel enregistrés, puis retrouvés après rechargement.
- Page publique /e/265bde37f7 consultée dans un troisième contexte sans compte.
- Connexion Léa depuis la page publique : retour sur le duel conservé, soutien enregistré.
- Annulation du duel de test par Admin afin de ne pas conserver de faux événement confirmé.
- Panne 503 simulée sur la lecture d'abonnement : erreur visible puis récupération via le bouton Réessayer.
- Heure inexistante affichée avec message explicite dans le vrai formulaire.
- Captures Pro mobile 390 × 844 et ordinateur 1440 × 950 inspectées, pas de débordement horizontal sur les écrans examinés.
- SQL scripts/test-group-access.sql : propriétaire et membre autorisés ; non-membre et visiteur privés d'accès ; seuls ses propres enregistrements d'adhésion sont visibles. Fixtures annulées par ROLLBACK.

## Base locale
La migration 20261101193245_fix_group_members_recursion.sql a été appliquée par psql uniquement dans supabase_db_sport-challenge-testenv. Elle est idempotente. Aucun historique de migration distant ni aucune base de production n'a été modifié.

## Restant
- Paiement réel, restauration des achats et tests stores : intégration manquante.
- Les rappels sont stockés mais l'envoi des notifications de duel n'est pas relié ; l'ancien ordonnanceur traite lives_schedule, pas duel_events.
- Pas de diffusion vidéo live implémentée ou testée ici.
- Aucun déploiement ni push distant.
