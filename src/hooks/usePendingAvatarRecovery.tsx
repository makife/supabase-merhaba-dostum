/**
 * 🔥 PENDING AVATAR RECOVERY HOOK
 *
 * Bu hook, kamera/galeri açıldığında uygulama arka plana düştüğünde
 * çekilen resmin kaybolmasını önler.
 *
 * AKIŞ:
 * 1. Kamera açılmadan önce "pending_avatar_action" flag'i native storage'a kaydedilir
 * 2. Capacitor Camera plugin'i Base64 formatında resim döner
 * 3. Base64 resim optimize edilip native storage'a kaydedilir
 * 4. Uygulama ön plana geldiğinde (app-resumed, data-ready) bu kontrol edilir
 * 5. Bekleyen resim varsa Supabase'e yüklenir ve avatar olarak ayarlanır
 */

import { useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { nativeStorage } from "@/utils/nativeStorage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import { captureFromNativeCamera, pickFromNativeGallery, isAndroidNative } from "@/services/nativeCameraService";

// Storage keys
const PENDING_AVATAR_KEY = "pending_avatar_base64";
const PENDING_AVATAR_ACTION_KEY = "pending_avatar_action";
const PENDING_AVATAR_TIMESTAMP_KEY = "pending_avatar_timestamp";

// 24 saat sonra expire olsun (stale data temizliği)
const EXPIRATION_MS = 24 * 60 * 60 * 1000;

interface PendingAvatarData {
  base64: string;
  mimeType: string;
  timestamp: number;
}

export const usePendingAvatarRecovery = (onAvatarUploaded?: (url: string) => void) => {
  const { user } = useAuth();
  const { refreshProfile } = useUser();
  const isProcessingRef = useRef(false);
  const hasCheckedOnMountRef = useRef(false);

  // Base64 string'i File objesine çevir
  const base64ToFile = (base64: string, mimeType: string): File => {
    console.log(`[PendingAvatar] 🔄 Base64 to File converting... Length: ${base64.length}`);

    if (!base64 || base64.length < 100) {
      throw new Error(`Base64 verisi çok kısa veya boş: ${base64?.length || 0} karakter`);
    }

    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeType });
    const file = new File([blob], `avatar-${Date.now()}.jpg`, { type: mimeType });

    console.log(`[PendingAvatar] ✅ File oluşturuldu: ${(file.size / 1024).toFixed(0)}KB`);

    if (file.size < 1000) {
      throw new Error(`Dosya çok küçük (${file.size} bytes), muhtemelen bozuk`);
    }

    return file;
  };

  // File'ı Base64 string'e çevir (data: prefix'i olmadan)
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // data:image/jpeg;base64, kısmını kaldır
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const captureWithCapacitorCamera = async (
    source: CameraSource,
  ): Promise<{ file: File; webPath: string } | null> => {
    const isIOS = Capacitor.getPlatform() === "ios";

    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source,
      quality: 80,
      width: 800,
      height: 800,
      ...(source === CameraSource.Camera
        ? {
            allowEditing: false,
            saveToGallery: false,
          }
        : {
            correctOrientation: true,
            promptLabelHeader: "Fotoğraf Seç",
          }),
      ...(isIOS ? { presentationStyle: "fullscreen" as const } : {}),
    });

    if (!photo.base64String) {
      throw new Error("Fotoğraf verisi alınamadı");
    }

    const byteCharacters = atob(photo.base64String);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "image/jpeg" });
    const file = new File([blob], source === CameraSource.Camera ? "camera-photo.jpg" : "gallery-photo.jpg", {
      type: "image/jpeg",
    });

    return {
      file,
      webPath: `data:image/jpeg;base64,${photo.base64String}`,
    };
  };

  // Resmi sıkıştır - JPEG formatı daha güvenilir (webp native android'de sorun çıkarabiliyor)
  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 0.3,
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: "image/jpeg" as const, // 🔥 JPEG kullan - WebP yerine (daha güvenilir)
    };

    try {
      const compressedFile = await imageCompression(file, options);
      console.log(
        `[PendingAvatar] Compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB (JPEG)`,
      );
      return compressedFile;
    } catch (error) {
      console.error("[PendingAvatar] Compression error:", error);
      return file;
    }
  };

  // Native storage'a bekleyen avatar kaydet
  const savePendingAvatar = async (base64: string, mimeType: string): Promise<void> => {
    const data: PendingAvatarData = {
      base64,
      mimeType,
      timestamp: Date.now(),
    };

    try {
      // Base64 çok büyük olabilir, chunk'lamaya gerek yok çünkü Capacitor Preferences bunu handle eder
      await nativeStorage.setJSON(PENDING_AVATAR_KEY, data);
      console.log("[PendingAvatar] ✅ Base64 avatar native storage'a kaydedildi");
    } catch (error) {
      console.error("[PendingAvatar] ❌ Native storage kaydetme hatası:", error);
      throw error;
    }
  };

  // Native storage'dan bekleyen avatar oku
  const getPendingAvatar = async (): Promise<PendingAvatarData | null> => {
    try {
      const data = await nativeStorage.getJSON<PendingAvatarData>(PENDING_AVATAR_KEY);

      if (!data) return null;

      // Expire kontrolü
      if (Date.now() - data.timestamp > EXPIRATION_MS) {
        console.log("[PendingAvatar] ⏰ Bekleyen avatar expire olmuş, temizleniyor...");
        await clearPendingAvatar();
        return null;
      }

      return data;
    } catch (error) {
      console.error("[PendingAvatar] ❌ Native storage okuma hatası:", error);
      return null;
    }
  };

  // Bekleyen avatar'ı temizle
  const clearPendingAvatar = async (): Promise<void> => {
    await nativeStorage.removeItem(PENDING_AVATAR_KEY);
    await nativeStorage.removeItem(PENDING_AVATAR_ACTION_KEY);
    await nativeStorage.removeItem(PENDING_AVATAR_TIMESTAMP_KEY);
    console.log("[PendingAvatar] 🧹 Bekleyen avatar temizlendi");
  };

  // Bekleyen avatar'ı Supabase'e yükle
  const uploadPendingAvatar = async (data: PendingAvatarData): Promise<string | null> => {
    if (!user) {
      console.warn("[PendingAvatar] ❌ Kullanıcı oturumu yok");
      return null;
    }

    // 🔥 Base64 validasyonu
    if (!data.base64 || data.base64.length < 1000) {
      console.error("[PendingAvatar] ❌ Base64 verisi geçersiz veya çok kısa:", data.base64?.length || 0);
      throw new Error("Fotoğraf verisi geçersiz veya bozuk");
    }

    console.log(`[PendingAvatar] 📤 Bekleyen avatar yükleniyor... Base64 length: ${data.base64.length}`);

    try {
      // Base64'ten File oluştur
      const file = base64ToFile(data.base64, data.mimeType);

      console.log(`[PendingAvatar] 📦 Orijinal dosya boyutu: ${(file.size / 1024).toFixed(0)}KB`);

      // Sıkıştır
      const compressedFile = await compressImage(file);
      console.log(`[PendingAvatar] 📦 Sıkıştırılmış dosya boyutu: ${(compressedFile.size / 1024).toFixed(0)}KB`);

      // 🔥 Sıkıştırma sonrası da kontrol
      if (compressedFile.size < 500) {
        throw new Error(`Sıkıştırılmış dosya çok küçük: ${compressedFile.size} bytes`);
      }

      const timestamp = Date.now();
      const fileName = `${user.id}/${timestamp}.jpg`; // 🔥 JPEG uzantısı kullan

      // Eski avatarları sil
      const { data: existingFiles } = await supabase.storage.from("avatars").list(user.id);
      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map((f) => `${user.id}/${f.name}`);
        console.log("[PendingAvatar] 🗑️ Eski avatarlar siliniyor:", filesToDelete.length);
        await supabase.storage.from("avatars").remove(filesToDelete);
      }

      // Yeni avatarı yükle - ArrayBuffer olarak gönder (daha güvenilir)
      console.log("[PendingAvatar] ⬆️ Supabase Storage'a yükleniyor...");
      
      // 🔥 FIX: File'ı ArrayBuffer'a çevir ve contentType açıkça belirt
      const arrayBuffer = await compressedFile.arrayBuffer();
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("avatars")
        .upload(fileName, arrayBuffer, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/jpeg", // 🔥 Content-Type açıkça belirtildi
        });

      if (uploadError) {
        console.error("[PendingAvatar] ❌ Storage upload hatası:", uploadError);
        throw uploadError;
      }

      console.log("[PendingAvatar] ✅ Storage upload başarılı:", uploadData?.path);

      // Public URL al - cache busting için timestamp ekle
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);
      const urlWithCacheBust = `${publicUrl}?t=${timestamp}`;
      console.log("[PendingAvatar] 🔗 Public URL (cache-busted):", urlWithCacheBust);

      // Profili güncelle - cache-busted URL ile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlWithCacheBust })
        .eq("id", user.id);

      if (updateError) {
        console.error("[PendingAvatar] ❌ Profil güncelleme hatası:", updateError);
        throw updateError;
      }

      console.log("[PendingAvatar] ✅ Avatar başarıyla yüklendi ve profil güncellendi");
      return urlWithCacheBust;
    } catch (error) {
      console.error("[PendingAvatar] ❌ Avatar yükleme hatası:", error);
      throw error;
    }
  };

  const persistAndUploadSelectedFile = async (file: File): Promise<boolean> => {
    const base64 = await fileToBase64(file);

    if (!base64 || base64.length < 1000) {
      throw new Error("Fotoğraf verisi çok küçük veya bozuk");
    }

    console.log(`[PendingAvatar] ✅ Fotoğraf hazır! Base64 length: ${base64.length}`);

    await savePendingAvatar(base64, "image/jpeg");

    console.log("[PendingAvatar] 🚀 Hemen yükleme başlıyor...");
    await checkAndProcessPendingAvatar();

    return true;
  };

  // Bekleyen avatar'ı kontrol et ve yükle
  const checkAndProcessPendingAvatar = useCallback(async (): Promise<void> => {
    // Çift işlemi önle
    if (isProcessingRef.current) {
      console.log("[PendingAvatar] ⏳ Zaten işleniyor, atlanıyor...");
      return;
    }

    if (!user) {
      console.log("[PendingAvatar] ⏳ Kullanıcı henüz yüklenmedi");
      return;
    }

    isProcessingRef.current = true;

    try {
      const pendingData = await getPendingAvatar();

      if (!pendingData) {
        console.log("[PendingAvatar] ℹ️ Bekleyen avatar yok");
        return;
      }

      console.log("[PendingAvatar] 🔍 Bekleyen avatar bulundu, yükleme başlatılıyor...");
      toast.info("Bekleyen fotoğraf yükleniyor...", { duration: 2000 });

      const publicUrl = await uploadPendingAvatar(pendingData);

      if (publicUrl) {
        await clearPendingAvatar();

        // 🔥 KRİTİK: Callback'i çağır VE bir custom event dispatch et
        // Bu sayede ProfilePage her durumda güncellenecek
        console.log("[PendingAvatar] 🎯 Callback çağrılıyor ve event dispatch ediliyor...");

        // 1. Callback'i çağır (eğer varsa)
        if (onAvatarUploaded) {
          console.log("[PendingAvatar] ✅ onAvatarUploaded callback çağrılıyor");
          onAvatarUploaded(publicUrl);
        } else {
          console.warn("[PendingAvatar] ⚠️ onAvatarUploaded callback YOK!");
        }

        // 2. Custom event dispatch et - ProfilePage bunu da dinleyebilir
        window.dispatchEvent(
          new CustomEvent("avatar-uploaded", {
            detail: { url: publicUrl },
          }),
        );

        // 🔥 KRİTİK FIX: UserContext'teki profili yeniden yükle
        // Bu sayede 10 saniyelik localOverride expire olduktan sonra da doğru URL gösterilir
        console.log("[PendingAvatar] 🔄 UserContext profil refetch ediliyor...");
        try {
          await refreshProfile();
          console.log("[PendingAvatar] ✅ Profil refetch başarılı");
        } catch (refetchError) {
          console.warn("[PendingAvatar] ⚠️ Profil refetch hatası:", refetchError);
        }

        toast.success("Profil fotoğrafı güncellendi!");
      }
    } catch (error) {
      console.error("[PendingAvatar] ❌ İşlem hatası:", error);
      toast.error("Fotoğraf yüklenirken hata oluştu");
      // Hata durumunda da temizle ki sürekli denemesin
      await clearPendingAvatar();
    } finally {
      isProcessingRef.current = false;
    }
  }, [user, onAvatarUploaded, refreshProfile]);

  // 🔥 KAMERA AÇMA - Native plugin kullanarak Base64 formatında resim al
  const captureFromCameraWithRecovery = async (): Promise<boolean> => {
    try {
      console.log("[PendingAvatar] 📷 Native kamera açılıyor (recovery modunda)...");

      const result = isAndroidNative()
        ? await (async () => {
            await nativeStorage.setItem(PENDING_AVATAR_ACTION_KEY, "camera");
            await nativeStorage.setItem(PENDING_AVATAR_TIMESTAMP_KEY, Date.now().toString());
            return captureFromNativeCamera();
          })()
        : await captureWithCapacitorCamera(CameraSource.Camera);

      if (!result || !result.file) {
        console.log("[PendingAvatar] ❌ Kamera iptal edildi");
        await nativeStorage.removeItem(PENDING_AVATAR_ACTION_KEY);
        await nativeStorage.removeItem(PENDING_AVATAR_TIMESTAMP_KEY);
        return false;
      }

      return await persistAndUploadSelectedFile(result.file);
    } catch (error: any) {
      const isCancelled =
        error.message?.includes("cancelled") ||
        error.message?.includes("User cancelled") ||
        error.message?.includes("iptal");

      if (!isCancelled) {
        console.error("[PendingAvatar] ❌ Kamera hatası:", error);
        toast.error("Fotoğraf çekilirken hata oluştu");
      }

      await nativeStorage.removeItem(PENDING_AVATAR_ACTION_KEY);
      await nativeStorage.removeItem(PENDING_AVATAR_TIMESTAMP_KEY);

      return false;
    }
  };

  // 🔥 GALERİ AÇMA - Native plugin kullanarak Base64 formatında resim al
  const captureFromGalleryWithRecovery = async (): Promise<boolean> => {
    try {
      console.log("[PendingAvatar] 🖼️ Native galeri açılıyor (recovery modunda)...");

      const result = isAndroidNative()
        ? await (async () => {
            await nativeStorage.setItem(PENDING_AVATAR_ACTION_KEY, "gallery");
            await nativeStorage.setItem(PENDING_AVATAR_TIMESTAMP_KEY, Date.now().toString());
            return pickFromNativeGallery();
          })()
        : await captureWithCapacitorCamera(CameraSource.Photos);

      if (!result || !result.file) {
        console.log("[PendingAvatar] ❌ Galeri seçimi iptal edildi veya başarısız");
        await nativeStorage.removeItem(PENDING_AVATAR_ACTION_KEY);
        await nativeStorage.removeItem(PENDING_AVATAR_TIMESTAMP_KEY);
        return false;
      }

      return await persistAndUploadSelectedFile(result.file);
    } catch (error: any) {
      const isCancelled =
        error.message?.includes("cancelled") ||
        error.message?.includes("User cancelled") ||
        error.message?.includes("iptal");

      if (!isCancelled) {
        console.error("[PendingAvatar] ❌ Galeri hatası:", error);
        toast.error("Fotoğraf seçilirken hata oluştu");
      }

      // Temizlik
      await nativeStorage.removeItem(PENDING_AVATAR_ACTION_KEY);
      await nativeStorage.removeItem(PENDING_AVATAR_TIMESTAMP_KEY);

      return false;
    }
  };

  // 🔥 UYGULAMA ÖN PLANA GELDİĞİNDE KONTROL ET
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!user) return;

    // Mount'ta bir kez kontrol et
    if (!hasCheckedOnMountRef.current) {
      hasCheckedOnMountRef.current = true;
      console.log("[PendingAvatar] 🔍 Mount kontrolü yapılıyor...");
      setTimeout(() => checkAndProcessPendingAvatar(), 1000);
    }

    // Event listener'ları kur
    const handleAppResumed = () => {
      console.log("[PendingAvatar] 📱 app-resumed eventi alındı, kontrol ediliyor...");
      setTimeout(() => checkAndProcessPendingAvatar(), 500);
    };

    const handleDataReady = () => {
      console.log("[PendingAvatar] 📡 data-ready eventi alındı, kontrol ediliyor...");
      setTimeout(() => checkAndProcessPendingAvatar(), 500);
    };

    const handleNativeSoftRecovery = () => {
      console.log("[PendingAvatar] 🔄 native-soft-recovery eventi alındı, kontrol ediliyor...");
      setTimeout(() => checkAndProcessPendingAvatar(), 500);
    };

    window.addEventListener("app-resumed", handleAppResumed);
    window.addEventListener("data-ready", handleDataReady);
    window.addEventListener("native-soft-recovery", handleNativeSoftRecovery);

    return () => {
      window.removeEventListener("app-resumed", handleAppResumed);
      window.removeEventListener("data-ready", handleDataReady);
      window.removeEventListener("native-soft-recovery", handleNativeSoftRecovery);
    };
  }, [user, checkAndProcessPendingAvatar]);

  return {
    captureFromCameraWithRecovery,
    captureFromGalleryWithRecovery,
    checkAndProcessPendingAvatar,
    clearPendingAvatar,
  };
};

export default usePendingAvatarRecovery;
