/**
 * 🔄 Pending Action State Manager
 * 
 * Kamera, Galeri, veya Payment işlemi başladığında state'i kaydeder.
 * App arka planda öldürülürse, geri geldiğinde bu state kontrol edilir
 * ve işlem kullanıcıya bildirilir.
 */
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

const KEY_PENDING_ACTION = "pending_action_state";

export type PendingActionType = 'camera' | 'gallery' | 'payment' | 'none';

export interface PendingAction {
  type: PendingActionType;
  startedAt: number;
  context?: string; // örn: 'avatar-upload', 'premium-purchase'
  productId?: string; // Payment için
}

const isNative = Capacitor.isNativePlatform();

/**
 * Pending action'ı kaydet (Kamera/Galeri/Payment başlamadan önce çağrılmalı)
 */
export async function setPendingAction(action: PendingAction): Promise<void> {
  console.log("[PendingAction] 💾 Setting pending action:", action);
  
  if (isNative) {
    await Preferences.set({ 
      key: KEY_PENDING_ACTION, 
      value: JSON.stringify(action) 
    });
  } else {
    localStorage.setItem(KEY_PENDING_ACTION, JSON.stringify(action));
  }
}

/**
 * Pending action'ı oku
 */
export async function getPendingAction(): Promise<PendingAction | null> {
  try {
    let value: string | null = null;
    
    if (isNative) {
      const result = await Preferences.get({ key: KEY_PENDING_ACTION });
      value = result.value;
    } else {
      value = localStorage.getItem(KEY_PENDING_ACTION);
    }
    
    if (!value) return null;
    
    const action = JSON.parse(value) as PendingAction;
    console.log("[PendingAction] 📖 Read pending action:", action);
    
    // 10 dakikadan eski action'ları geçersiz say
    if (Date.now() - action.startedAt > 10 * 60 * 1000) {
      console.log("[PendingAction] ⏰ Action expired, clearing...");
      await clearPendingAction();
      return null;
    }
    
    return action;
  } catch (e) {
    console.error("[PendingAction] Error reading:", e);
    return null;
  }
}

/**
 * Pending action'ı temizle (işlem başarıyla tamamlandığında veya iptal edildiğinde)
 */
export async function clearPendingAction(): Promise<void> {
  console.log("[PendingAction] 🗑️ Clearing pending action");
  
  if (isNative) {
    await Preferences.remove({ key: KEY_PENDING_ACTION });
  } else {
    localStorage.removeItem(KEY_PENDING_ACTION);
  }
}

/**
 * Kamera işlemi için wrapper
 */
export async function withCameraAction<T>(
  operation: () => Promise<T>,
  context: string = 'avatar-upload'
): Promise<T> {
  // İşlem başlamadan önce pending state'i kaydet
  await setPendingAction({
    type: 'camera',
    startedAt: Date.now(),
    context,
  });
  
  try {
    const result = await operation();
    // Başarılı ise temizle
    await clearPendingAction();
    return result;
  } catch (error: any) {
    // User cancelled ise temizle
    if (error?.message?.includes('cancelled') || error?.message?.includes('User cancelled')) {
      await clearPendingAction();
    }
    // Diğer hatalar için pending state'i bırak (app crash durumunda recovery için)
    throw error;
  }
}

/**
 * Galeri işlemi için wrapper
 */
export async function withGalleryAction<T>(
  operation: () => Promise<T>,
  context: string = 'avatar-upload'
): Promise<T> {
  await setPendingAction({
    type: 'gallery',
    startedAt: Date.now(),
    context,
  });
  
  try {
    const result = await operation();
    await clearPendingAction();
    return result;
  } catch (error: any) {
    if (error?.message?.includes('cancelled') || error?.message?.includes('User cancelled')) {
      await clearPendingAction();
    }
    throw error;
  }
}

/**
 * Payment işlemi için wrapper
 */
export async function withPaymentAction<T>(
  operation: () => Promise<T>,
  productId: string
): Promise<T> {
  await setPendingAction({
    type: 'payment',
    startedAt: Date.now(),
    context: 'purchase',
    productId,
  });
  
  try {
    const result = await operation();
    await clearPendingAction();
    return result;
  } catch (error: any) {
    if (error?.message?.includes('cancelled') || error?.message?.includes('User cancelled')) {
      await clearPendingAction();
    }
    throw error;
  }
}
