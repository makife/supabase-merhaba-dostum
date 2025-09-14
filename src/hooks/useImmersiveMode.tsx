import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export const useImmersiveMode = () => {
  useEffect(() => {
    const setupImmersiveMode = async () => {
      // Only work on native mobile platforms
      if (Capacitor.isNativePlatform()) {
        try {
          // Hide the status bar
          await StatusBar.hide();
          
          // For Android, enable immersive mode to hide navigation bar
          if (Capacitor.getPlatform() === 'android') {
            // Enable immersive mode by overlaying web view
            await StatusBar.setOverlaysWebView({ overlay: true });
            
            // Set style to be transparent
            await StatusBar.setStyle({ style: Style.Dark });
            await StatusBar.setBackgroundColor({ color: '#00000000' });
            
            console.log('📱 Immersive mode enabled for Android');
          } else if (Capacitor.getPlatform() === 'ios') {
            // For iOS, just hide status bar and use safe area
            await StatusBar.setOverlaysWebView({ overlay: true });
            console.log('📱 Status bar overlay enabled for iOS');
          }
          
        } catch (error) {
          console.warn('⚠️ Could not enable immersive mode:', error);
        }
      }
    };

    setupImmersiveMode();

    // Cleanup function
    return () => {
      if (Capacitor.isNativePlatform()) {
        StatusBar.show().catch((error) => {
          console.warn('⚠️ Could not show status bar:', error);
        });
      }
    };
  }, []);
};