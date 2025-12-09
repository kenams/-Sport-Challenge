// src/utils/layout.ts
import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

// Xiaomi 11T Pro: 1440x3200px (6.67 inches, 16:9 aspect)
export const SCREEN = {
  width,
  height,
  isSmall: width < 375,
  isMedium: width >= 375 && width < 430,
  isLarge: width >= 430,
};

// Espacements responsifs
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Padding standard pour les écrans
export const SCREEN_PADDING = {
  horizontal: SCREEN.isSmall ? 12 : SCREEN.isMedium ? 14 : 16,
  vertical: SCREEN.isSmall ? 10 : SCREEN.isMedium ? 12 : 14,
};

// Hauteurs de composants adaptatives
export const COMPONENT_HEIGHT = {
  button: SCREEN.isSmall ? 42 : 48,
  card: SCREEN.isSmall ? 120 : 140,
  tabBar: 64,
};

// Font sizes responsifs
export const FONT_SIZE = {
  xs: SCREEN.isSmall ? 11 : 12,
  sm: SCREEN.isSmall ? 12 : 13,
  md: SCREEN.isSmall ? 13 : 14,
  lg: SCREEN.isSmall ? 15 : 16,
  xl: SCREEN.isSmall ? 17 : 18,
  xxl: SCREEN.isSmall ? 20 : 22,
  xxxl: SCREEN.isSmall ? 24 : 28,
};

// Largeur max pour les conteneurs
export const MAX_CONTENT_WIDTH = Math.min(width - SCREEN_PADDING.horizontal * 2, 500);
