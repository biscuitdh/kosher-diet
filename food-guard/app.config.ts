import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Food Guard",
  slug: "food-guard",
  scheme: "foodguard",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "family.foodguard.app",
    config: {
      usesNonExemptEncryption: false
    },
    infoPlist: {
      NSCameraUsageDescription: "Food Guard uses the camera to scan barcodes and ingredient labels.",
      NSPhotoLibraryUsageDescription: "Food Guard can analyze ingredient label photos you select."
    }
  },
  android: {
    package: "family.foodguard.app",
    permissions: ["CAMERA"]
  },
  plugins: [
    "expo-router",
    [
      "expo-camera",
      {
        cameraPermission: "Allow Food Guard to scan barcodes and ingredient labels.",
        recordAudioAndroid: false,
        barcodeScannerEnabled: true
      }
    ],
    [
      "expo-sqlite",
      {
        enableFTS: false,
        useSQLCipher: false
      }
    ]
  ],
  experiments: {
    typedRoutes: true
  }
};

export default config;
