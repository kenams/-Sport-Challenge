# Vérification locale — 1 novembre 2026

## Changements
- Contrôles natifs du lecteur accessibles sans surcouche interceptant les clics.
- Aperçu lisible sans lecture automatique.
- Lecture de la durée réelle sur le web, y compris WebM sans durée initiale.
- Contrôles de taille et durée invalides, vérification à nouveau avant transfert.
- Message et bouton de nouvelle tentative pour les vidéos indisponibles.

## Vérifications effectuées
- TypeScript : compilation sans émission réussie.
- Tests Jest : 74 tests, 6 suites.
- Navigateur : connexion Léa, création avec un vrai fichier WebM synthétique marqué TEST TECHNIQUE.
- Second contexte isolé au format 390 × 844 : connexion Moussa, réponse vidéo au défi.
- Compte admin : lecture du fichier envoyé, rejet des deux tentatives avec motif explicite.
- Retour côté joueur : décisions et motifs affichés, duel sans résultat sportif.
- Classement mondial inspecté : Tom reste premier aux pompes à 62 répétitions.
- Lecture testée par les contrôles clavier du navigateur, progression temporelle constatée.
- Fichier MP4 factice : refus avec un message de média illisible.
- Captures inspectées à 390 × 844 et 1440 × 950 ; pas de débordement horizontal sur les parcours examinés.

## Limites
- Aucun mouvement sportif réellement évalué : le clip synthétique ne teste que le transport et la lecture.
- Aucune nouvelle validation sportive ajoutée ; les tentatives techniques ont été rejetées.
- Vidéos de démo préexistantes toujours absentes ; message d’indisponibilité prévu.
- Téléphone natif, caméra physique, abonnement réel et streaming live non vérifiés pendant cette session.
- Aucune migration, publication distante ou modification de production.
- Ne pas relancer test-server-rules.mjs sans précaution : il nettoie les données locales existantes.
