// src/utils/feedback.ts
import { Vibration } from "react-native";

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
