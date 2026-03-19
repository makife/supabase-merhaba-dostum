/**
 * 📷 Native Camera Service
 * 
 * Android native kamera plugin'i ile iletişim kurar.
 * Capacitor Camera plugin'i yerine kullanılır.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

// Plugin interface
interface NativeCameraPlugin {
  captureFromCamera(): Promise<{ base64: string; success: boolean }>;
  pickFromGallery(): Promise<{ base64: string; success: boolean }>;
}

// Plugin'i kaydet
const NativeCamera = registerPlugin<NativeCameraPlugin>('NativeCamera');

/**
 * Native platformda mıyız?
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Android native platformda mıyız? (NativeCamera plugin sadece Android'de var)
 */
export const isAndroidNative = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

/**
 * 📷 Native kameradan fotoğraf çek
 * @returns Base64 string veya null (iptal/hata durumunda)
 */
export const captureFromNativeCamera = async (): Promise<{ file: File; webPath: string } | null> => {
  if (!isNativePlatform()) {
    console.warn('[NativeCamera] Native platform değil, web fallback kullanılmalı');
    return null;
  }

  try {
    console.log('[NativeCamera] 📷 Kamera açılıyor...');
    
    const result = await NativeCamera.captureFromCamera();
    
    if (!result.success || !result.base64) {
      console.log('[NativeCamera] ❌ Kamera iptal edildi veya başarısız');
      return null;
    }

    console.log('[NativeCamera] ✅ Fotoğraf alındı, Base64 uzunluk:', result.base64.length);
    
    // Base64'ü File nesnesine çevir
    return base64ToFileResult(result.base64, 'camera-photo.jpg');
    
  } catch (error: any) {
    // İptal durumunda sessizce null dön
    if (error.message?.includes('iptal') || error.message?.includes('cancel')) {
      console.log('[NativeCamera] 📷 Kullanıcı iptal etti');
      return null;
    }
    
    console.error('[NativeCamera] ❌ Kamera hatası:', error);
    throw error;
  }
};

/**
 * 🖼️ Native galeriden fotoğraf seç
 * @returns Base64 string veya null (iptal/hata durumunda)
 */
export const pickFromNativeGallery = async (): Promise<{ file: File; webPath: string } | null> => {
  if (!isNativePlatform()) {
    console.warn('[NativeCamera] Native platform değil, web fallback kullanılmalı');
    return null;
  }

  try {
    console.log('[NativeCamera] 🖼️ Galeri açılıyor...');
    
    const result = await NativeCamera.pickFromGallery();
    
    if (!result.success || !result.base64) {
      console.log('[NativeCamera] ❌ Galeri seçimi iptal edildi veya başarısız');
      return null;
    }

    console.log('[NativeCamera] ✅ Fotoğraf seçildi, Base64 uzunluk:', result.base64.length);
    
    // Base64'ü File nesnesine çevir
    return base64ToFileResult(result.base64, 'gallery-photo.jpg');
    
  } catch (error: any) {
    // İptal durumunda sessizce null dön
    if (error.message?.includes('iptal') || error.message?.includes('cancel')) {
      console.log('[NativeCamera] 🖼️ Kullanıcı iptal etti');
      return null;
    }
    
    console.error('[NativeCamera] ❌ Galeri hatası:', error);
    throw error;
  }
};

/**
 * Base64 string'i File ve webPath'e çevir
 */
const base64ToFileResult = (base64: string, filename: string): { file: File; webPath: string } => {
  // Base64'ü byte array'e çevir
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/jpeg' });
  const file = new File([blob], filename, { type: 'image/jpeg' });
  
  // Data URL oluştur (önizleme için)
  const webPath = `data:image/jpeg;base64,${base64}`;
  
  console.log('[NativeCamera] ✅ File oluşturuldu, boyut:', (file.size / 1024).toFixed(0), 'KB');
  
  return { file, webPath };
};

export default {
  captureFromNativeCamera,
  pickFromNativeGallery,
  isNativePlatform
};
