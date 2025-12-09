// src/utils/cameraCompat.ts
/**
 * Wrapper pour expo-camera compatible avec les environnements
 * où le module natif n'est pas disponible (ex: dev Expo Go)
 * 
 * SOLUTION: Pour avoir les modules natifs compilés:
 * 1. Run: npx expo prebuild --clean
 * 2. Run: BUILD_DEV_CLIENT.bat (ou eas build --platform android --profile development)
 * 3. This wrapper is for fallback/simulation mode only
 */

// Flag pour forcer le mode simulation (utile pour debug)
export const FORCE_SIMULATION_MODE = false; // Set to true to debug without camera

export async function loadCameraModule(): Promise<any> {
  if (FORCE_SIMULATION_MODE) {
    console.warn("FORCE_SIMULATION_MODE enabled - using fallback camera");
    return getDummyCameraModule();
  }

  try {
    // Essayer de charger expo-camera
    const module = await import("expo-camera");
    console.log("✅ ExpoCamera native module loaded successfully");
    return module;
  } catch (error) {
    console.warn("⚠️ ExpoCamera module not available, using fallback");
    console.warn("Run: npx expo prebuild --clean && BUILD_DEV_CLIENT.bat");
    // Retourner un fallback dummy
    return getDummyCameraModule();
  }
}

function getDummyCameraModule() {
  return {
    Camera: {
      requestCameraPermissionsAsync: async () => ({
        status: "granted" as const,
      }),
      requestMicrophonePermissionsAsync: async () => ({
        status: "granted" as const,
      }),
    },
  };
}

export const CameraCompat = {
  requestCameraPermissionsAsync: async () => ({
    status: "granted" as const,
  }),
  requestMicrophonePermissionsAsync: async () => ({
    status: "granted" as const,
  }),
};
