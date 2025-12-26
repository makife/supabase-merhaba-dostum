import { useEffect, useRef, useCallback } from 'react';
import { supabase, checkAndReconnect } from '@/integrations/supabase/client';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Supabase bağlantısını mobil uygulamada izler ve 
 * arka plan/ön plan geçişlerinde otomatik yeniden bağlanır
 */
export const useSupabaseConnection = () => {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const isNative = Capacitor.isNativePlatform();

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    // Her 30 saniyede bir bağlantı kontrolü
    heartbeatRef.current = setInterval(async () => {
      const isConnected = await checkAndReconnect();
      if (!isConnected) {
        console.log('💔 Supabase bağlantısı kayıp, yeniden deneniyor...');
      }
    }, 30000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  useEffect(() => {
    // İlk yüklemede bağlantı kontrolü
    checkAndReconnect();
    startHeartbeat();

    // Mobil uygulama için app state listener
    let appStateListener: any = null;

    if (isNative) {
      const setupAppStateListener = async () => {
        appStateListener = await App.addListener('appStateChange', async ({ isActive }) => {
          if (isActive) {
            console.log('📱 Uygulama aktif oldu, bağlantı kontrol ediliyor...');
            // Biraz bekle sonra kontrol et (OS'un network'ü açması için)
            setTimeout(async () => {
              await checkAndReconnect();
              startHeartbeat();
            }, 1000);
          } else {
            console.log('📱 Uygulama arka plana geçti');
            stopHeartbeat();
          }
        });
      };
      
      setupAppStateListener();
    }

    // Web için visibility change zaten client.ts'de var

    return () => {
      stopHeartbeat();
      if (appStateListener) {
        appStateListener.remove();
      }
    };
  }, [isNative, startHeartbeat, stopHeartbeat]);

  // Manuel yeniden bağlanma fonksiyonu
  const reconnect = useCallback(async () => {
    console.log('🔄 Manuel yeniden bağlanma başlatıldı...');
    
    // Tüm kanalları temizle
    const channels = supabase.getChannels();
    for (const channel of channels) {
      await supabase.removeChannel(channel);
    }
    
    // Bağlantı kontrolü
    const result = await checkAndReconnect();
    
    if (result) {
      console.log('✅ Yeniden bağlantı başarılı');
    } else {
      console.log('❌ Yeniden bağlantı başarısız');
    }
    
    return result;
  }, []);

  return { reconnect };
};
