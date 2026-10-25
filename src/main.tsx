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

  // Alt gesture/nav bar icin ayrilan guvenli alani BIR KEZ olcup sabitliyoruz.
  // Canli/surekli guncellenen bir olcum kullanmiyoruz; aksi halde nav bar her
  // acilip kapandiginda padding da zıplayip ayni esneme sorununu geri getirir.
  const measureSafeBottom = () => {
    const probe = document.createElement('div')
    probe.style.position = 'fixed'
    probe.style.bottom = '0'
    probe.style.height = '0'
    probe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)'
    probe.style.visibility = 'hidden'
    probe.style.pointerEvents = 'none'
    document.body.appendChild(probe)
    const value = parseFloat(getComputedStyle(probe).paddingBottom) || 0
    probe.remove()
    return value
  }

  const pinSafeBottom = () => {
    const value = measureSafeBottom()
    if (value > 0) {
      document.documentElement.style.setProperty('--android-stable-safe-bottom', `${value}px`)
    }
    return value
  }

  requestAnimationFrame(() => {
    if (pinSafeBottom() === 0) {
      // Ilk olcumde inset henuz uygulanmamis olabilir, bir kere daha dene.
      setTimeout(pinSafeBottom, 300)
    }
  })
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
