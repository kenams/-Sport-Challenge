# Adresse de production IMMORTAL

Adresse à utiliser : https://immortal-arena.vercel.app

L'ancienne démo séparée a été suspendue. Le bouton qui y conduisait a été retiré de l'onboarding. Les tests d'authentification, de duel et de vidéo doivent se faire sur cette adresse avec des comptes de test dédiés.

Pour générer un build web local sans secrets :

    EXPO_NO_DOTENV=1 npx expo export --platform web --output-dir /tmp/immortal-arena-build

Ne jamais ajouter de clé Supabase serveur ou LiveKit dans le bundle client.
