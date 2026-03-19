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

// 🔥 iOS/Android: Uygulama ilk açılırken, React render'dan ÖNCE bildirim izni iste
// Android'de zaten böyle çalışıyor — iOS'ta da aynı davranış
async function requestEarlyPushPermission() {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const status = await PushNotifications.checkPermissions();
    
    // Sadece henüz sorulmamışsa (prompt) sor — zaten granted/denied ise tekrar sorma
    if (status.receive === 'prompt') {
      console.log('📱 [EarlyPush] İlk açılış — bildirim izni isteniyor...');
      const result = await PushNotifications.requestPermissions();
      console.log('📱 [EarlyPush] İzin sonucu:', result.receive);
      
      if (result.receive === 'granted') {
        // Listener'ları ekle, sonra register
        await PushNotifications.addListener('registration', (token) => {
          console.log('✅ [EarlyPush] Token alındı:', token.value?.substring(0, 30) + '...');
          // Token'ı localStorage'a kaydet — user login olduğunda DB'ye yazılacak
          try {
            localStorage.setItem('push_token_early', token.value);
          } catch {}
        });
        await PushNotifications.addListener('registrationError', (err) => {
          console.error('❌ [EarlyPush] Registration error:', err.error);
        });
        await PushNotifications.register();
      }
    }
  } catch (error) {
    console.log('📱 [EarlyPush] Plugin kullanılamıyor:', error);
  }
}

// İzni iste (async, render'ı bloklamaz ama hemen çalışır)
requestEarlyPushPermission();

// App'i başlat
createRoot(document.getElementById("root")!).render(<App />);
