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

import { useEffect, useCallback, useRef } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { nativeStorage } from '@/utils/nativeStorage';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';

// Storage keys
const PENDING_AVATAR_KEY = 'pending_avatar_base64';
const PENDING_AVATAR_ACTION_KEY = 'pending_avatar_action';
const PENDING_AVATAR_TIMESTAMP_KEY = 'pending_avatar_timestamp';

// 24 saat sonra expire olsun (stale data temizliği)
const EXPIRATION_MS = 24 * 60 * 60 * 1000;

interface PendingAvatarData {
  base64: string;
  mimeType: string;
  timestamp: number;
}

export const usePendingAvatarRecovery = (onAvatarUploaded?: (url: string) => void) => {
  const { user } = useAuth();
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

  // Resmi sıkıştır
  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 0.3,
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: 'image/webp' as const,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      console.log(
        `[PendingAvatar] Compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB`
      );
      return compressedFile;
    } catch (error) {
      console.error('[PendingAvatar] Compression error:', error);
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
      console.log('[PendingAvatar] ✅ Base64 avatar native storage\'a kaydedildi');
    } catch (error) {
      console.error('[PendingAvatar] ❌ Native storage kaydetme hatası:', error);
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
        console.log('[PendingAvatar] ⏰ Bekleyen avatar expire olmuş, temizleniyor...');
        await clearPendingAvatar();
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('[PendingAvatar] ❌ Native storage okuma hatası:', error);
      return null;
    }
  };

  // Bekleyen avatar'ı temizle
  const clearPendingAvatar = async (): Promise<void> => {
    await nativeStorage.removeItem(PENDING_AVATAR_KEY);
    await nativeStorage.removeItem(PENDING_AVATAR_ACTION_KEY);
    await nativeStorage.removeItem(PENDING_AVATAR_TIMESTAMP_KEY);
    console.log('[PendingAvatar] 🧹 Bekleyen avatar temizlendi');
  };

  // Bekleyen avatar'ı Supabase'e yükle
  const uploadPendingAvatar = async (data: PendingAvatarData): Promise<string | null> => {
    if (!user) {
      console.warn('[PendingAvatar] ❌ Kullanıcı oturumu yok');
      return null;
    }

    // 🔥 Base64 validasyonu
    if (!data.base64 || data.base64.length < 1000) {
      console.error('[PendingAvatar] ❌ Base64 verisi geçersiz veya çok kısa:', data.base64?.length || 0);
      throw new Error('Fotoğraf verisi geçersiz veya bozuk');
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
      const fileName = `${user.id}/${timestamp}.webp`;

      // Eski avatarları sil
      const { data: existingFiles } = await supabase.storage.from('avatars').list(user.id);
      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map((f) => `${user.id}/${f.name}`);
        console.log('[PendingAvatar] 🗑️ Eski avatarlar siliniyor:', filesToDelete.length);
        await supabase.storage.from('avatars').remove(filesToDelete);
      }

      // Yeni avatarı yükle
      console.log('[PendingAvatar] ⬆️ Supabase Storage\'a yükleniyor...');
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('[PendingAvatar] ❌ Storage upload hatası:', uploadError);
        throw uploadError;
      }

      console.log('[PendingAvatar] ✅ Storage upload başarılı:', uploadData?.path);

      // Public URL al - cache busting için timestamp ekle
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const urlWithCacheBust = `${publicUrl}?t=${timestamp}`;
      console.log('[PendingAvatar] 🔗 Public URL (cache-busted):', urlWithCacheBust);

      // Profili güncelle - cache-busted URL ile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlWithCacheBust })
        .eq('id', user.id);

      if (updateError) {
        console.error('[PendingAvatar] ❌ Profil güncelleme hatası:', updateError);
        throw updateError;
      }

      console.log('[PendingAvatar] ✅ Avatar başarıyla yüklendi ve profil güncellendi');
      return urlWithCacheBust;
    } catch (error) {
      console.error('[PendingAvatar] ❌ Avatar yükleme hatası:', error);
      throw error;
    }
  };

  // Bekleyen avatar'ı kontrol et ve yükle
  const checkAndProcessPendingAvatar = useCallback(async (): Promise<void> => {
    // Çift işlemi önle
    if (isProcessingRef.current) {
      console.log('[PendingAvatar] ⏳ Zaten işleniyor, atlanıyor...');
      return;
    }

    if (!user) {
      console.log('[PendingAvatar] ⏳ Kullanıcı henüz yüklenmedi');
      return;
    }

    isProcessingRef.current = true;

    try {
      const pendingData = await getPendingAvatar();
      
      if (!pendingData) {
        console.log('[PendingAvatar] ℹ️ Bekleyen avatar yok');
        return;
      }

      console.log('[PendingAvatar] 🔍 Bekleyen avatar bulundu, yükleme başlatılıyor...');
      toast.info('Bekleyen fotoğraf yükleniyor...', { duration: 2000 });

      const publicUrl = await uploadPendingAvatar(pendingData);
      
      if (publicUrl) {
        await clearPendingAvatar();
        toast.success('Profil fotoğrafı güncellendi!');
        onAvatarUploaded?.(publicUrl);
      }
    } catch (error) {
      console.error('[PendingAvatar] ❌ İşlem hatası:', error);
      toast.error('Fotoğraf yüklenirken hata oluştu');
      // Hata durumunda da temizle ki sürekli denemesin
      await clearPendingAvatar();
    } finally {
      isProcessingRef.current = false;
    }
  }, [user, onAvatarUploaded]);

  // 🔥 KAMERA AÇMA - Base64 formatında resim al ve kaydet
  const captureFromCameraWithRecovery = async (): Promise<boolean> => {
    try {
      console.log('[PendingAvatar] 📷 Kamera açılıyor (recovery modunda)...');
      
      // Action flag'ini kaydet
      await nativeStorage.setItem(PENDING_AVATAR_ACTION_KEY, 'camera');
      await nativeStorage.setItem(PENDING_AVATAR_TIMESTAMP_KEY, Date.now().toString());

      // 🔥 KRİTİK: DataUrl (Base64) formatında al - URI değil!
      // Bu sayede JS kapansa bile base64 string elimizde kalır
      // ⚠️ allowEditing: false - Düzenleme ekranından X ile çıkış sorununu önle
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Base64, // ÖNEMLİ: Base64 formatı!
        source: CameraSource.Camera,
        quality: 85, // Kalite ayarı
        allowEditing: false, // 🔥 DÜZELTME: Edit ekranı devre dışı - X ile çıkış sorunu
        width: 800, // Max genişlik
        height: 800, // Max yükseklik
        correctOrientation: true, // Oryantasyon düzelt
      });

      if (!photo.base64String) {
        console.error('[PendingAvatar] ❌ Kamera base64 verisi boş döndü');
        throw new Error('Fotoğraf verisi alınamadı - lütfen tekrar deneyin');
      }

      // 🔥 Base64 boyut kontrolü - çok küçükse muhtemelen bozuk
      if (photo.base64String.length < 1000) {
        console.error('[PendingAvatar] ❌ Base64 verisi çok küçük:', photo.base64String.length);
        throw new Error('Fotoğraf verisi çok küçük veya bozuk');
      }

      console.log(`[PendingAvatar] ✅ Fotoğraf çekildi! Base64 length: ${photo.base64String.length}, Format: ${photo.format}`);
      
      // Base64'ü native storage'a kaydet
      const mimeType = photo.format === 'png' ? 'image/png' : 'image/jpeg';
      await savePendingAvatar(photo.base64String, mimeType);

      // Eğer uygulama hala ön plandaysa hemen yüklemeyi dene
      setTimeout(async () => {
        console.log('[PendingAvatar] 🚀 Hemen yükleme deneniyor...');
        await checkAndProcessPendingAvatar();
      }, 500);

      return true;
    } catch (error: any) {
      const isCancelled = error.message?.includes('cancelled') || error.message?.includes('User cancelled');
      
      if (!isCancelled) {
        console.error('[PendingAvatar] ❌ Kamera hatası:', error);
        toast.error('Fotoğraf çekilirken hata oluştu');
      }
      
      // Temizlik
      await nativeStorage.removeItem(PENDING_AVATAR_ACTION_KEY);
      await nativeStorage.removeItem(PENDING_AVATAR_TIMESTAMP_KEY);
      
      return false;
    }
  };

  // 🔥 GALERİ AÇMA - Base64 formatında resim al ve kaydet
  const captureFromGalleryWithRecovery = async (): Promise<boolean> => {
    try {
      console.log('[PendingAvatar] 🖼️ Galeri açılıyor (recovery modunda)...');
      
      // Action flag'ini kaydet
      await nativeStorage.setItem(PENDING_AVATAR_ACTION_KEY, 'gallery');
      await nativeStorage.setItem(PENDING_AVATAR_TIMESTAMP_KEY, Date.now().toString());

      // 🔥 KRİTİK: DataUrl (Base64) formatında al
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Base64, // ÖNEMLİ: Base64 formatı!
        source: CameraSource.Photos,
        quality: 85,
        width: 800,
        height: 800,
        correctOrientation: true,
      });

      if (!photo.base64String) {
        console.error('[PendingAvatar] ❌ Galeri base64 verisi boş döndü');
        throw new Error('Fotoğraf verisi alınamadı - lütfen tekrar deneyin');
      }

      // 🔥 Base64 boyut kontrolü
      if (photo.base64String.length < 1000) {
        console.error('[PendingAvatar] ❌ Base64 verisi çok küçük:', photo.base64String.length);
        throw new Error('Fotoğraf verisi çok küçük veya bozuk');
      }

      console.log(`[PendingAvatar] ✅ Fotoğraf seçildi! Base64 length: ${photo.base64String.length}, Format: ${photo.format}`);
      
      // Base64'ü native storage'a kaydet
      const mimeType = photo.format === 'png' ? 'image/png' : 'image/jpeg';
      await savePendingAvatar(photo.base64String, mimeType);

      // Hemen yüklemeyi dene
      setTimeout(async () => {
        console.log('[PendingAvatar] 🚀 Hemen yükleme deneniyor...');
        await checkAndProcessPendingAvatar();
      }, 500);

      return true;
    } catch (error: any) {
      const isCancelled = error.message?.includes('cancelled') || error.message?.includes('User cancelled');
      
      if (!isCancelled) {
        console.error('[PendingAvatar] ❌ Galeri hatası:', error);
        toast.error('Fotoğraf seçilirken hata oluştu');
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
      console.log('[PendingAvatar] 🔍 Mount kontrolü yapılıyor...');
      setTimeout(() => checkAndProcessPendingAvatar(), 1000);
    }

    // Event listener'ları kur
    const handleAppResumed = () => {
      console.log('[PendingAvatar] 📱 app-resumed eventi alındı, kontrol ediliyor...');
      setTimeout(() => checkAndProcessPendingAvatar(), 500);
    };

    const handleDataReady = () => {
      console.log('[PendingAvatar] 📡 data-ready eventi alındı, kontrol ediliyor...');
      setTimeout(() => checkAndProcessPendingAvatar(), 500);
    };

    const handleNativeSoftRecovery = () => {
      console.log('[PendingAvatar] 🔄 native-soft-recovery eventi alındı, kontrol ediliyor...');
      setTimeout(() => checkAndProcessPendingAvatar(), 500);
    };

    window.addEventListener('app-resumed', handleAppResumed);
    window.addEventListener('data-ready', handleDataReady);
    window.addEventListener('native-soft-recovery', handleNativeSoftRecovery);

    return () => {
      window.removeEventListener('app-resumed', handleAppResumed);
      window.removeEventListener('data-ready', handleDataReady);
      window.removeEventListener('native-soft-recovery', handleNativeSoftRecovery);
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
