import { useEffect } from 'react';
import { ScreenOrientation, OrientationLockType } from '@capacitor/screen-orientation';
import { Capacitor } from '@capacitor/core';

export const useScreenOrientation = () => {
  useEffect(() => {
    const lockToPortrait = async () => {
      // Only lock orientation on native mobile platforms
      if (Capacitor.isNativePlatform()) {
        try {
          await ScreenOrientation.lock({ orientation: 'portrait' });
          console.log('📱 Screen orientation locked to portrait');
        } catch (error) {
          console.warn('⚠️ Could not lock screen orientation:', error);
        }
      }
    };

    lockToPortrait();

    // Cleanup function - unlock orientation when component unmounts
    return () => {
      if (Capacitor.isNativePlatform()) {
        ScreenOrientation.unlock().catch((error) => {
          console.warn('⚠️ Could not unlock screen orientation:', error);
        });
      }
    };
  }, []);
};