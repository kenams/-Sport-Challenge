#!/bin/bash
# TEST_GUIDE.md - Guide pratique pour tester Arena Live

## 🎯 GUIDE DE TEST - ARENA LIVE

### Prérequis
- Xiaomi 11T Pro avec USB debugging activé
- Cable USB
- Node.js et npm installés
- Android SDK/ADB configuré

---

## 📱 ÉTAPE 1: Préparation du Device

```powershell
# Connectez votre Xiaomi 11T Pro via USB

# Vérifiez que le device est détecté:
adb devices

# Résultat attendu:
# List of attached devices
# emulator-5554          device    (ou votre device serial)
```

Si pas de device, activez:
1. Allez dans **Paramètres → À propos du téléphone**
2. Tapez 7 fois sur **Numéro de version** (Active Mode Développeur)
3. Allez dans **Paramètres → Options de développeur**
4. Activez **Débogage USB**
5. Reconnectez le cable

---

## 🚀 ÉTAPE 2: Déployer l'App

### Option A: Build Development Client (RECOMMANDÉ - Modules natifs)

```powershell
cd C:\Users\kenam\Documents\sport-challenge-app

# 1. Builder le Development Client
eas login
eas build --platform android --profile development --wait

# 2. Après ~15 min, téléchargez l'APK
# Allez dans: https://expo.dev/accounts/@YOUR_USERNAME/projects
# Téléchargez l'APK

# 3. Installez sur le device
adb install -r app-debug.apk

# 4. Lancez le serveur Expo
npm start

# 5. Quand vous voyez "press 'a' to open Android", appuyez sur 'a'
# OU ouvrez manuellement l'app sur votre phone
```

### Option B: Mode Simulation (Plus rapide - Pas de modules natifs)

```powershell
# 1. Éditer ArenaLiveScreen.tsx
# Ligne ~50: Changez "const mode = "live";" en "const mode = "simulation";"

# 2. Sauvegardez

# 3. Lancez Expo
npm start

# 4. Scannez le QR avec Expo Go sur votre phone
```

---

## 🧪 ÉTAPE 3: Tests à Faire

### Test 1️⃣: Navigation Basique

```
1. App ouvre
   ✓ Logo IMMORTAL-K visible
   ✓ 6 onglets en bas (Arène, Flux, Tableau, Boutique, Coach, Profil)

2. Testez chaque onglet
   ✓ Arène → LiveHubScreen (découverte)
   ✓ Flux → FeedScreen (challenges)
   ✓ Tableau → RankingScreen (classement)
   ✓ Boutique → ShopScreen
   ✓ Coach → ImpitoyableDashboard
   ✓ Profil → ProfileScreen
```

**RÉSULTAT ATTENDU:**
- ✅ Pas d'erreur de navigation
- ✅ Chaque onglet charge correctement
- ✅ Pas de crash

---

### Test 2️⃣: Arena Live Flow

```
1. Allez dans l'onglet "Arène"
   ✓ LiveHubScreen chargée
   ✓ Titre "Arena Live" visible
   ✓ Bouton "Tester Arena Live" visible

2. Cliquez sur "Tester Arena Live"
   ✓ ArenaLiveScreen lance
   ✓ ✅ IMPORTANT: PAS D'ERREUR "Cannot find native module 'ExpoCamera'"

3. Vérifiez l'interface
   ✓ Camera preview (ou placeholder en simulation)
   ✓ Bouttons et controls affichés
   ✓ Layout responsive (pas de text coupé)
   ✓ Bottom tabs pas couverts
```

**RÉSULTAT ATTENDU:**
- ✅ ArenaLiveScreen ouvre sans erreur
- ✅ UI complète affichée
- ✅ Pas de crash sur caméra

---

### Test 3️⃣: ExpoCamera (Option A uniquement)

```
1. Sur ArenaLiveScreen
   ✓ Bouton "Demander accès caméra" visible

2. Cliquez dessus
   ✓ Popup de permission Android s'affiche
   ✓ Acceptez "Autoriser"
   ✓ ✅ Caméra s'active (preview visible)

3. Vérifiez les logs
   ✓ Dans le terminal, cherchez:
     "✅ ExpoCamera native module loaded successfully"
```

**RÉSULTAT ATTENDU:**
- ✅ Permissions demandées
- ✅ Caméra fonctionne
- ✅ Pas d'erreur native

---

### Test 4️⃣: Responsive Design

```
Sur votre Xiaomi 11T Pro (1440x3200px):

1. Vérifiez les padding/espaces
   ✓ Pas de text collé à gauche/droite
   ✓ Padding correct autour du contenu
   ✓ Bottom tabs pas coupés

2. Vérifiez les fonts
   ✓ Texte lisible (pas trop petit)
   ✓ Boutons cliquables (assez grands)

3. Vérifiez l'orientation
   ✓ Portrait mode fonctionne
   ✓ Layout s'adapte à la largeur

4. Testez sur différents écrans
   ✓ Si possible, testez aussi sur un autre téléphone
   ✓ Vérifiez que la mise en page s'adapte
```

