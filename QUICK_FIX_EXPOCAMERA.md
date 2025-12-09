# 🚀 SOLUTION EXPOCAMERA - GUIDE RAPIDE

## Le Problème
❌ `Cannot find native module 'ExpoCamera'` quand vous cliquez "Tester Arena Live"

## La Cause
Expo Go n'inclut pas les modules natifs compilés. ExpoCamera doit être compilé nativement.

## ✅ La Solution (3 Étapes)

### Étape 1: Préparer le projet
```powershell
cd C:\Users\kenam\Documents\sport-challenge-app
npx expo prebuild --clean
```
⏱ 2-3 minutes

### Étape 2: Builder le Development Client
```powershell
eas login  # Si pas encore loggé
eas build --platform android --profile development
```
⏱ 10-15 minutes (le build se fera sur les serveurs Expo)

### Étape 3: Installer et Tester
1. Téléchargez l'APK de votre dashboard EAS
2. Installez sur Xiaomi: `adb install app-debug.apk`
3. Lancez l'app: `npm start`
4. Scannez le code QR avec votre **Development Client** (pas Expo Go!)
5. Testez: Home → Arène → Page Live → "Tester Arena Live"

✅ **ExpoCamera fonctionne maintenant!**

---

## 🆘 Si vous voulez juste tester SANS modules natifs

Modifiez `src/screens/ArenaLiveScreen.tsx` ligne ~50:

```typescript
// Changez ceci:
const mode = "live"; // Essaie de charger la camera

// En ceci:
const mode = "simulation"; // Simulation mode, pas besoin de camera
```

Ensuite:
```powershell
npm start
# Scannez avec Expo Go (pas besoin de compiler)
```

✅ Pas d'erreur - mode simulation!

---

## 📋 Fichiers Créés Pour Vous

- **EXPOCAMERA_NATIVE_SOLUTION.md** - Documentation complète
- **BUILD_DEV_CLIENT.bat** - Script Windows (double-click!)
- **BUILD_DEV_CLIENT.ps1** - Script PowerShell (plus robuste)
- **android/** - Dossier natif généré (après prebuild)

---

## 🎯 Résumé des Changements

| Fichier | Changement |
|---------|-----------|
| app.json | Slug + plugins (expo-dev-client) |
| eas.json | Development profile configuré |
| src/utils/cameraCompat.ts | Fallback + logs améliorés |
| android/ | **Généré avec modules natifs compilés** |

---

## 🔗 Liens Utiles

- Build Dev Client: https://docs.expo.dev/development/build/
- Authentification: https://docs.expo.dev/accounts/
- Status du Build: https://expo.dev/accounts

---

## ⏭️ Prochaine Action

### Option A: Builder maintenant (RECOMMANDÉ)
```powershell
# Windows: Double-click
BUILD_DEV_CLIENT.bat

# Ou PowerShell:
powershell -ExecutionPolicy RemoteSigned -File BUILD_DEV_CLIENT.ps1
```

### Option B: Builder manuellement
```powershell
npx expo prebuild --clean
eas build --platform android --profile development --wait
```

### Option C: Rester en Simulation Mode
```typescript
// ArenaLiveScreen.tsx ligne 50
const mode = "simulation";
```

---

**Status:** ✅ Prêt à builder! Exécutez `BUILD_DEV_CLIENT.bat`

Questions? Consultez `EXPOCAMERA_NATIVE_SOLUTION.md`
