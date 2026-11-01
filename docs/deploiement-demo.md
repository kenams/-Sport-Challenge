# Démo web publiée

URL : https://immortal-kah-demo.vercel.app
Caméra : https://immortal-kah-demo.vercel.app/camera

Projet Vercel distinct : immortal-kah-demo
Project ID : prj_7vmkHZGkEcpvXfDRykpqIp5mzyUg
Équipe : kenams-projects-22656390 (Hobby vérifié lors du déploiement)

## Périmètre
Démo publique, sans compte ni base de données. Simulation locale au navigateur, commentaires fictifs, taps, sons optionnels, revanche/repos et capture guidée web. Aucun record officiel, compte de test ou stockage de vidéo serveur. Les vidéos restent dans le navigateur.

L'application normale reste l'entrée par défaut. L'export de démonstration active EXPO_PUBLIC_PREVIEW=true et ne charge pas .env.local. Les fonctions de contrôle vidéo utilisées par la démo sont isolées des services authentifiés.

## Reconstruction
Exécuter depuis le dépôt :

    node scripts/export-web-demo.mjs <dossier de sortie absolu>

La préparation corrige les chemins des assets Expo que Vercel ignorerait sinon sous assets/node_modules, et ajoute le fallback des routes et les permissions caméra/microphone pour la même origine. Publier uniquement le dossier statique produit, jamais le dépôt ou ses fichiers .env.

Le dossier actuellement lié est :
C:/Users/kenam/Documents/Codex/2026-11-01/tu-x20/work/immortal-web

Depuis ce dossier, vérifier le projet avant publication :

    vercel project inspect immortal-kah-demo --scope kenams-projects-22656390
    vercel deploy --prod --yes --scope kenams-projects-22656390

Le --prod concerne uniquement ce projet autonome de démo. Les sites existants KAH et les bases de production ne sont pas modifiés.

## Vérifications
- Build statique de production testé sans authentification.
- URL publique et route /camera accessibles sans compte Vercel.
- HTTPS et API caméra disponibles.
- Flux synthétique enregistré sur le site déployé, aperçu lisible, pistes fermées.
- Aucun appel à la base locale ou à Supabase pendant les parcours de démo.
- 116 tests Jest et compilation TypeScript réussis avant publication.
- Aucune option payante activée ; hébergement statique dans les quotas Hobby. Pas de garantie de disponibilité illimitée en cas de dépassement des quotas.
- Téléphone physique et microphone physique à vérifier par le fondateur sur Safari/Chrome.