**RÉSULTAT ATTENDU:**
- ✅ Layout parfait sur Xiaomi 11T Pro
- ✅ Tout lisible et cliquable
- ✅ Responsive design fonctionne

---

## 🔍 ÉTAPE 4: Vérifier les Logs

### Terminal - Espérer voir:

```
✅ SUCCESS: Arena Live Ready
✓ Navigation: OK (15 fixes appliquées)
✓ ExpoCamera: Loaded (Option A) ou Fallback (Option B)
✓ WebRTC: Ready
✓ Responsive: OK
```

### Erreurs à ÉVITER:

```
❌ "Cannot find native module 'ExpoCamera'"
   → Vous utilisez Expo Go au lieu du Development Client
   → Solution: Installez l'APK du build EAS

❌ "The action 'NAVIGATE' with payload..."
   → Bug de navigation corrigé
   → Si ça apparaît, contactez-moi

❌ "Module not found: ..."
   → Manque des dependencies
   → Solution: npm install

❌ "Camera: Access Denied"
   → Permission manquante
   → Réaccordez la permission dans Paramètres
```

---

## 📊 Tableau de Résultats

Créez un fichier `TEST_RESULTS.txt` avec:

```
🧪 TEST RESULTS - ARENA LIVE
Date: [DATE]
Device: Xiaomi 11T Pro
Build: Option A (EAS) / Option B (Simulation)

✓ Navigation Tests:
  [ ] Tous les 6 onglets fonctionnent
  [ ] Pas d'erreur de navigation
  [ ] Back button marche

✓ Arena Live Tests:
  [ ] LiveHubScreen ouvre
  [ ] "Tester Arena Live" bouton fonctionne
  [ ] ArenaLiveScreen lance sans erreur
  [ ] UI complète affichée

✓ ExpoCamera Tests (Option A):
  [ ] Caméra s'active
  [ ] Permission demandée
  [ ] Logs montrent "ExpoCamera: Loaded"

✓ Responsive Tests:
  [ ] Layout correct sur Xiaomi 11T Pro
  [ ] Padding approprié
  [ ] Bottom tabs visibles
  [ ] Texte lisible

[ ] TOUT FONCTIONNE? OUI / NON

Problèmes rencontrés:
- [Listez les soucis ici]

Notes:
- [Vos observations]
```

---

## 🎬 SCÉNARIO COMPLET DE TEST (10 minutes)

```powershell
# Time: 0-1 min
npm start

# Time: 1-2 min (scannez le QR avec votre phone)

# Time: 2-3 min (app ouvre et se stabilise)

# Time: 3-4 min
Test 1: Cliquez sur chaque onglet (Arène, Flux, Tableau, Boutique, Coach, Profil)

# Time: 4-7 min
Test 2: Onglet Arène → "Tester Arena Live"
        → Vérifiez: Pas d'erreur ExpoCamera ✅

# Time: 7-8 min (Option A seulement)
Test 3: Cliquez "Demander accès caméra"
        → Acceptez la permission
        → Vérifiez: Caméra active ✅

# Time: 8-10 min
Test 4: Vérifiez le responsive design
        → Padding OK?
        → Texte lisible?
        → Bottom tabs visibles?
```

---

## 💡 Astuces de Debug

### Voir les logs du Terminal:

```powershell
# Terminal 1: Serveur Expo
npm start

# Terminal 2: Logs en temps réel
adb logcat | grep "ExpoCamera\|ERROR\|Arena"
```

### Recharger l'app sans rebuild:

```
Sur votre phone:
- Appuyez 2 fois (Reload)
- OU Press 'r' dans le terminal

Sur le device physique:
- Secouez le téléphone
- OU appuyez sur le menu
```

### Forcer un full rebuild:

```powershell
npm start -- -c  # -c = clear cache
```

### Réinitialiser Expo:

```powershell
npm start -- --reset-cache
```

---

## ✅ RÉSUMÉ - COMMENT SAVOIR QUE TOUT FONCTIONNE?

| Critère | OK ✅ | KO ❌ |
|---------|-------|-------|
| **Navigation** | Tous les onglets chargent | "NAVIGATE" error |
| **Arena Live** | ArenaLiveScreen ouvre | Crash ou erreur |
| **ExpoCamera** | "ExpoCamera: Loaded" dans logs | "Cannot find native module" |
| **Responsive** | Layout parfait sur Xiaomi | Text coupé ou overlap |
| **Permissions** | Caméra demande permission | Pas de popup |

**SI TOUS LES ✅, C'EST BON!** 🎉

---

## 🆘 Problèmes?

Si vous rencontrez un problème:

1. Vérifiez les logs: `adb logcat | grep ERROR`
2. Cherchez le message exact d'erreur
3. Essayez: `npm start -- -c` (clear cache)
4. Réinstallez l'APK: `adb uninstall com.kenams.immortalk && adb install app-debug.apk`
5. Vérifiez que le device est connecté: `adb devices`

---

**Bonne chance! Le test devrait prendre ~10 minutes. 🚀**
