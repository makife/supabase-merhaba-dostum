import { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.ergan.kelimele",
  appName: "Kelimele",
  webDir: "dist",
  android: {
    allowMixedContent: true,
    captureInput: false,
    webContentsDebuggingEnabled: true,
    windowSoftInputMode: "adjustResize",
    overrideUserAgent: "ImmersiveApp",
    backgroundColor: "#000000",
    useLegacyBridge: false,
  },
  ios: {
    contentInset: "automatic",
    scrollEnabled: false,
    allowsLinkPreview: false,
    backgroundColor: "#000000",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      backgroundColor: "#000000",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#000000",
      overlay: true,
    },
    Keyboard: {
      resize: "ionic",
    },
    AdMob: {
      appId: "ca-app-pub-4768026665961339~9319477813",
      androidAppId: "ca-app-pub-4768026665961339~9319477813",
      iosAppId: "ca-app-pub-4768026665961339~4109751189",
    },
    ScreenOrientation: {
      orientation: "portrait",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    GoogleAuth: {
      scopes: ["profile", "email"],
      iosClientId: "285249195022-gofb8lvh2h0cu6omd2bngmp5agqlfh8g.apps.googleusercontent.com",
      serverClientId: "285249195022-lkl6tg29ac8ahqiibhjinlo4j55cpa2m.apps.googleusercontent.com",
      forceCodeForRefreshToken: true,
    },
  },
};
export default config;
