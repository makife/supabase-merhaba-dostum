/**
 * 🌐 Global Photo Upload Overlay
 * 
 * App genelinde fotoğraf yükleme durumunu gösterir.
 * PhotoUploadOverlay'in global state'ini dinler.
 */
import { useState, useEffect } from 'react';
import { PhotoUploadOverlay, subscribeToPhotoOverlay, getPhotoOverlayState } from './PhotoUploadOverlay';

export function GlobalPhotoOverlay() {
  const [state, setState] = useState(getPhotoOverlayState());

  useEffect(() => {
    // Initial state
    setState(getPhotoOverlayState());
    
    // Subscribe to changes
    const unsubscribe = subscribeToPhotoOverlay((newState) => {
      setState({ ...newState });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <PhotoUploadOverlay 
      isVisible={state.isVisible} 
      stage={state.stage} 
    />
  );
}
