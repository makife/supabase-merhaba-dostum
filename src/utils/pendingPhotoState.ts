/**
 * 📸 Pending Photo State Manager
 * 
 * Kamera/galeri ile çekilen fotoğrafı native storage'a kaydeder.
 * App öldürülürse, geri geldiğinde bu fotoğraf alınıp yüklenir.
 */
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

const KEY_PENDING_PHOTO = "pending_photo_data";
const KEY_PENDING_PHOTO_META = "pending_photo_meta";

export interface PendingPhotoMeta {
  capturedAt: number;
  source: 'camera' | 'gallery';
  context: string; // 'avatar-upload'
}

const isNative = Capacitor.isNativePlatform();

/**
 * Çekilen fotoğrafı native storage'a kaydet
 */
export async function savePendingPhoto(
  dataUrl: string,
  meta: PendingPhotoMeta
): Promise<void> {
  console.log("[PendingPhoto] 💾 Fotoğraf kaydediliyor...", meta);
  
  try {
    if (isNative) {
      await Preferences.set({ key: KEY_PENDING_PHOTO, value: dataUrl });
      await Preferences.set({ key: KEY_PENDING_PHOTO_META, value: JSON.stringify(meta) });
    } else {
      localStorage.setItem(KEY_PENDING_PHOTO, dataUrl);
      localStorage.setItem(KEY_PENDING_PHOTO_META, JSON.stringify(meta));
    }
    console.log("[PendingPhoto] ✅ Fotoğraf kaydedildi");
  } catch (error) {
    console.error("[PendingPhoto] ❌ Kaydetme hatası:", error);
    throw error;
  }
}

/**
 * Kaydedilmiş fotoğrafı oku
 */
export async function getPendingPhoto(): Promise<{
  dataUrl: string;
  meta: PendingPhotoMeta;
} | null> {
  try {
    let dataUrl: string | null = null;
    let metaStr: string | null = null;
    
    if (isNative) {
      const photoResult = await Preferences.get({ key: KEY_PENDING_PHOTO });
      const metaResult = await Preferences.get({ key: KEY_PENDING_PHOTO_META });
      dataUrl = photoResult.value;
      metaStr = metaResult.value;
    } else {
      dataUrl = localStorage.getItem(KEY_PENDING_PHOTO);
      metaStr = localStorage.getItem(KEY_PENDING_PHOTO_META);
    }
    
    if (!dataUrl || !metaStr) {
      return null;
    }
    
    const meta = JSON.parse(metaStr) as PendingPhotoMeta;
    
    // 10 dakikadan eski fotoğrafları geçersiz say
    if (Date.now() - meta.capturedAt > 10 * 60 * 1000) {
      console.log("[PendingPhoto] ⏰ Fotoğraf süresi dolmuş, siliniyor...");
      await clearPendingPhoto();
      return null;
    }
    
    console.log("[PendingPhoto] 📖 Fotoğraf bulundu:", meta);
    return { dataUrl, meta };
  } catch (error) {
    console.error("[PendingPhoto] ❌ Okuma hatası:", error);
    return null;
  }
}

/**
 * Pending fotoğrafı temizle
 */
export async function clearPendingPhoto(): Promise<void> {
  console.log("[PendingPhoto] 🗑️ Fotoğraf temizleniyor...");
  
  try {
    if (isNative) {
      await Preferences.remove({ key: KEY_PENDING_PHOTO });
      await Preferences.remove({ key: KEY_PENDING_PHOTO_META });
    } else {
      localStorage.removeItem(KEY_PENDING_PHOTO);
      localStorage.removeItem(KEY_PENDING_PHOTO_META);
    }
  } catch (error) {
    console.error("[PendingPhoto] ❌ Temizleme hatası:", error);
  }
}

/**
 * Pending fotoğraf var mı kontrol et (hızlı kontrol, veri okumadan)
 */
export async function hasPendingPhoto(): Promise<boolean> {
  try {
    if (isNative) {
      const result = await Preferences.get({ key: KEY_PENDING_PHOTO_META });
      return !!result.value;
    } else {
      return !!localStorage.getItem(KEY_PENDING_PHOTO_META);
    }
  } catch {
    return false;
  }
}
