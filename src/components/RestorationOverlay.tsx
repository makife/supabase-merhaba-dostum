import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { subscribeToRestoration, getRestorationState } from '@/hooks/useAppRestoration';

/**
 * 🔄 Restoration Overlay
 * 
 * Full-screen overlay that shows when the app is restoring state
 * (e.g., after being killed while in Camera/Payment flow)
 * 
 * This overlay has the HIGHEST z-index to ensure it shows
 * BEFORE any login screen or main menu.
 */
const RestorationOverlay: React.FC = () => {
  const [state, setState] = useState(getRestorationState());

  useEffect(() => {
    const unsubscribe = subscribeToRestoration(setState);
    return () => { unsubscribe(); };
  }, []);

  if (!state.isRestoring) return null;

  return (
    <div 
      className="fixed inset-0 flex flex-col items-center justify-center bg-black z-[99999]"
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
      }}
    >
      {/* Logo or App Icon */}
      <div className="mb-8">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-2xl">
          <span className="text-4xl font-bold text-white">K</span>
        </div>
      </div>

      {/* Spinner */}
      <Loader2 className="w-12 h-12 text-primary animate-spin mb-6" />

      {/* Message */}
      <p className="text-white text-lg font-medium mb-4">
        {state.restorationMessage || 'Yükleniyor...'}
      </p>

      {/* Progress Bar */}
      {state.restorationProgress > 0 && (
        <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
            style={{ width: `${state.restorationProgress}%` }}
          />
        </div>
      )}

      {/* Subtle hint */}
      <p className="text-white/50 text-sm mt-8">
        Lütfen bekleyin...
      </p>
    </div>
  );
};

export default RestorationOverlay;
