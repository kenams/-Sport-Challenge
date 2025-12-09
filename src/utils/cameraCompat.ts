// src/utils/cameraCompat.ts
/**
 * Wrapper pour expo-camera compatible avec les environnements
 * où le module natif n'est pas disponible (ex: dev Expo Go)
 */

export async function loadCameraModule(): Promise<any> {
  try {
    // Essayer de charger expo-camera
    const module = await import("expo-camera");
    return module;
  } catch (error) {
    console.warn("ExpoCamera module not available, using fallback");
    // Retourner un fallback dummy
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
}

export const CameraCompat = {
  requestCameraPermissionsAsync: async () => ({
    status: "granted" as const,
  }),
  requestMicrophonePermissionsAsync: async () => ({
    status: "granted" as const,
  }),
};
