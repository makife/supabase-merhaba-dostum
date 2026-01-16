/**
 * 🔥 DEPRECATED - ARTIK KULLANILMIYOR
 * 
 * Foreground service, 1x1 WebView ve arka planda müzik çaldırma
 * yöntemlerinin hiçbiri işe yaramadı.
 * 
 * Yeni sistem: Silent Push Notification ile arka planda canlı tutma
 * @see src/hooks/useBackgroundKeepAlive.tsx
 */

// Eski API'yi boş fonksiyonlarla dışa aktar (geriye uyumluluk için)
export const startForegroundServiceStandalone = async (): Promise<boolean> => false;
export const stopForegroundServiceStandalone = async (): Promise<void> => {};
export const initForegroundService = async (): Promise<boolean> => false;
export const onAppEnteredForeground = async (): Promise<void> => {};
export const onAppEnteredBackground = (): void => {};
export const isForegroundServiceActive = (): boolean => false;

export const useForegroundService = () => ({
  startForegroundService: async () => false,
  stopForegroundService: async () => {},
  isRunning: false,
  isSupported: false,
});
