import { useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useToast } from '@/hooks/use-toast';

export const useNativeGameplay = () => {
  const { toast } = useToast();

  // Native haptic feedback
  const triggerHapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (Capacitor.isNativePlatform()) {
      const styles = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      };

      void Haptics.impact({ style: styles[type] }).catch((error) => {
        console.warn('Haptic feedback not available:', error);
      });
    }
  }, []);

  // Prevent context menu and text selection globally (but allow on inputs)
  useEffect(() => {
    const isInputElement = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || target.isContentEditable;
    };

    const preventContextMenu = (e: Event) => {
      if (isInputElement(e.target)) return; // Allow on inputs
      e.preventDefault();
      return false;
    };

    const preventTextSelection = (e: Event) => {
      if (isInputElement(e.target)) return; // Allow on inputs
      e.preventDefault();
      return false;
    };

    const preventCopyPaste = (e: Event) => {
      if (isInputElement(e.target)) return; // Allow on inputs
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('selectstart', preventTextSelection);
    document.addEventListener('dragstart', preventTextSelection);
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