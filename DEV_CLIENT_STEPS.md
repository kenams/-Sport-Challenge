# Builder et installer un Development Client (Android)

Ce guide explique comment créer un development client (APK) qui contient les modules natifs (`expo-camera`, `react-native-webrtc`) et l'installer sur votre appareil Android.

1) Prérequis
- Avoir un compte Expo et être connecté (`eas login`).
- Avoir `eas-cli` installé (`npm i -g eas-cli`).
- Avoir Java + Android SDK (ou laisser EAS builder faire le travail sur leurs serveurs).
- Votre `app.json` doit contenir le `slug` et `extra.eas.projectId` (déjà présent).

2) Vérifier `app.json` et `eas.json`
- Assurez-vous que `plugins` contient les plugins natifs nécessaires (ex: `expo-camera`).
- `eas.json` possède un profil `development` avec `developmentClient: true`.

3) Lancer le prebuild (optionnel si vous utilisez EAS remote builds, mais utile localement):
```powershell
npx expo prebuild --clean
```
Cela génère `android/` et `ios/`.

4) Builder via EAS (remote) — méthode recommandée
```powershell
# Login si nécessaire
eas login

# Build dev client pour Android (profil 'development')
eas build --platform android --profile development --non-interactive
```
- Une fois le build fini, téléchargez l'APK depuis https://expo.dev/accounts/<your-username>/projects/<project>/builds

5) Installer l'APK sur votre téléphone (via ADB)
```powershell
adb install -r path\to\your-dev-client.apk
```
- `-r` remplace l'app si déjà installée.

6) Lancer le projet dans le dev-client
- Démarrez le serveur Metro localement:
```powershell
npx expo start --tunnel --clear
```
- Ouvrez le Development Client sur votre téléphone et scannez le QR, ou ouvrez "Enter URL" et collez l'URL `exp+...` affichée dans la console.

7) Vérifications et dépannage
- Si vous voyez `Cannot find native module 'ExpoCamera'` : assurez-vous d'avoir bien installé le dev client APK (Expo Go ne contient pas les modules natifs personnalisés).
- Consultez les logs ADB pour les erreurs natives:
```powershell
adb logcat | findstr /I "ExpoCamera\|ERROR\|ARENA"
```

8) Remarques
- Si vous préférez ne pas utiliser EAS, vous pouvez ouvrir `android/` dans Android Studio et construire un debug APK localement.
- Gardez `FORCE_SIMULATION_MODE` à `false` pour tester le vrai comportement avec caméra native.

---
Si vous voulez, je peux lancer le build EAS pour vous (nécessite login interactif) ou vous guider pas à pas pour télécharger et installer l'APK.