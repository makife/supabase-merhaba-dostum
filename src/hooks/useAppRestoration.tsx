import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App, RestoredListenerEvent } from '@capacitor/app';
import { toast } from 'sonner';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import NativeRealtime, { isNativeRealtimeAvailable } from '@/plugins/NativeRealtime';

// Global restoration state - Context olmadan erişilebilir
let globalRestorationState = {
  isRestoring: false,
  restorationMessage: '',
  restorationProgress: 0,
};

const restorationListeners: Set<(state: typeof globalRestorationState) => void> = new Set();

export const getRestorationState = () => globalRestorationState;

export const subscribeToRestoration = (listener: (state: typeof globalRestorationState) => void) => {
  restorationListeners.add(listener);
  return () => restorationListeners.delete(listener);
};

const updateRestorationState = (updates: Partial<typeof globalRestorationState>) => {
  globalRestorationState = { ...globalRestorationState, ...updates };
  restorationListeners.forEach(listener => listener(globalRestorationState));
};

// Restoration tiplerini tanımla
type RestorationSource = 'camera' | 'payment' | 'websocket' | 'unknown';

interface RestorationResult {
  source: RestorationSource;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * 🔄 App Restoration Hook
 * 
 * Handles:
 * 1. Camera/Avatar restoration (appRestoredResult)
 * 2. Payment/IAP restoration (pending transactions)
 * 3. WebSocket message restoration (buffered messages)
 */
export const useAppRestoration = () => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [restorationMessage, setRestorationMessage] = useState('');
  const [restorationProgress, setRestorationProgress] = useState(0);
  const { uploadAvatar } = useAvatarUpload();
  const isProcessingRef = useRef(false);
  const hasCheckedRestorationRef = useRef(false);

  // Update global state when local state changes
  useEffect(() => {
    updateRestorationState({ isRestoring, restorationMessage, restorationProgress });
  }, [isRestoring, restorationMessage, restorationProgress]);

  /**
   * 📸 Camera Restoration Handler
   */
  const handleCameraRestoration = useCallback(async (result: RestoredListenerEvent): Promise<RestorationResult> => {
    console.log('[Restoration] 📸 Camera result alındı:', result);
    
    try {
      setRestorationMessage('Fotoğrafınız işleniyor...');
      setRestorationProgress(30);
      
      // Check if it's from Camera plugin
      if (result.pluginId !== 'Camera') {
        return { source: 'camera', success: false, error: 'Not a camera result' };
      }

      const photoData = result.data;
      
      if (!photoData?.dataUrl && !photoData?.path && !photoData?.webPath) {
        return { source: 'camera', success: false, error: 'No photo data found' };
      }

      setRestorationProgress(50);
      setRestorationMessage('Avatar yükleniyor...');

      // Convert to File and upload
      let imageUrl = photoData.dataUrl || photoData.webPath || photoData.path;
      
      if (imageUrl) {
        // DataUrl ise direkt fetch et
        if (imageUrl.startsWith('data:')) {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const file = new File([blob], 'restored-avatar.jpg', { type: 'image/jpeg' });
          
          setRestorationProgress(70);
          const uploadedUrl = await uploadAvatar(file);
          
          if (uploadedUrl) {
            setRestorationProgress(100);
            toast.success('Avatar başarıyla güncellendi!');
            return { source: 'camera', success: true, data: uploadedUrl };
          }
        }
      }

      return { source: 'camera', success: false, error: 'Failed to process photo' };
    } catch (error) {
      console.error('[Restoration] Camera error:', error);
      return { source: 'camera', success: false, error: String(error) };
    }
  }, [uploadAvatar]);

  /**
   * 💳 Payment Restoration Handler
   * RevenueCat pending transactions kontrolü
   */
  const handlePaymentRestoration = useCallback(async (): Promise<RestorationResult> => {
    console.log('[Restoration] 💳 Payment kontrolü başlıyor...');
    
    try {
      if (!Capacitor.isNativePlatform()) {
        return { source: 'payment', success: true, data: 'web-skip' };
      }

      // Dynamically import RevenueCat
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      
      // Get customer info to check for pending purchases
      const result = await Purchases.getCustomerInfo();
      // RevenueCat returns { customerInfo: CustomerInfo } wrapper
      const customerInfo = (result as any)?.customerInfo || result;
      
      if (customerInfo?.entitlements?.active) {
        const activeEntitlements = Object.keys(customerInfo.entitlements.active);
        
        if (activeEntitlements.length > 0) {
          console.log('[Restoration] ✅ Active entitlements found:', activeEntitlements);
          
          // Dispatch event for other parts of the app to handle
          window.dispatchEvent(new CustomEvent('payment-restored', {
            detail: { entitlements: activeEntitlements }
          }));
          
          return { source: 'payment', success: true, data: activeEntitlements };
        }
      }
      
      return { source: 'payment', success: true, data: 'no-pending' };
    } catch (error) {
      console.warn('[Restoration] Payment check error (non-critical):', error);
      return { source: 'payment', success: true, data: 'error-tolerated' };
    }
  }, []);

