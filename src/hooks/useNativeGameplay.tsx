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

  // Prevent context menu and text selection globally
  useEffect(() => {
    const preventContextMenu = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const preventTextSelection = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const preventCopyPaste = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // Disable context menu on all platforms
    document.addEventListener('contextmenu', preventContextMenu);
    
    // Disable text selection on long press
    document.addEventListener('selectstart', preventTextSelection);
    document.addEventListener('dragstart', preventTextSelection);
    
    // Disable copy/paste menu
    document.addEventListener('copy', preventCopyPaste);
    document.addEventListener('cut', preventCopyPaste);

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('selectstart', preventTextSelection);
      document.removeEventListener('dragstart', preventTextSelection);
      document.removeEventListener('copy', preventCopyPaste);
      document.removeEventListener('cut', preventCopyPaste);
    };
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
      
      // Disable pull-to-refresh behavior
      document.body.style.overscrollBehavior = 'none';
      
      return () => {
        document.body.classList.remove('native-platform');
        document.body.style.overscrollBehavior = '';
      };
    }
  }, []);

  return {
    triggerHapticFeedback,
    optimizeTouchEvent,
    isNative: Capacitor.isNativePlatform()
  };
};