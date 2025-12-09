# ✅ CHECKLIST DE TEST ARENA LIVE

## PRÉ-TEST
- [ ] Xiaomi 11T Pro connectée via USB
- [ ] USB debugging activé dans Developer Options
- [ ] `adb devices` montre le device
- [ ] Node.js/npm installés
- [ ] Vous êtes dans le dossier: `C:\Users\kenam\Documents\sport-challenge-app`

## CHOIX DU TEST

### Option Choisie: 
- [ ] Option A - Development Client (modules natifs)
- [ ] Option B - Simulation Mode (plus rapide)

### Option A - Si vous avez choisi le full native:
- [ ] `eas login` - Authentifié
- [ ] `eas build ...` - Build complété
- [ ] APK téléchargée
- [ ] `adb install -r app-debug.apk` - Installé
- [ ] Pas d'erreur lors de l'installation

### Option B - Si vous avez choisi la simulation:
- [ ] Fichier `src/screens/ArenaLiveScreen.tsx` modifié
- [ ] `const mode = "simulation"` appliqué
- [ ] Fichier sauvegardé

## DÉMARRAGE
- [ ] Connecté au dossier du projet
- [ ] Terminal: `npm start` lancé
- [ ] Code QR affiché dans le terminal
- [ ] Expo Go (Option B) ou app custom (Option A) ouvert
- [ ] Code QR scannés
- [ ] App en train de charger...

## TEST 1: CHARGEMENT INITIAL
- [ ] App démarre (écran blanc puis affichage)
- [ ] Logo IMMORTAL-K visible
- [ ] **6 onglets au bas:** Arène | Flux | Tableau | Boutique | Coach | Profil
- [ ] HomeScreen affichée (challenge feed)
- [ ] Pas de crash

**Status:** ✅ Passer au test 2 / ❌ Voir Troubleshooting

---

## TEST 2: NAVIGATION BASIQUE

### Onglet "Arène" (1er onglet)
- [ ] Ouvrir sans crash
- [ ] LiveHubScreen chargée
- [ ] Titre "Arena Live" visible
- [ ] Bouton "Tester Arena Live" visible
- [ ] Pas d'erreur de navigation

### Onglet "Flux" (2e onglet)
- [ ] Ouvrir sans crash
- [ ] FeedScreen affichée
- [ ] Contenu chargé (ou vide si pas de data)
- [ ] Pas d'erreur

### Onglet "Tableau" (3e onglet)
- [ ] Ouvrir sans crash
- [ ] RankingScreen affichée
- [ ] Classement visible

### Onglet "Boutique" (4e onglet)
- [ ] Ouvrir sans crash
- [ ] ShopScreen affichée

### Onglet "Coach" (5e onglet)
- [ ] Ouvrir sans crash
- [ ] ImpitoyableDashboard affichée

### Onglet "Profil" (6e onglet)
- [ ] Ouvrir sans crash
- [ ] ProfileScreen affichée

**Status:** ✅ Navigation OK / ❌ Erreur détectée

**ERREURS ATTENDUS À ÉVITER:**
- ❌ "The action 'NAVIGATE' with payload {"name":"Defis"} was not handled"
- ❌ Navigation stack errors
- ❌ App freeze

---

## TEST 3: ARENA LIVE - FLOW PRINCIPAL

### Depuis n'importe quel onglet:
- [ ] Allez à l'onglet "Arène"
- [ ] LiveHubScreen visible
- [ ] Bouton "Tester Arena Live" visible
- [ ] Cliquez sur le bouton

### Attendre que ArenaLiveScreen s'ouvre:
- [ ] ✅ **CRUCIAL:** Pas d'erreur "Cannot find native module 'ExpoCamera'"
- [ ] ✅ ArenaLiveScreen ouvre
- [ ] ✅ UI affichée complètement
- [ ] ✅ Pas de crash

### Interface ArenaLiveScreen:
- [ ] Camera preview visible (ou placeholder)
- [ ] Titre "Arena Live" visible
- [ ] Boutons d'action visibles
- [ ] Layout responsive (pas de text coupé)
- [ ] Bottom tabs pas recouverts

**ERREUR À ÉVITER:**
- ❌ "Cannot find native module 'ExpoCamera'"
- ❌ "ExpoCamera module not available and fallback failed"
- ❌ App crash au démarrage

**Status:** ✅ ExpoCamera OK / ❌ Erreur détectée

---

