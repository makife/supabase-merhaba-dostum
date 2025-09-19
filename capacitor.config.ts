import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.3b5b613276aa428688ad82b8da5a6692',
  appName: 'supabase-merhaba-dostum',
  webDir: 'dist',
  server: {
    url: 'https://3b5b6132-76aa-4286-88ad-82b8da5a6692.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#999999',
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1a1a',
      overlay: true,
      androidStatusBarColor: '#1a1a1a'
    },
    SafeArea: {
      enabled: false,
      customColorsForSystemBars: false,
      offset: false
    },
    Keyboard: {
      resize: 'ionic'
    },
    AdMob: {
      appId: 'ca-app-pub-4768026665961339~9319477813', // Android App ID
      androidAppId: 'ca-app-pub-4768026665961339~9319477813',
      iosAppId: 'ca-app-pub-4768026665961339~6286120368' // iOS App ID
    },
    ScreenOrientation: {
      orientation: 'portrait'
    }
  }
};

export default config;