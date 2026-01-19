import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Camera } from '@capacitor/camera';
import { CameraResultType, CameraSource } from '@capacitor/camera';
import imageCompression from 'browser-image-compression';
import { setCameraActive } from '@/utils/cameraState';
import { 
  setPendingAction, 
  clearPendingAction,
} from '@/utils/pendingActionState';
import { 
  startForegroundServiceStandalone, 
  stopForegroundServiceStandalone 
} from '@/hooks/useForegroundService';
import { savePendingPhotoMeta, clearPendingPhoto } from '@/utils/pendingPhotoState';
import { showPhotoOverlay, hidePhotoOverlay } from '@/components/PhotoUploadOverlay';

export const useAvatarUpload = () => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 0.3,
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: 'image/webp'
    };

    try {
      const compressedFile = await imageCompression(file, options);
      console.log(`[Avatar] Compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB`);
      return compressedFile;
    } catch (error) {
      console.error('Error compressing image:', error);
      return file;
    }
  };

  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!user) {
      toast.error('Giriş yapmanız gerekiyor');
      return null;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Lütfen bir resim dosyası seçin');
      return null;
    }

    setUploading(true);
    try {
      const compressedFile = await compressImage(file);
      const fileName = `${user.id}/${Date.now()}.webp`;

      // Delete existing avatar if any
      const { data: existingFiles } = await supabase.storage
        .from('avatars')
        .list(user.id);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(f => `${user.id}/${f.name}`);
        await supabase.storage.from('avatars').remove(filesToDelete);
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

      toast.success('Avatar başarıyla güncellendi');
      return publicUrl;

    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Avatar yüklenirken hata oluştu');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteAvatar = async (): Promise<boolean> => {
    if (!user) return false;

    setUploading(true);
    try {
      const { data: existingFiles } = await supabase.storage
        .from('avatars')
        .list(user.id);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(f => `${user.id}/${f.name}`);
        await supabase.storage.from('avatars').remove(filesToDelete);
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast.success('Avatar silindi');
      return true;

    } catch (error) {
      console.error('Error deleting avatar:', error);
      toast.error('Avatar silinirken hata oluştu');
      return false;
    } finally {
      setUploading(false);
    }
  };

  const uploadFromCamera = async (): Promise<string | null> => {
    if (!user) {
      toast.error('Giriş yapmanız gerekiyor');
      return null;
    }

    setUploading(true);
    
    // 🛡️ Koruma mekanizmalarını başlat
    await startForegroundServiceStandalone();
    setCameraActive(true);
    
    await setPendingAction({
      type: 'camera',
      startedAt: Date.now(),
      context: 'avatar-upload',
    });
    
    // Meta kaydet (Base64 DEĞİL - crash yapıyor!)
    await savePendingPhotoMeta({
      capturedAt: Date.now(),
      source: 'camera',
      context: 'avatar-upload'
    });
    
    try {
      console.log("[Avatar] 📷 Kamera açılıyor...");
      
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 85,
      });

      if (!photo.dataUrl) {
        throw new Error('Fotoğraf alınamadı');
      }

      console.log("[Avatar] ✅ Fotoğraf çekildi, yükleniyor...");
      
      // 🎬 Overlay göster
      showPhotoOverlay('optimizing');

      // DataUrl'i blob'a çevir
      const response = await fetch(photo.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });

      showPhotoOverlay('uploading');
      
      const result = await uploadAvatar(file);
      
      // ✅ Başarılı - temizle
      await clearPendingAction();
      await clearPendingPhoto();
      
      showPhotoOverlay('complete');
      setTimeout(() => hidePhotoOverlay(), 1200);
      
      return result;
    } catch (error: any) {
      hidePhotoOverlay();
      
      const isCancelled = error.message?.includes('cancelled') || 
                          error.message?.includes('User cancelled');
      
      if (!isCancelled) {
        console.error('[Avatar] Camera error:', error);
        toast.error('Fotoğraf çekilirken hata oluştu');
      }
      
      // Temizle
      await clearPendingAction();
      await clearPendingPhoto();
      
      return null;
    } finally {
      await stopForegroundServiceStandalone();
      
      // Gecikmeyle korumayı kapat
      setTimeout(() => setCameraActive(false), 3000);
      setUploading(false);
    }
  };

  const uploadFromGallery = async (): Promise<string | null> => {
    if (!user) {
      toast.error('Giriş yapmanız gerekiyor');
      return null;
    }

    setUploading(true);
    
    // 🛡️ Koruma mekanizmalarını başlat
    await startForegroundServiceStandalone();
    setCameraActive(true);
    
    await setPendingAction({
      type: 'gallery',
      startedAt: Date.now(),
      context: 'avatar-upload',
    });
    
    await savePendingPhotoMeta({
      capturedAt: Date.now(),
      source: 'gallery',
      context: 'avatar-upload'
    });
    
    try {
      console.log("[Avatar] 🖼️ Galeri açılıyor...");
      
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        quality: 85,
      });

      if (!photo.dataUrl) {
        throw new Error('Fotoğraf seçilemedi');
      }

      console.log("[Avatar] ✅ Fotoğraf seçildi, yükleniyor...");
      
      showPhotoOverlay('optimizing');

      const response = await fetch(photo.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'gallery-photo.jpg', { type: 'image/jpeg' });

      showPhotoOverlay('uploading');
      
      const result = await uploadAvatar(file);
      
      await clearPendingAction();
      await clearPendingPhoto();
      
      showPhotoOverlay('complete');
      setTimeout(() => hidePhotoOverlay(), 1200);
      
      return result;
    } catch (error: any) {
      hidePhotoOverlay();
      
      const isCancelled = error.message?.includes('cancelled') || 
                          error.message?.includes('User cancelled');
      
      if (!isCancelled) {
        console.error('[Avatar] Gallery error:', error);
        toast.error('Fotoğraf seçilirken hata oluştu');
      }
      
      await clearPendingAction();
      await clearPendingPhoto();
      
      return null;
    } finally {
      await stopForegroundServiceStandalone();
      setTimeout(() => setCameraActive(false), 3000);
      setUploading(false);
    }
  };

  const uploadGameAvatar = async (avatarPath: string): Promise<string | null> => {
    if (!user) {
      toast.error('Giriş yapmanız gerekiyor');
      return null;
    }

    setUploading(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarPath })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast.success('Avatar başarıyla güncellendi');
      return avatarPath;
    } catch (error) {
      console.error('Error updating avatar:', error);
      toast.error('Avatar güncellenirken hata oluştu');
      return null;
    } finally {
      setUploading(false);
    }
  };

  return {
    uploadAvatar,
    deleteAvatar,
    uploadFromCamera,
    uploadFromGallery,
    uploadGameAvatar,
    uploading
  };
};
