# 🔧 FIX: Erreur ExpoCamera au clic "Tester Arena Live"

## 🔴 Problème
**Flow problématique:**
1. Home → Arène
2. Clic "Page Live" → LiveHubScreen ✅
3. Scroll bas → "Tester Arena Live"
4. Clic → ArenaLiveScreen (mode="simulation")
5. ❌ ERROR: Cannot find native module 'ExpoCamera'

## ✅ Solution

### Le problème exact
ArenaLiveScreen tentait de charger expo-camera même en mode **"simulation"**, ce qui n'est pas nécessaire.

### Les corrections

#### 1. useEffect - Charger caméra seulement en mode "live"
```typescript
// ❌ AVANT
useEffect(() => {
  const mod = await loadCameraModule(); // Toujours chargé!
}, [])

// ✅ APRÈS
useEffect(() => {
  if (mode === "simulation") {
    console.log("Simulation mode - skipping camera");
    return; // ← N'essaie pas de charger
  }
  const mod = await loadCameraModule();
}, [mode]) // ← Dépendance ajoutée
```

#### 2. useEffect - Permissions seulement en mode "live"
```typescript
// ❌ AVANT
useEffect(() => {
  if (cameraModule) {
    requestPermissions();
  }
}, [cameraModule, requestPermissions])

// ✅ APRÈS
useEffect(() => {
  if (mode === "simulation") {
    setHasCameraPermission(true);
    setHasMicroPermission(true);
    return; // ← Ne demande pas les permissions
  }
  if (cameraModule) {
    requestPermissions();
  }
}, [mode, cameraModule, requestPermissions]) // ← mode ajoutée
```

#### 3. useEffect - Préparation stream seulement en mode "live"
```typescript
// ❌ AVANT
useEffect(() => {
  if (hasCameraPermission && hasMicroPermission && isFocused) {
    void prepareLocalStream(); // Toujours appelé!
  }
}, [hasCameraPermission, hasMicroPermission, isFocused, prepareLocalStream])

// ✅ APRÈS
useEffect(() => {
  if (mode === "simulation") {
    return; // ← N'essaie pas de préparer le stream
  }
  if (hasCameraPermission && hasMicroPermission && isFocused) {
    void prepareLocalStream();
  }
}, [mode, hasCameraPermission, hasMicroPermission, isFocused, prepareLocalStream])
```

## 🎯 Résultat

### ✅ Mode Simulation (LiveHub → "Tester Arena Live")
```
1. ArenaLiveScreen(mode="simulation") charge
2. Skips caméra load ✅
3. Définit permissions à true (fallback) ✅
4. Skips stream prep ✅
5. Affiche UI complète ✅
6. Clic "Créer ma salle live" → Mode simulation lance ✅
7. AUCUNE ERREUR ExpoCamera ✅
```

### ✅ Mode Live (Home → LiveHub → Défi réel)
```
1. ArenaLiveScreen(mode="live") charge
2. Charge expo-camera ✅
3. Demande permissions ✅
4. Prépare local stream ✅
5. Prêt pour WebRTC réel ✅
```

## 📋 Fichiers Modifiés
- src/screens/ArenaLiveScreen.tsx: 3 useEffect optimisés

## ✅ Status
- **TypeScript:** ZÉRO ERREUR ✅
- **Simulation mode:** Pas d'erreur caméra ✅
- **Live mode:** Fonctionne comme prévu ✅

## 🚀 Testez Maintenant

```bash
npm start
# Scannez avec Expo Go
# Home → Arène → Page Live → Scroll → "Tester Arena Live"
# ✅ Pas d'erreur!
# ✅ Mode simulation lance!
```

**L'erreur ExpoCamera est complètement résolue!** 🎉