## TEST 4: CAMERA & PERMISSIONS (Option A uniquement)

### Demander la permission caméra:
- [ ] Bouton "Demander accès caméra" cliquable
- [ ] Cliquez dessus

### Popup Android:
- [ ] Popup de permission s'affiche
- [ ] "IMMORTAL-K demande l'accès à la caméra"
- [ ] Boutons "Refuser" et "Autoriser" visibles
- [ ] Cliquez "Autoriser"

### Après acceptation:
- [ ] ✅ Camera preview s'active
- [ ] ✅ Video stream visible
- [ ] Pas de crash
- [ ] Pas d'erreur dans les logs

### Vérifier les logs du terminal:
```
Cherchez: "✅ ExpoCamera native module loaded successfully"
```

- [ ] Message de succès ExpoCamera visible
- [ ] Pas de "ERROR" en majuscules

**Status:** ✅ Caméra fonctionne / ❌ Erreur détectée

---

## TEST 5: RESPONSIVE DESIGN

### Sur votre Xiaomi 11T Pro (1440x3200px):

#### Padding et Espaces:
- [ ] Texte pas collé au bord gauche
- [ ] Texte pas collé au bord droit
- [ ] Padding en haut suffisant
- [ ] Bottom tabs pas coupés

#### Lisibilité:
- [ ] Tous les textes lisibles
- [ ] Boutons assez grands (facilement cliquables)
- [ ] Icônes visibles
- [ ] Pas de texte tronqué

#### Bottom Tabs:
- [ ] 6 onglets tous visibles
- [ ] Icones visibles
- [ ] Labels lisibles
- [ ] Pas recouvert par le contenu

#### Orientation:
- [ ] Portrait mode fonctionne
- [ ] Rotate le phone: layout s'adapte
- [ ] Pas de crash lors de rotation

**Status:** ✅ Responsive OK / ⚠️ Petit ajustement / ❌ Problème majeur

---

## TEST 6: PERFORMANCE & LOGS

### Performances:
- [ ] App répond rapidement aux touches
- [ ] Navigation fluide (pas de lag)
- [ ] Pas de freeze
- [ ] FPS acceptable

### Logs du Terminal:
```
Cherchez ces messages:
✅ ExpoCamera (native ou fallback)
✅ Arena Live Ready
✅ Navigation OK
```

- [ ] Pas d'erreurs massives
- [ ] Warnings acceptables

### Pas d'erreurs critiques:
- [ ] Pas de "ERROR" en rouge
- [ ] Pas de "FATAL"
- [ ] Pas de "Cannot find module"

**Status:** ✅ Performance OK / ⚠️ Quelques warnings / ❌ Problèmes sérieux

---

## RÉSULTATS FINAUX

### Tous les tests sont ✅?
**Résultat:** 🎉 **ARENA LIVE EST FONCTIONNEL!**

### Certains tests ⚠️?
**Résultat:** ⚠️ **Fonctionnel avec des améliorations possibles**

### Certains tests ❌?
**Résultat:** ❌ **Problème à résoudre**

---

## TROUBLESHOOTING RAPIDE

| Problème | Solution |
|----------|----------|
| "Cannot find native module 'ExpoCamera'" | Utilisez Option B ou installez l'APK Option A |
| Device pas reconnu | `adb devices` // Reconnectez USB // Activez USB debugging |
| App crash au démarrage | `npm start -- -c` (clear cache) |
| Code QR pas apparente | Attendez 10s // Tapez 'w' pour web // Tapez 'a' pour Android |
| Pas de video camera | Permissions non accordées // Téléphone en mode portrait |
| Text coupé | Responsive design à optimiser |
| Bottom tabs recouverts | Layout padding à ajuster |

---

## NOTES DE TEST

```
Date du test: _______________
Option testée: [ ] A [ ] B
Device: Xiaomi 11T Pro

Résultats:
- Navigation: _____ / 10
- Arena Live: _____ / 10
- ExpoCamera: _____ / 10
- Responsive: _____ / 10
- Performance: _____ / 10

TOTAL: _____ / 50

Problèmes trouvés:
1. _________________________________
2. _________________________________
3. _________________________________

À améliorer:
- _________________________________
- _________________________________

Observations:
_________________________________
_________________________________
```

---

**Bonne chance avec le test! 🚀**

Quand vous avez fini, vous pouvez partager les résultats ou les problèmes que vous avez rencontrés.
