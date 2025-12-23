// src/utils/feedback.ts
import { Vibration } from "react-native";
import { Audio } from "expo-av";

type SportKey = "pushups" | "running" | "basket" | "swim" | "piscine" | "aqua" | "default";

const SPORT_PATTERNS: Record<SportKey, number[] | number> = {
  pushups: [0, 60, 20, 60],
  running: [0, 30, 10, 30, 10, 30],
  basket: [0, 50, 30, 50],
  swim: [0, 40, 40, 30],
  piscine: [0, 40, 40, 30],
  aqua: [0, 40, 40, 30],
  default: 20,
};

const SOUND_SOURCES: Record<string, any> = {
  pushups: require("../../assets/sounds/pushups.wav"),
  running: require("../../assets/sounds/running.wav"),
  basket: require("../../assets/sounds/basket.wav"),
  swim: require("../../assets/sounds/swim.wav"),
};

const DEFAULT_SOUND_KEY = "running";
const loadedSounds: Record<string, Audio.Sound | null> = {};
const loadingPromises: Record<string, Promise<Audio.Sound | null> | undefined> = {};

async function loadSportSound(key: string) {
  if (loadedSounds[key]) return loadedSounds[key];
  if (loadingPromises[key]) return loadingPromises[key];
  const source = SOUND_SOURCES[key];
  if (!source) {
    loadedSounds[key] = null;
    return null;
  }
  const loadPromise = Audio.Sound.createAsync(source, { volume: 0.6 }).then(
    ({ sound }) => {
      loadedSounds[key] = sound;
      return sound;
    }
  );
  loadingPromises[key] = loadPromise;
  return loadPromise;
}

// petit bump positif
export const feedbackSuccess = () => {
  Vibration.vibrate(40);
};

// feedback d'erreur
export const feedbackError = () => {
  Vibration.vibrate([0, 80, 40, 80]);
};

// feedback leger (clic)
export const feedbackTap = () => {
  Vibration.vibrate(20);
};

export async function playSportFeedback(rawSport?: string | null) {
  const sport = (rawSport || "").toLowerCase();
  let key: string;
  if (SOUND_SOURCES[sport]) {
    key = sport;
  } else if (sport === "piscine" || sport === "aqua") {
    key = "swim";
  } else {
    key = DEFAULT_SOUND_KEY;
  }
  const vibrationKey =
    (sport as SportKey) in SPORT_PATTERNS ? (sport as SportKey) : "default";
  const pattern = SPORT_PATTERNS[vibrationKey] || SPORT_PATTERNS.default;
  Vibration.vibrate(pattern as number | number[]);
  try {
    const sound = await loadSportSound(key);
    if (!sound) return;
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (err) {
    console.log("SPORT FEEDBACK AUDIO ERROR", err);
  }
}
