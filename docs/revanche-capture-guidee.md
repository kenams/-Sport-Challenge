# Revanche et capture guidée — 1 novembre 2026

## Revanche dans la simulation
Même adversaire et même format, demande possible pendant la manche. À la fin, 30 secondes de repos de démonstration, puis bouton de reprise volontaire. Le repos peut être prolongé en attendant. La demande pendant la manche ne remet pas le chrono à zéro. Les résultats restent visibles quelques secondes avant un nouveau duel automatique.

## Formulaires réels sur le web
Le bouton « Filmer avec les repères » ouvre une capture caméra/microphone dans l'application. Choisir le format avant capture.
- Tractions : repère rouge manuel aligné sur la barre et indication verte au-dessus. Les lignes ne suivent pas le corps. Barre, mains, menton et pieds doivent rester visibles ; la position basse bras tendus reste à vérifier.
- Pompes : vue de profil et consignes d'amplitude et d'alignement.
- Code local aléatoire à annoncer à voix haute. Il n'est pas émis ni attesté par le serveur et ne constitue pas une preuve anti-rejeu.
- Enregistrement continu sans pause, limite de taille, durée mesurée sur le fichier, fermeture des pistes au terme de la capture ou à l'annulation.
- Capture interrompue lors de la sortie de l'onglet rejetée. Aucun fichier envoyé avant la soumission du formulaire.
- L'import existant reste possible et reste soumis à la modération humaine.

## Vérifications
- 116 tests Jest, 9 suites ; TypeScript sans émission.
- Navigateur : demande de revanche, repos terminé, absence de démarrage forcé, mêmes adversaires au redémarrage.
- Capture d'un flux caméra synthétique : fichier créé et aperçu lisible ; pistes arrêtées après capture.
- Refus de permission : message explicite et possibilité de réessayer ou importer.
- Sortie d'onglet simulée : capture rejetée et pistes arrêtées.

## Limites importantes
La caméra physique et le microphone physique n'ont pas été vérifiés. La capture guidée est web ; le parcours natif conserve son enregistreur existant. Aucun comptage de pose, examen automatique de l'amplitude, empreinte anti-doublon serveur, code de séance serveur ou authentification de la personne n'est implémenté ici. Ce travail améliore le cadrage et le parcours de capture ; il ne certifie pas l'absence de triche. La validation humaine reste obligatoire.

## Mise en ligne
La base de test utilise localhost : elle n'est pas joignable depuis une préversion Vercel. Une préversion complète nécessite une base de préproduction distincte et les variables client adaptées. La simulation est actuellement limitée au développement ; une démo autonome de préversion doit être explicitement prévue avant l'export de production. Aucun déploiement ni changement de production effectué.
