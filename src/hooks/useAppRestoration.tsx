import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { toast } from 'sonner';
import NativeRealtime, { isNativeRealtimeAvailable } from '@/plugins/NativeRealtime';
import { 
  getPendingAction, 
  clearPendingAction, 
  PendingAction 
} from '@/utils/pendingActionState';

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
type RestorationSource = 'camera' | 'gallery' | 'payment' | 'websocket' | 'pending-action' | 'unknown';

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
 * 1. Pending Action restoration (camera/gallery/payment that was interrupted)
 * 2. Payment/IAP restoration (pending transactions)
 * 3. WebSocket message restoration (buffered messages)
 */
export const useAppRestoration = () => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [restorationMessage, setRestorationMessage] = useState('');
  const [restorationProgress, setRestorationProgress] = useState(0);
  const isProcessingRef = useRef(false);
  const hasCheckedRestorationRef = useRef(false);

  // Update global state when local state changes
  useEffect(() => {
    updateRestorationState({ isRestoring, restorationMessage, restorationProgress });
  }, [isRestoring, restorationMessage, restorationProgress]);

  /**
   * 📸 Pending Action Handler
   * App arka planda öldürüldüyse, pending action varsa kullanıcıya bildir
   */
  const handlePendingAction = useCallback(async (): Promise<RestorationResult> => {
    console.log('[Restoration] 📋 Pending action kontrolü...');
    
    try {
      const pendingAction = await getPendingAction();
      
      if (!pendingAction) {
        return { source: 'pending-action', success: true, data: 'no-pending' };
      }

      console.log('[Restoration] ⚠️ Pending action bulundu:', pendingAction);
      
      // Pending action türüne göre kullanıcıya bildir
      switch (pendingAction.type) {
        case 'camera':
        case 'gallery':
          toast.error(
            'Fotoğraf yükleme işlemi yarıda kaldı. Lütfen tekrar deneyin.',
            { duration: 5000 }
          );
          break;
        case 'payment':
          toast.warning(
            'Satın alma işlemi tamamlanamamış olabilir. Lütfen satın alımlarınızı kontrol edin.',
            { duration: 8000 }
          );
          // RevenueCat'ten restore dene
          await handlePaymentRestoration();
          break;
      }
      
      // Pending action'ı temizle
      await clearPendingAction();
      
      return { 
        source: 'pending-action', 
        success: true, 
        data: { type: pendingAction.type, context: pendingAction.context } 
      };
    } catch (error) {
      console.error('[Restoration] Pending action error:', error);
      return { source: 'pending-action', success: false, error: String(error) };
    }
  }, []);

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
      
      // Önce restore dene - yarıda kalan işlemleri tamamla
      try {
        const restoreResult = await Purchases.restorePurchases();
        console.log('[Restoration] 💳 Restore result:', restoreResult);
      } catch (restoreError) {
        console.warn('[Restoration] Restore error (non-critical):', restoreError);
      }
      
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
          
          toast.success('Satın alımlarınız geri yüklendi!', { duration: 3000 });
          
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
   * 🚀 Ana Restoration Flow - App başlatıldığında çağrılır
   */
  const performRestoration = useCallback(async () => {
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

      // 1. Pending action kontrolü (camera/gallery/payment yarıda kaldı mı?)
      setRestorationMessage('İşlemler kontrol ediliyor...');
      setRestorationProgress(25);
      const pendingResult = await handlePendingAction();
      results.push(pendingResult);

      // 2. Payment restoration (RevenueCat)
      setRestorationMessage('Satın alma durumu kontrol ediliyor...');
      setRestorationProgress(50);
      const paymentResult = await handlePaymentRestoration();
      results.push(paymentResult);

      // 3. WebSocket restoration
      setRestorationMessage('Mesajlar alınıyor...');
      setRestorationProgress(75);
      const wsResult = await handleWebSocketRestoration();
      results.push(wsResult);

      setRestorationProgress(100);
      
      // Log results
      console.log('[Restoration] ✅ Tamamlandı:', results);
      
      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error('[Restoration] ❌ Hata:', error);
      // Sessiz hata - kullanıcıyı rahatsız etme
    } finally {
      setIsRestoring(false);
      setRestorationMessage('');
      setRestorationProgress(0);
      isProcessingRef.current = false;
    }
  }, [handlePendingAction, handlePaymentRestoration, handleWebSocketRestoration]);

  /**
   * 🎯 Initial Setup - App başlatıldığında ve resume'da çalış
   */
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (hasCheckedRestorationRef.current) return;
    hasCheckedRestorationRef.current = true;

    console.log('[Restoration] 🎯 Restoration başlatılıyor...');

    // App ilk açıldığında hemen kontrol et
    performRestoration();

    // Resume listener - arka plandan dönünce de kontrol et
    const setupResumeListener = async () => {
      try {
        const resumeListener = await App.addListener('resume', async () => {
          console.log('[Restoration] 📱 App resumed - kontrol ediliyor...');
          
          // Sadece pending action ve websocket kontrol et (payment restore ağır)
          const pendingAction = await getPendingAction();
          if (pendingAction) {
            console.log('[Restoration] ⚠️ Resume sonrası pending action:', pendingAction);
            await handlePendingAction();
          }
          
          await handleWebSocketRestoration();
        });

        return () => {
          resumeListener.remove();
        };
      } catch (error) {
        console.error('[Restoration] Listener setup error:', error);
      }
    };

    setupResumeListener();
  }, [performRestoration, handlePendingAction, handleWebSocketRestoration]);

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
