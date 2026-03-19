import React from 'react'
// 🔥 COLD START TIME - TÜM MODÜLLERDEN ÖNCE IMPORT ET!
import '@/utils/coldStartTime';

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { Capacitor } from '@capacitor/core'
import { checkResumeReload } from '@/hooks/useForceReloadOnResume';

// Add a class on native (iOS/Android) to control platform-specific styles
if (Capacitor.getPlatform() !== 'web') {
  document.documentElement.classList.add('is-native')
}

// 🔥 RESUME RELOAD KONTROLÜ
checkResumeReload();

// 🔥 iOS/Android: Uygulama ilk açılırken bildirim izni iste
// Token yönetimi TAMAMEN useMobileNotifications'a bırakılıyor
// Burada SADECE izin istenir, listener eklenmez (çift listener race condition önlenir)
async function requestEarlyPushPermission() {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const status = await PushNotifications.checkPermissions();
    
    if (status.receive === 'prompt') {
      console.log('📱 [EarlyPush] İlk açılış — bildirim izni isteniyor...');
      const result = await PushNotifications.requestPermissions();
      console.log('📱 [EarlyPush] İzin sonucu:', result.receive);
      // Token kaydı useMobileNotifications hook'unda yapılacak
    }
  } catch (error) {
    console.log('📱 [EarlyPush] Plugin kullanılamıyor:', error);
  }
}

requestEarlyPushPermission();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
