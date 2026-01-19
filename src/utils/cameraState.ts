// Kamera veya galeri kullanılırken uygulamanın reload olmasını engellemek için
// global state yönetimi - HEM MEMORY HEM NATIVE STORAGE

import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

const KEY_CAMERA_ACTIVE = "camera_active_state";
const isNative = Capacitor.isNativePlatform();

let isCameraOrGalleryActive = false;
let cameraActiveTimestamp = 0;

// Native storage'a kaydet (sync için)
async function persistCameraState(active: boolean, timestamp: number): Promise<void> {
  if (!isNative) return;
  
  try {
    if (active) {
      await Preferences.set({
        key: KEY_CAMERA_ACTIVE,
        value: JSON.stringify({ active: true, timestamp })
      });
    } else {
      await Preferences.remove({ key: KEY_CAMERA_ACTIVE });
    }
  } catch (e) {
    console.error("[CameraState] Persist error:", e);
  }
}

// Native storage'dan oku (app başlangıcında)
export async function loadCameraActiveState(): Promise<boolean> {
  if (!isNative) return false;
  
  try {
    const result = await Preferences.get({ key: KEY_CAMERA_ACTIVE });
    if (!result.value) return false;
    
    const data = JSON.parse(result.value);
    
    // 2 dakikadan eski state'i geçersiz say
    if (Date.now() - data.timestamp > 120000) {
      await Preferences.remove({ key: KEY_CAMERA_ACTIVE });
      return false;
    }
    
    console.log("[CameraState] 📷 Restored camera active state from storage");
    isCameraOrGalleryActive = true;
    cameraActiveTimestamp = data.timestamp;
    return true;
  } catch (e) {
    return false;
  }
}

export const setCameraActive = (active: boolean) => {
  isCameraOrGalleryActive = active;
  if (active) {
    cameraActiveTimestamp = Date.now();
    console.log("📷 Kamera/Galeri aktif - Reload devre dışı");
    persistCameraState(true, cameraActiveTimestamp);
  } else {
    console.log("📷 Kamera/Galeri kapatıldı - Normal mod");
    persistCameraState(false, 0);
  }
};

export const isCameraActive = (): boolean => {
  // Eğer 2 dakikadan fazla aktifse, muhtemelen bir hata olmuştur
  // Güvenlik için false döndür
  if (isCameraOrGalleryActive && Date.now() - cameraActiveTimestamp > 120000) {
    console.log("📷 Kamera timeout - Otomatik reset");
    isCameraOrGalleryActive = false;
    persistCameraState(false, 0);
  }
  return isCameraOrGalleryActive;
};

// Senkron kontrol - storage'dan değil memory'den
export const isCameraActiveSync = (): boolean => {
  return isCameraOrGalleryActive;
};

// Kamera işlemi için wrapper
export const withCameraProtection = async <T>(
  operation: () => Promise<T>
): Promise<T> => {
  setCameraActive(true);
  try {
    const result = await operation();
    return result;
  } finally {
    // Kısa bir gecikme ile kapat (OS'un geri dönmesini bekle)
    setTimeout(() => {
      setCameraActive(false);
    }, 3000);
  }
};
