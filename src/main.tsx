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

// 🔥 RESUME RELOAD KONTROLÜ
checkResumeReload();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