  /**
   * 📬 WebSocket Message Restoration Handler
   * Kotlin'den buffered mesajları çek
   */
  const handleWebSocketRestoration = useCallback(async (): Promise<RestorationResult> => {
    console.log('[Restoration] 📬 WebSocket buffer kontrolü...');
    
    try {
      if (!isNativeRealtimeAvailable() || !NativeRealtime) {
        return { source: 'websocket', success: true, data: 'not-available' };
      }

      // Get buffered message count
      const countResult = await NativeRealtime.getBufferedMessageCount();
      console.log('[Restoration] Buffer\'da mesaj sayısı:', countResult.count);
      
      if (countResult.count > 0) {
        // Pull buffered messages
        const messagesResult = await NativeRealtime.getBufferedMessages();
        console.log('[Restoration] 📬 Buffered mesajlar alındı:', messagesResult.count);
        
        // Dispatch each message as an event
        messagesResult.messages.forEach((msg) => {
          try {
            const payload = JSON.parse(msg.payload);
            window.dispatchEvent(new CustomEvent('websocket-restored-message', {
              detail: { topic: msg.topic, event: msg.event, payload, timestamp: msg.timestamp }
            }));
          } catch (e) {
            console.warn('[Restoration] Message parse error:', e);
          }
        });
        
        return { source: 'websocket', success: true, data: { count: messagesResult.count } };
      }
      
      return { source: 'websocket', success: true, data: { count: 0 } };
    } catch (error) {
      console.warn('[Restoration] WebSocket check error:', error);
      return { source: 'websocket', success: false, error: String(error) };
    }
  }, []);

  /**
   * 🚀 Ana Restoration Flow
   */
  const performRestoration = useCallback(async (restoredEvent?: RestoredListenerEvent) => {
    if (isProcessingRef.current) {
      console.log('[Restoration] Already processing, skipping...');
      return;
    }

    isProcessingRef.current = true;
    setIsRestoring(true);
    setRestorationProgress(10);
    setRestorationMessage('Uygulama durumu kontrol ediliyor...');

    try {
      const results: RestorationResult[] = [];

      // 1. Camera restoration (if there's a restored result)
      if (restoredEvent) {
        setRestorationMessage('Fotoğraf işleniyor...');
        const cameraResult = await handleCameraRestoration(restoredEvent);
        results.push(cameraResult);
      }

      // 2. Payment restoration
      setRestorationMessage('Satın alma durumu kontrol ediliyor...');
      setRestorationProgress(40);
      const paymentResult = await handlePaymentRestoration();
      results.push(paymentResult);

      // 3. WebSocket restoration
      setRestorationMessage('Mesajlar alınıyor...');
      setRestorationProgress(70);
      const wsResult = await handleWebSocketRestoration();
      results.push(wsResult);

      setRestorationProgress(100);
      
      // Log results
      console.log('[Restoration] ✅ Tamamlandı:', results);
      
      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.error('[Restoration] ❌ Hata:', error);
      toast.error('Uygulama durumu yüklenirken hata oluştu');
    } finally {
      setIsRestoring(false);
      setRestorationMessage('');
      setRestorationProgress(0);
      isProcessingRef.current = false;
    }
  }, [handleCameraRestoration, handlePaymentRestoration, handleWebSocketRestoration]);

  /**
   * 🎯 Initial Setup - Listen for restoration events
   */
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (hasCheckedRestorationRef.current) return;
    hasCheckedRestorationRef.current = true;

    console.log('[Restoration] 🎯 Restoration listeners kuruluyor...');

    // Listen for appRestoredResult (when app was killed and restored)
    const setupListeners = async () => {
      try {
        // Check if there's already a restored result waiting
        // Note: This event fires when the app is restored after being killed
        const appRestoredListener = await App.addListener('appRestoredResult', async (event) => {
          console.log('[Restoration] 🔄 appRestoredResult event:', event);
          await performRestoration(event);
        });

        // Also listen for resume without restored result (for WebSocket & Payment only)
        const resumeListener = await App.addListener('resume', async () => {
          console.log('[Restoration] 📱 App resumed - checking buffers...');
          // Only check WebSocket and Payment on regular resume
          await handleWebSocketRestoration();
          await handlePaymentRestoration();
        });

        return () => {
          appRestoredListener.remove();
          resumeListener.remove();
        };
      } catch (error) {
        console.error('[Restoration] Listener setup error:', error);
      }
    };

    setupListeners();
  }, [performRestoration, handleWebSocketRestoration, handlePaymentRestoration]);

  return {
    isRestoring,
    restorationMessage,
    restorationProgress,
    performRestoration,
    handleWebSocketRestoration,
    handlePaymentRestoration,
  };
};

export default useAppRestoration;
