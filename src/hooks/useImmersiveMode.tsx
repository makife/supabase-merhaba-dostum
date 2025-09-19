import { useEffect, useRef } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { NavigationBar } from '@ethion/capacitor-navigation-bar';

export const useImmersiveMode = () => {
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Sadece native platformda çalış
    if (!Capacitor.isNativePlatform()) return;

    const hideSystemUI = async () => {
      try {
        await StatusBar.hide();
        if (Capacitor.getPlatform() === 'android') {
          await NavigationBar.hide();
        }
        console.log('System UI gizlendi');
      } catch (error) {
        console.warn('System UI gizlenemedi:', error);
      }
    };

    const showSystemUI = async () => {
      try {
        await StatusBar.show();
        if (Capacitor.getPlatform() === 'android') {
          await NavigationBar.show();
        }
        console.log('System UI gösterildi');
      } catch (error) {
        console.warn('System UI gösterilemedi:', error);
      }
    };

    const scheduleHide = () => {
      // Mevcut timer'ı temizle
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      
      // 3 saniye sonra gizle
      hideTimerRef.current = setTimeout(() => {
        hideSystemUI();
      }, 3000);
    };

    const handleTouch = (event: TouchEvent) => {
      const touch = event.touches[0];
      const windowHeight = window.innerHeight;
      
      // Üst kenardan aşağı kaydırma (status bar için)
      if (touch.clientY < 50) {
        showSystemUI();
        scheduleHide();
        return;
      }
      
      // Alt kenardan yukarı kaydırma (navigation bar için)  
      if (touch.clientY > windowHeight - 50) {
        showSystemUI();
        scheduleHide();
        return;
      }
    };

    const setupImmersiveMode = async () => {
      // Başlangıçta overlay ayarla
      try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#00000080' }); // Füme efekt
      } catch (error) {
        console.warn('Status bar overlay ayarlanamadı:', error);
      }

      // Başlangıçta gizle
      await hideSystemUI();

      // Touch listener ekle
      document.addEventListener('touchstart', handleTouch, { passive: true });
    };

    setupImmersiveMode();

    // Cleanup
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      
      document.removeEventListener('touchstart', handleTouch);
      
      // Çıkarken sistem UI'ını göster
      showSystemUI();
    };
  }, []);
};

export default useImmersiveMode;