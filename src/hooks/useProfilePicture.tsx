import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useProfilePicture = () => {
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  const uploadProfilePicture = async (file: File) => {
    if (!user) {
      toast.error('Oturum açmanız gerekiyor');
      return null;
    }

    try {
      setUploading(true);

      // Dosya boyut kontrolü (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Dosya boyutu 5MB\'dan küçük olmalıdır');
        return null;
      }

      // Dosya türü kontrolü
      if (!file.type.startsWith('image/')) {
        toast.error('Sadece resim dosyaları yüklenebilir');
        return null;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Mevcut resmi sil
      await supabase.storage
        .from('avatars')
        .remove([fileName]);

      // Yeni resmi yükle
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Public URL al
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Profil tablosunu güncelle
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      toast.success('Profil resmi başarıyla güncellendi');
      return urlData.publicUrl;

    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Profil resmi yüklenirken hata oluştu: ' + error.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploadProfilePicture, uploading };
};