/**
 * 📸 Pending Photo State Manager
 * 
 * Kamera/galeri işleminin başladığını kaydet.
 * NOT: Base64 veriyi kaydetmiyoruz çünkü çok büyük (2-5MB) ve Preferences crash yapıyor!
 * Sadece meta bilgiyi kaydediyoruz.
 */
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

const KEY_PENDING_PHOTO_META = "pending_photo_meta";

export interface PendingPhotoMeta {
  capturedAt: number;
  source: 'camera' | 'gallery';
  context: string; // 'avatar-upload'
}

const isNative = Capacitor.isNativePlatform();

/**
 * Fotoğraf işlemi başladığında meta bilgiyi kaydet
 * NOT: Base64 veriyi KAYDETME - crash yapıyor!
 */
export async function savePendingPhotoMeta(meta: PendingPhotoMeta): Promise<void> {
  console.log("[PendingPhoto] 💾 Meta kaydediliyor...", meta);
  
  try {
    if (isNative) {
      await Preferences.set({ key: KEY_PENDING_PHOTO_META, value: JSON.stringify(meta) });
    } else {
      localStorage.setItem(KEY_PENDING_PHOTO_META, JSON.stringify(meta));
    }
    console.log("[PendingPhoto] ✅ Meta kaydedildi");
  } catch (error) {
    console.error("[PendingPhoto] ❌ Kaydetme hatası:", error);
    // Don't throw - this is not critical
  }
}

/**
 * @deprecated Use savePendingPhotoMeta instead
 * Bu fonksiyon geriye uyumluluk için bırakıldı
 */
export async function savePendingPhoto(
  _dataUrl: string, // Artık kullanılmıyor - çok büyük crash yapıyor
  meta: PendingPhotoMeta
): Promise<void> {
  // Sadece meta'yı kaydet, dataUrl'i KAYDETME
  await savePendingPhotoMeta(meta);
}

/**
 * Pending photo meta bilgisini oku
 */
export async function getPendingPhotoMeta(): Promise<PendingPhotoMeta | null> {
  try {
    let metaStr: string | null = null;
    
    if (isNative) {
      const metaResult = await Preferences.get({ key: KEY_PENDING_PHOTO_META });
      metaStr = metaResult.value;
    } else {
      metaStr = localStorage.getItem(KEY_PENDING_PHOTO_META);
    }
    
    if (!metaStr) {
      return null;
    }
    
    const meta = JSON.parse(metaStr) as PendingPhotoMeta;
    
    // 10 dakikadan eski işlemleri geçersiz say
    if (Date.now() - meta.capturedAt > 10 * 60 * 1000) {
      console.log("[PendingPhoto] ⏰ İşlem süresi dolmuş, siliniyor...");
      await clearPendingPhoto();
      return null;
    }
    
    console.log("[PendingPhoto] 📖 Meta bulundu:", meta);
    return meta;
  } catch (error) {
    console.error("[PendingPhoto] ❌ Okuma hatası:", error);
    return null;
  }
}

/**
 * @deprecated Use getPendingPhotoMeta instead
 */
export async function getPendingPhoto(): Promise<{
  dataUrl: string;
  meta: PendingPhotoMeta;
} | null> {
  // Artık dataUrl kaydetmiyoruz, bu fonksiyon her zaman null dönecek
  // Ama meta varsa yarım kalan işlemi bildirebiliriz
  return null;
}

/**
 * Pending photo meta'yı temizle
 */
export async function clearPendingPhoto(): Promise<void> {
  console.log("[PendingPhoto] 🗑️ Meta temizleniyor...");
  
  try {
    if (isNative) {
      await Preferences.remove({ key: KEY_PENDING_PHOTO_META });
    } else {
      localStorage.removeItem(KEY_PENDING_PHOTO_META);
    }
  } catch (error) {
    console.error("[PendingPhoto] ❌ Temizleme hatası:", error);
  }
}

/**
 * Pending fotoğraf işlemi var mı kontrol et
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
