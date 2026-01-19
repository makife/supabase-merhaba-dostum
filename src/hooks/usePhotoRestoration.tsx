/**
 * 📸 Photo Restoration Hook
 * 
 * App yeniden başladığında pending photo varsa otomatik yükler.
 */
import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { getPendingPhoto, clearPendingPhoto } from '@/utils/pendingPhotoState';
import { clearPendingAction } from '@/utils/pendingActionState';
import { showPhotoOverlay, hidePhotoOverlay } from '@/components/PhotoUploadOverlay';

export const usePhotoRestoration = () => {
  const { user } = useAuth();
  const hasCheckedRef = useRef(false);
  const isProcessingRef = useRef(false);

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 0.3,
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: 'image/webp'
    };

    try {
      return await imageCompression(file, options);
    } catch {
      return file;
    }
  };

  const uploadRestoredPhoto = useCallback(async (dataUrl: string): Promise<boolean> => {
    if (!user) {
      console.log('[PhotoRestore] ❌ User yok, yükleme yapılamaz');
      return false;
    }

    try {
      // Overlay göster
      showPhotoOverlay('optimizing');

      // DataUrl'i blob'a çevir
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'restored-photo.jpg', { type: 'image/jpeg' });

      // Compress
      const compressedFile = await compressImage(file);

      showPhotoOverlay('uploading');

      // Create unique filename
      const fileName = `${user.id}/${Date.now()}.webp`;

      // Delete existing avatars
      const { data: existingFiles } = await supabase.storage
        .from('avatars')
        .list(user.id);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(f => `${user.id}/${f.name}`);
        await supabase.storage
          .from('avatars')
          .remove(filesToDelete);
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      showPhotoOverlay('complete');
      
      setTimeout(() => {
        hidePhotoOverlay();
        toast.success('Fotoğrafınız başarıyla yüklendi!');
      }, 1000);

      return true;
    } catch (error) {
      console.error('[PhotoRestore] ❌ Yükleme hatası:', error);
      hidePhotoOverlay();
      toast.error('Fotoğraf yüklenirken hata oluştu');
      return false;
    }
  }, [user]);

  const checkAndRestorePhoto = useCallback(async () => {
    if (isProcessingRef.current) return;
    if (!user) return;

    isProcessingRef.current = true;

    try {
      console.log('[PhotoRestore] 🔍 Pending photo kontrolü...');
      
      const pendingPhoto = await getPendingPhoto();
      
      if (!pendingPhoto) {
        console.log('[PhotoRestore] ✅ Pending photo yok');
        return;
      }

      console.log('[PhotoRestore] 📸 Pending photo bulundu:', pendingPhoto.meta);
      
      // Fotoğrafı yükle
      const success = await uploadRestoredPhoto(pendingPhoto.dataUrl);
      
      if (success) {
        console.log('[PhotoRestore] ✅ Fotoğraf başarıyla yüklendi');
      }
      
      // Her durumda temizle
      await clearPendingPhoto();
      await clearPendingAction();
      
    } catch (error) {
      console.error('[PhotoRestore] ❌ Hata:', error);
      hidePhotoOverlay();
    } finally {
      isProcessingRef.current = false;
    }
  }, [user, uploadRestoredPhoto]);

  // App başladığında kontrol et
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!user) return;
    if (hasCheckedRef.current) return;
    
    hasCheckedRef.current = true;
    
    // Küçük bir gecikme ile kontrol et (auth tamamen hazır olsun)
    const timer = setTimeout(() => {
      checkAndRestorePhoto();
    }, 1000);

    return () => clearTimeout(timer);
  }, [user, checkAndRestorePhoto]);

  return { checkAndRestorePhoto };
};
