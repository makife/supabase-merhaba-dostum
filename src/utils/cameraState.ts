// Kamera veya galeri kullanılırken uygulamanın reload olmasını engellemek için
// global state yönetimi

let isCameraOrGalleryActive = false;
let cameraActiveTimestamp = 0;

export const setCameraActive = (active: boolean) => {
  isCameraOrGalleryActive = active;
  if (active) {
    cameraActiveTimestamp = Date.now();
    console.log("📷 Kamera/Galeri aktif - Reload devre dışı");
  } else {
    console.log("📷 Kamera/Galeri kapatıldı - Normal mod");
  }
};

export const isCameraActive = (): boolean => {
  // Eğer 60 saniyeden fazla aktifse, muhtemelen bir hata olmuştur
  // Güvenlik için false döndür
  if (isCameraOrGalleryActive && Date.now() - cameraActiveTimestamp > 60000) {
    console.log("📷 Kamera timeout - Otomatik reset");
    isCameraOrGalleryActive = false;
  }
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
    }, 2000);
  }
};
