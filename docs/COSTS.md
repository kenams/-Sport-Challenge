# Coûts — IMMORTAL

Les chiffres ci-dessous ne sont pas garantis : les tarifs des fournisseurs changent, **à vérifier sur leurs pages officielles avant de décider**.

## Postes de coût
| Poste | Remarque |
|---|---|
| Supabase | Offre gratuite : base limitée (≈50 Mo selon la grille connue le 01/11/2026), stockage ≈1 Go, **pause automatique après 7 jours d'inactivité**. Les vidéos font vite exploser le stockage : l'offre Pro Supabase est à prévoir dès les vrais utilisateurs. |
| Stockage vidéo | Principal coût variable. Limiter durée et taille (déjà contrôlé côté client), purger les vidéos rejetées/retirées, politique de conservation à fixer (ex. 90 jours après validation, hypothèse). |
| Diffusion vidéo | Sortie de données facturée au-delà du quota ; un CDN ou un hébergeur vidéo (Cloudflare Stream, Mux) devient pertinent si le volume monte. |
| Boutiques | Apple Developer et Google Play : frais annuels/uniques de compte ; commission des boutiques sur les abonnements. |
| RevenueCat | Gratuit jusqu'à un seuil de revenu suivi ; à vérifier. |
| Stripe (web) | Commission par transaction. |
| Direct (arènes live) | Non construit. Prévoir un service WebRTC géré (Cloudflare, Mux) ; coût à la minute, à chiffrer avant. |
| Modération | Temps humain du fondateur au début : la vraie contrainte. |

## Hypothèses à valider
- Prix Pro 4,99 €/mois ou 39,99 €/an : non testés auprès d'utilisateurs.
- Volume de vidéos par utilisateur actif et poids moyen d'une vidéo : à mesurer sur les premiers duels réels.
