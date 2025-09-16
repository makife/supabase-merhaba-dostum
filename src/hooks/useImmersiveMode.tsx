import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { NavigationBar } from '@ethion/capacitor-navigation-bar';
import { App } from '@capacitor/app';

export const useImmersiveMode = () => {
  useEffect(() => {
    let autoHideInterval: ReturnType<typeof setInterval> | undefined;
    let appListener: { remove: () => void } | undefined;
    let overlayApplied = false;
    const hideSystemUI = async () => {
      if (!Capacitor.isNativePlatform()) return;
      try {
        // Hide status bar (overlay is applied only once to avoid re-layout on Android)
        if (!overlayApplied) {
          try { await StatusBar.setOverlaysWebView({ overlay: true }); } catch {}
          overlayApplied = true;
        }
        await StatusBar.hide();
        if (Capacitor.getPlatform() === 'android') {
          try {
            await StatusBar.setStyle({ style: Style.Dark });
          } catch {}

          try {
            await NavigationBar.hide();
          } catch (e) {
            console.warn('⚠️ NavigationBar hide failed:', e);
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not hide system UI:', error);
      }
    };

    const startAutoHide = () => {
      if (autoHideInterval) clearInterval(autoHideInterval);
      // Disabled periodic auto-hide to avoid Android WebView white-screen bug
      autoHideInterval = undefined;
    };

    const handleUserInteraction = () => {
      hideSystemUI();
      startAutoHide();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        hideSystemUI();
        startAutoHide();
      }
    };

    const handleFocus = () => {
      hideSystemUI();
      startAutoHide();
    };

    const setupImmersiveMode = async () => {
      // Only work on native mobile platforms
      if (!Capacitor.isNativePlatform()) return;

      await hideSystemUI();
      startAutoHide();

      // Interaction listeners to force-hide bars again
      document.addEventListener('touchstart', handleUserInteraction, { passive: true });
      document.addEventListener('click', handleUserInteraction, { passive: true });
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('resize', handleUserInteraction);
      window.addEventListener('scroll', handleUserInteraction, { passive: true });

      // App lifecycle (resume)
      try {
        appListener = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            hideSystemUI();
            startAutoHide();
          }
        });
      } catch (e) {
        console.warn('⚠️ App plugin not available:', e);
      }
    };

    setupImmersiveMode();

    // Cleanup function
    return () => {
      if (autoHideInterval) clearInterval(autoHideInterval);

      if (Capacitor.isNativePlatform()) {
        StatusBar.show().catch((error) => {
          console.warn('⚠️ Could not show status bar:', error);
        });
        if (Capacitor.getPlatform() === 'android') {
          try {
            NavigationBar.show();
          } catch {}
        }
      }

      // Remove event listeners
      document.removeEventListener('touchstart', handleUserInteraction as any);
      document.removeEventListener('click', handleUserInteraction as any);
      window.removeEventListener('focus', handleFocus as any);
      document.removeEventListener('visibilitychange', handleVisibilityChange as any);
      window.removeEventListener('resize', handleUserInteraction as any);
      window.removeEventListener('scroll', handleUserInteraction as any);
      appListener?.remove?.();
    };
  }, []);
};