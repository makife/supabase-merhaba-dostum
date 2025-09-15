import { useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';

export const useNativeGameplay = () => {
  const { toast } = useToast();

  // Native haptic feedback
  const triggerHapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (Capacitor.isNativePlatform()) {
      try {
        // For Capacitor apps, use vibration pattern
        const patterns = {
          light: [50],
          medium: [100],
          heavy: [200]
        };
        
        if ('vibrate' in navigator) {
          navigator.vibrate(patterns[type]);
        }
      } catch (error) {
        console.warn('Haptic feedback not available:', error);
      }
    }
  }, []);

  // Prevent context menu and text selection on mobile
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const preventContextMenu = (e: Event) => {
        e.preventDefault();
        return false;
      };

      const preventTextSelection = (e: Event) => {
        e.preventDefault();
        return false;
      };

      // Disable context menu
      document.addEventListener('contextmenu', preventContextMenu);
      
      // Disable text selection
      document.addEventListener('selectstart', preventTextSelection);
      document.addEventListener('dragstart', preventTextSelection);

      return () => {
        document.removeEventListener('contextmenu', preventContextMenu);
        document.removeEventListener('selectstart', preventTextSelection);
        document.removeEventListener('dragstart', preventTextSelection);
      };
    }
  }, []);

  // Optimize touch events for native
  const optimizeTouchEvent = useCallback((callback: () => void) => {
    return (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      
      // Haptic feedback for touch
      if ('touches' in e) {
        triggerHapticFeedback('light');
      }
      
      callback();
    };
  }, [triggerHapticFeedback]);

  // Performance optimization for native
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Add native class to body for CSS optimizations
      document.body.classList.add('native-platform');
      
      // Disable pull-to-refresh and scrolling behaviors
      document.body.style.overscrollBehavior = 'none';
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      
      // Force hardware acceleration for better performance
      document.body.style.transform = 'translate3d(0, 0, 0)';
      document.body.style.webkitTransform = 'translate3d(0, 0, 0)';
      
      // Disable text selection globally
      document.body.style.webkitUserSelect = 'none';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.body.classList.remove('native-platform');
        document.body.style.overscrollBehavior = '';
        document.body.style.overflow = '';
        document.body.style.height = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.transform = '';
        document.body.style.webkitTransform = '';
        document.body.style.webkitUserSelect = '';
        document.body.style.userSelect = '';
      };
    }
  }, []);

  return {
    triggerHapticFeedback,
    optimizeTouchEvent,
    isNative: Capacitor.isNativePlatform()
  };
};