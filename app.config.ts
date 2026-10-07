// Expo-Konfiguration. Werte aus .env (siehe .env.example) bzw. aus den EAS-Umgebungsvariablen.
import type { ExpoConfig } from "expo/config";

const BUNDLE_ID = process.env.APP_BUNDLE_ID || "de.goatsocceracademy.trainerbank";

const config: ExpoConfig = {
  name: "Trainerbank",
  slug: "trainerbank",
  scheme: "trainerbank",
  version: "1.0.0",
  orientation: "default",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: true,
    buildNumber: "1",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: "Trainerbank nutzt die Kamera, um Profilbilder und Befunde (z. B. Arztbriefe) zu fotografieren.",
      NSPhotoLibraryUsageDescription: "Trainerbank greift auf deine Fotos zu, wenn du ein Profilbild oder einen Befund auswählst.",
      CFBundleAllowMixedLocalizations: true,
    },
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: BUNDLE_ID,
    versionCode: 1,
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#0B3D91" },
    permissions: ["android.permission.CAMERA", "android.permission.POST_NOTIFICATIONS"],
    blockedPermissions: ["android.permission.RECORD_AUDIO", "android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION"],
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/favicon.png",
  },
  locales: { de: "./assets/locales/de.json", en: "./assets/locales/en.json" },
  plugins: [
    "expo-router",
    "expo-localization",
    "expo-sharing",
    "expo-status-bar",
    ["expo-splash-screen", { image: "./assets/splash-icon.png", imageWidth: 200, resizeMode: "contain", backgroundColor: "#0B3D91" }],
    ["expo-notifications", { icon: "./assets/notification-icon.png", color: "#0B3D91" }],
    ["expo-image-picker", {
      photosPermission: "Trainerbank greift auf deine Fotos zu, wenn du ein Profilbild oder einen Befund auswählst.",
      cameraPermission: "Trainerbank nutzt die Kamera, um Profilbilder und Befunde (z. B. Arztbriefe) zu fotografieren.",
      microphonePermission: false,
    }],
  ],
  experiments: { typedRoutes: false },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
