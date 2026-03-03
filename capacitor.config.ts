import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ergan.kelimele',
  appName: 'supabase-merhaba-dostum',
  webDir: 'dist',

  android: {
    allowMixedContent: true,
    captureInput: false,
    webContentsDebuggingEnabled: true,
    windowSoftInputMode: 'adjustResize',
    // Immersive mode flags
    overrideUserAgent: 'ImmersiveApp',
    backgroundColor: '#000000',
    // Background running ayarları
    useLegacyBridge: false,
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    backgroundColor: '#000000'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      backgroundColor: '#000000'
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
      overlay: true
    },
    Keyboard: {
      resize: 'ionic'
    },
    AdMob: {
      appId: 'ca-app-pub-4768026665961339~9319477813',
      androidAppId: 'ca-app-pub-4768026665961339~9319477813',
      iosAppId: 'ca-app-pub-4768026665961339~6286120368'
    },
    ScreenOrientation: {
      orientation: 'portrait'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
