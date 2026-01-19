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

export const useAvatarUpload = () => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 0.3,          // 300KB max
      maxWidthOrHeight: 800,    // 800px max
      useWebWorker: true,
      fileType: 'image/webp'    // WebP formatına çevir
    };

    try {
      const compressedFile = await imageCompression(file, options);
      toast.success(`Resim optimize edildi: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024).toFixed(0)}KB`);
      return compressedFile;
    } catch (error) {
      console.error('Error compressing image:', error);
      // Compression başarısız olursa orijinal dosyayı döndür
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
      // Resmi compress et
      const compressedFile = await compressImage(file);

      // Create a unique filename with webp extension
      const fileName = `${user.id}/${Date.now()}.webp`;

      // Delete existing avatar if any
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
      const { data: uploadData, error: uploadError } = await supabase.storage
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

      // Update profile with avatar URL
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
      // Delete from storage
      const { data: existingFiles } = await supabase.storage
        .from('avatars')
        .list(user.id);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(f => `${user.id}/${f.name}`);
        await supabase.storage
          .from('avatars')
          .remove(filesToDelete);
      }

      // Update profile to remove avatar URL
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
    
    // 🛡️ 1. Foreground Service başlat - OS'un WebView'ı öldürmesini engelle
    await startForegroundServiceStandalone();
    
    // 🛡️ 2. Kamera koruma flag'ini aktifle
    setCameraActive(true);
    
    // 🔥 3. Pending action'ı kaydet - app ölürse geri geldiğinde kontrol edilecek
    await setPendingAction({
      type: 'camera',
      startedAt: Date.now(),
      context: 'avatar-upload',
    });
    
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 90,
      });

      if (!photo.dataUrl) {
        throw new Error('Fotoğraf alınamadı');
      }

      // DataUrl'i blob'a çevir
      const response = await fetch(photo.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });

      // uploadAvatar içinde zaten compress ediliyor
      const result = await uploadAvatar(file);
      
      // ✅ Başarılı - pending action'ı temizle
      await clearPendingAction();
      
      return result;
    } catch (error: any) {
      if (error.message !== 'User cancelled photos app') {
        console.error('Error taking photo:', error);
        toast.error('Fotoğraf çekilirken hata oluştu');
      } else {
        // User cancelled - pending action'ı temizle
        await clearPendingAction();
      }
      return null;
    } finally {
      // 🛡️ Foreground Service'i durdur
      await stopForegroundServiceStandalone();
      
      // Kısa gecikme ile korumayı kapat (uygulama geri dönmesini bekle)
      setTimeout(() => setCameraActive(false), 2000);
      setUploading(false);
    }
  };

  const uploadFromGallery = async (): Promise<string | null> => {
    if (!user) {
      toast.error('Giriş yapmanız gerekiyor');
      return null;
    }

    setUploading(true);
    
    // 🛡️ 1. Foreground Service başlat - OS'un WebView'ı öldürmesini engelle
    await startForegroundServiceStandalone();
    
    // 🛡️ 2. Galeri koruma flag'ini aktifle
    setCameraActive(true);
    
    // 🔥 3. Pending action'ı kaydet - app ölürse geri geldiğinde kontrol edilecek
    await setPendingAction({
      type: 'gallery',
      startedAt: Date.now(),
      context: 'avatar-upload',
    });
    
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        quality: 90,
      });

      if (!photo.dataUrl) {
        throw new Error('Fotoğraf seçilemedi');
      }

      // DataUrl'i blob'a çevir
      const response = await fetch(photo.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'gallery-photo.jpg', { type: 'image/jpeg' });

      // uploadAvatar içinde zaten compress ediliyor
      const result = await uploadAvatar(file);
      
      // ✅ Başarılı - pending action'ı temizle
      await clearPendingAction();
      
      return result;
    } catch (error: any) {
      if (error.message !== 'User cancelled photos app') {
        console.error('Error selecting photo:', error);
        toast.error('Fotoğraf seçilirken hata oluştu');
      } else {
        // User cancelled - pending action'ı temizle
        await clearPendingAction();
      }
      return null;
    } finally {
      // 🛡️ Foreground Service'i durdur
      await stopForegroundServiceStandalone();
      
      // Kısa gecikme ile korumayı kapat
      setTimeout(() => setCameraActive(false), 2000);
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
      // Update profile with game avatar path directly
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
