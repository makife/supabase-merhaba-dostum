import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { NavigationBar } from '@ethion/capacitor-navigation-bar';

export const useImmersiveMode = () => {
  useEffect(() => {
    let autoHideTimeout: NodeJS.Timeout;
    
    const setupImmersiveMode = async () => {
      // Only work on native mobile platforms
      if (Capacitor.isNativePlatform()) {
        try {
          // Hide the status bar
          await StatusBar.hide();
          
          // For Android, enable immersive mode to hide navigation bar
          if (Capacitor.getPlatform() === 'android') {
            // Enable immersive mode: hide status and navigation bars
            await StatusBar.setOverlaysWebView({ overlay: true });
            await StatusBar.setStyle({ style: Style.Dark });
            await StatusBar.setBackgroundColor({ color: '#00000000' });

            try {
              await NavigationBar.setTransparency({ isTransparent: true });
              await NavigationBar.hide();
              console.log('📱 Immersive mode enabled for Android (nav bar hidden)');
              
              // Setup auto-hide functionality
              const autoHideNavigation = async () => {
                try {
                  await NavigationBar.hide();
                } catch (e) {
                  console.warn('⚠️ Auto-hide navigation failed:', e);
                }
              };

              // Auto-hide navigation bar every 3 seconds
              const setupAutoHide = () => {
                autoHideTimeout = setInterval(autoHideNavigation, 3000);
              };

              setupAutoHide();
              
              // Re-hide navigation on any touch/interaction
              const handleUserInteraction = () => {
                autoHideNavigation();
              };

              document.addEventListener('touchstart', handleUserInteraction, { passive: true });
              document.addEventListener('click', handleUserInteraction, { passive: true });
              
            } catch (e) {
              console.warn('⚠️ NavigationBar plugin not available or failed:', e);
            }
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
      if (autoHideTimeout) {
        clearInterval(autoHideTimeout);
      }
      
      if (Capacitor.isNativePlatform()) {
        StatusBar.show().catch((error) => {
          console.warn('⚠️ Could not show status bar:', error);
        });
        if (Capacitor.getPlatform() === 'android') {
          // Try to restore navigation bar
          import('@ethion/capacitor-navigation-bar').then(({ NavigationBar }) => {
            NavigationBar.show().catch(() => {});
          }).catch(() => {});
        }
        
        // Remove event listeners
        document.removeEventListener('touchstart', () => {});
        document.removeEventListener('click', () => {});
      }
    };
  }, []);
};