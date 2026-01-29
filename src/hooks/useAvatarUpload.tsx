import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import imageCompression from "browser-image-compression";

export const useAvatarUpload = () => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  // 1. Yardımcı Fonksiyon: Resim Sıkıştırma
  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 0.3,
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: "image/webp",
    };

    try {
      const compressedFile = await imageCompression(file, options);
      console.log(
        `[Avatar] Compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB`,
      );
      return compressedFile;
    } catch (error) {
      console.error("Error compressing image:", error);
      return file;
    }
  };

  // 2. Ana Yükleme Fonksiyonu (Artık Public - Dışarıdan çağrılabilir)
  // Bu fonksiyon sadece ELİNDEKİ DOSYAYI yükler. Fotoğraf çekmez.
  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!user) {
      toast.error("Giriş yapmanız gerekiyor");
      return null;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen bir resim dosyası seçin");
      return null;
    }

    setUploading(true);
    try {
      const compressedFile = await compressImage(file);
      const fileName = `${user.id}/${Date.now()}.webp`;

      // Varsa eski avatarı sil
      const { data: existingFiles } = await supabase.storage.from("avatars").list(user.id);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map((f) => `${user.id}/${f.name}`);
        await supabase.storage.from("avatars").remove(filesToDelete);
      }

      // Yeni avatarı yükle
      const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, compressedFile, {
        cacheControl: "3600",
        upsert: true,
      });

      if (uploadError) throw uploadError;

      // Public URL al
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      // Profili güncelle
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      // toast.success('Avatar güncellendi'); // Bunu component'e bırakabiliriz veya burada kalabilir
      return publicUrl;
    } catch (error) {
      console.error("Error uploading avatar:", error);
      // toast.error('Avatar yüklenirken hata oluştu'); // Hata yönetimini de component'e bırakmak daha esnek olabilir
      throw error; // Hatayı fırlat ki ProfilePage yakalasın
    } finally {
      setUploading(false);
    }
  };

  // 3. Avatar SİLME Fonksiyonu
  const deleteAvatar = async (): Promise<boolean> => {
    if (!user) return false;

    setUploading(true);
    try {
      const { data: existingFiles } = await supabase.storage.from("avatars").list(user.id);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map((f) => `${user.id}/${f.name}`);
        await supabase.storage.from("avatars").remove(filesToDelete);
      }

      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);

      if (updateError) throw updateError;

      toast.success("Avatar silindi");
      return true;
    } catch (error) {
      console.error("Error deleting avatar:", error);
      toast.error("Avatar silinirken hata oluştu");
      return false;
    } finally {
      setUploading(false);
    }
  };

  // 4. Sadece Fotoğraf ÇEKME (Yüklemeden) - KAMERA
  const captureFromCamera = async (): Promise<{ file: File; webPath: string } | null> => {
    try {
      console.log("[Avatar] 📷 Kamera açılıyor...");

      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri, // Dosya yolu alıyoruz
        source: CameraSource.Camera,
        quality: 85,
        allowEditing: true,
      });

      if (!photo.webPath) {
        throw new Error("Fotoğraf yolu alınamadı");
      }

      console.log("[Avatar] ✅ Fotoğraf çekildi");

      // Dosyayı oluştur
      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" });

      // Hem dosyayı hem de YOLUNU dönüyoruz
      return { file, webPath: photo.webPath };
    } catch (error: any) {
      // Hata yönetimi aynen kalsın...
      return null;
    }
  };

  // 5. Sadece Fotoğraf SEÇME (Yüklemeden) - GALERİ
  const captureFromGallery = async (): Promise<{ file: File; webPath: string } | null> => {
    try {
      console.log("[Avatar] 🖼️ Galeri açılıyor...");

      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri, // ÖNEMLİ: DataUrl değil Uri (Dosya Yolu) kullanıyoruz
        source: CameraSource.Photos,
        quality: 85,
      });

      if (!photo.webPath) {
        throw new Error("Fotoğraf seçilemedi");
      }

      console.log("[Avatar] ✅ Fotoğraf seçildi, işleniyor...");

      // WebPath'i Blob/File'a çevir (Anlık kullanım için)
      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      const file = new File([blob], "gallery-photo.jpg", { type: "image/jpeg" });

      // Hem dosyayı hem de YOLUNU dönüyoruz
      return { file, webPath: photo.webPath };
    } catch (error: any) {
      const isCancelled = error.message?.includes("cancelled") || error.message?.includes("User cancelled");

      if (!isCancelled) {
        console.error("[Avatar] Gallery error:", error);
        toast.error("Fotoğraf seçilirken hata oluştu");
      }
      return null;
    }
  };

  // Oyun içi hazır avatar seçimi (Bu hemen yükleyebilir, çünkü uygulama kapanmıyor)
  const uploadGameAvatar = async (avatarPath: string): Promise<string | null> => {
    if (!user) {
      toast.error("Giriş yapmanız gerekiyor");
      return null;
    }

    setUploading(true);
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarPath })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast.success("Avatar başarıyla güncellendi");
      return avatarPath;
    } catch (error) {
      console.error("Error updating avatar:", error);
      toast.error("Avatar güncellenirken hata oluştu");
      return null;
    } finally {
      setUploading(false);
    }
  };

  return {
    uploadAvatar, // Manuel yükleme için dışarı açtık
    deleteAvatar,
    captureFromCamera, // İsmini değiştirdik: Sadece çeker
    captureFromGallery, // İsmini değiştirdik: Sadece seçer
    uploadGameAvatar,
    uploading,
  };
};
