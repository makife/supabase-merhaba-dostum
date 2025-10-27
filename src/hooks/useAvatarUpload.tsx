import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Camera } from '@capacitor/camera';
import { CameraResultType, CameraSource } from '@capacitor/camera';

export const useAvatarUpload = () => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!user) {
      toast.error('Giriş yapmanız gerekiyor');
      return null;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Lütfen bir resim dosyası seçin');
      return null;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      toast.error('Dosya boyutu 5MB\'dan küçük olmalıdır');
      return null;
    }

    setUploading(true);
    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

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
        .upload(fileName, file, {
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

      return await uploadAvatar(file);
    } catch (error: any) {
      if (error.message !== 'User cancelled photos app') {
        console.error('Error taking photo:', error);
        toast.error('Fotoğraf çekilirken hata oluştu');
      }
      return null;
    } finally {
      setUploading(false);
    }
  };

  const uploadFromGallery = async (): Promise<string | null> => {
    if (!user) {
      toast.error('Giriş yapmanız gerekiyor');
      return null;
    }

    setUploading(true);
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

      return await uploadAvatar(file);
    } catch (error: any) {
      if (error.message !== 'User cancelled photos app') {
        console.error('Error selecting photo:', error);
        toast.error('Fotoğraf seçilirken hata oluştu');
      }
      return null;
    } finally {
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