import React from 'react'
// 🔥 COLD START TIME - TÜM MODÜLLERDEN ÖNCE IMPORT ET!
import '@/utils/coldStartTime';

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { Capacitor } from '@capacitor/core'
import { checkResumeReload } from '@/hooks/useForceReloadOnResume';
import { installGlobalButtonSound } from '@/utils/globalButtonSound';

// 🔊 Tüm butonlara global tık sesi
installGlobalButtonSound();

// Add a class on native (iOS/Android) to control platform-specific styles
if (Capacitor.getPlatform() !== 'web') {
  document.documentElement.classList.add('is-native')
}

// Android immersive modda navigasyon çubuğu geçici açıldığında viewport küçülse
// bile uygulamanın yerleşim yüksekliğini ilk tam ekran ölçüsünde sabit tut.
if (Capacitor.getPlatform() === 'android') {
  document.documentElement.classList.add('is-android-native')
  const stableHeight = Math.max(window.innerHeight, window.screen.height)
  document.documentElement.style.setProperty('--android-stable-height', `${stableHeight}px`)
}

// 🔥 RESUME RELOAD KONTROLÜ
checkResumeReload();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element bulunamadı");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
