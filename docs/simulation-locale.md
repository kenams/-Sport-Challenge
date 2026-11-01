# Arène vivante — simulation locale

La simulation s'ouvre par défaut dans l'onglet Défis en développement (__DEV__). Le bouton « Vrais parcours » / « Retour à l’application » affiche les vrais parcours. Le bouton « Ouvrir la simulation vivante » permet de revenir. En production, le parcours réel reste le défaut et la simulation n'est pas proposée.

## Scénario
- Huit personnages fictifs, portraits dessinés localement, couleurs individuelles.
- Duels de pompes avec scores unitaires, changements de tête et nouvelles manches.
- Records fictifs en pompes et tractions, classement monde / France et variations de places.
- Fil borné à 40 événements, 12 visibles ; commentaires utilisateur, réactions et encouragements automatiques.
- Pause, vitesse normale / x3, remise à zéro. La simulation s'arrête hors écran / application inactive.

## Chrono et énergie
- Chrono aux centièmes rafraîchi par requestAnimationFrame, basé sur performance.now ; les retards de rendu sont rattrapés sans compter des intervalles approximatifs.
- Le moteur consomme les secondes écoulées et ajoute au maximum une répétition par seconde et par joueur. Ce sont des répétitions simulées, pas une analyse caméra.
- Jauges verticales à côté des avatars, pleines à 30 répétitions dans ce scénario visuel. La jauge ne définit ni le score ni une mesure physiologique.
- Un halo bref par passage à jauge pleine, sans stroboscope. Réduction des animations respectée ; texte permanent « PLEIN ÉLAN » en alternative.

## Pression et présence
- Scénario « Simuler un retard » : 20 secondes de délai de démonstration.
- Le joueur peut revenir avant zéro. À expiration : forfait, -10 de fiabilité, 60 secondes de suspension simulée ; pénalité appliquée une seule fois.
- Les records historiques restent intacts. Le prochain duel évite le joueur suspendu.
- Aucun compte réel sanctionné. Les règles de présence en production restent à implémenter côté serveur avec gestion des déconnexions.

## Taps et sons
- Taper l'avatar ou le bouton d'encouragement ajoute un tap au joueur choisi. Les supporters distincts et les taps restent des notions séparées.
- Cœurs flottants, combo de taps rapprochés ; maximum 12 particules simultanées. Aucun gain de répétition ou de classement sportif.
- Sons originaux synthétisés dans le navigateur, muets par défaut et activés uniquement par un clic volontaire.
- Clic discret de répétition, signal de jauge pleine, percussion grave à chaque seconde de 10 à 1, impact final. Les signaux de jauge ne masquent pas les dernières secondes.
- Audio web testé ; audio natif non implémenté dans cette session.

## Vérifications
- 115 tests Jest, 9 suites ; TypeScript sans émission.
- Test de 1 200 étapes, mémoire bornée, scores bornés, identifiants uniques.
- Scénarios présence / retour / forfait unique ; aucune baisse de record lors d'un dépassement au plafond.
- Navigateur : commentaires, soutien, changement de champion, filtres, pause, vitesse, remise à zéro et retour aux vrais parcours.
- 20 clics rapides : 20 taps, combo x20 et 12 cœurs maximum. Les tests confirment que les taps ne modifient pas les scores sportifs.
- Jauges, halo, compte à rebours, activation et coupure audio contrôlés. Aucun contexte audio avant activation ; contexte actif après clic puis suspendu à la coupure.
- Vérification visuelle à 360/390 px et 1440 px. Aucun envoi de données vers les tables réelles lors des interactions de simulation.

## Limites
Tout reste en mémoire et disparaît au rechargement. Pas de faux comptes, vidéos, transactions, validations officielles ni pénalités dans la base.
Les défis réels non validés restent en attente et hors records. Relances de modération à construire.
Catégories et règles de parité discutées (féminin / open, niveaux et duels mixtes volontaires), mais pas ajoutées aux comptes ni aux classements réels pendant cette session.
