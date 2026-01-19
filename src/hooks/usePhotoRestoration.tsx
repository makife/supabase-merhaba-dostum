/**
 * 🔄 Photo Restoration Hook
 * 
 * App yeniden başladığında yarım kalan fotoğraf işlemini kontrol eder.
 * NOT: Base64 kaydetmiyoruz artık (crash yapıyordu), sadece kullanıcıya bilgi veriyoruz.
 */
import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getPendingPhotoMeta, clearPendingPhoto } from '@/utils/pendingPhotoState';
import { clearPendingAction } from '@/utils/pendingActionState';

export const usePhotoRestoration = () => {
  const { user } = useAuth();
  const hasCheckedRef = useRef(false);
  const previousUserRef = useRef<string | null>(null);

  const checkAndNotifyPendingPhoto = async () => {
    if (!user || hasCheckedRef.current) return;
    if (previousUserRef.current === user.id) return;
    
    previousUserRef.current = user.id;
    hasCheckedRef.current = true;

    try {
      const meta = await getPendingPhotoMeta();
      
      if (meta) {
        console.log("[PhotoRestoration] 📷 Yarım kalan fotoğraf işlemi bulundu:", meta);
        
        // Kullanıcıya bilgi ver
        const sourceText = meta.source === 'camera' ? 'Kamera' : 'Galeri';
        toast.info(`${sourceText} işlemi yarım kaldı. Lütfen tekrar deneyin.`, {
          duration: 4000,
        });
        
        // Temizle
        await clearPendingPhoto();
        await clearPendingAction();
      }
    } catch (error) {
      console.error("[PhotoRestoration] Error:", error);
    }
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    // Kısa gecikme ile kontrol et (auth hazır olsun)
    const timer = setTimeout(() => {
      checkAndNotifyPendingPhoto();
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [user]);
  
  return { checkAndRestorePhoto: checkAndNotifyPendingPhoto };
};
