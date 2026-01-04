import React from 'react';
import { getSupabaseClient } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface ChannelInfo {
  channel: RealtimeChannel;
  subscribers: Set<string>;
  lastActivity: number;
  table: string;
  filter?: string;
  callback?: (payload: any) => void;
}

class RealtimeManager {
  private channels = new Map<string, ChannelInfo>();
  private userChannels = new Map<string, Set<string>>(); // userId -> channel keys
  private maxChannelsPerUser = 10;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private stats = {
    totalChannels: 0,
    cleanedUpChannels: 0,
    rejectedConnections: 0
  };

  constructor() {
    this.startCleanupTimer();
    this.setupReconnectListener();
  }

  // Reconnect event'ini dinle ve tüm kanalları yeniden oluştur
  private setupReconnectListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('supabase-reconnected', () => {
        console.log('🔄 [RealtimeManager] Reconnect algılandı, kanallar yeniden oluşturuluyor...');
        this.recreateAllChannels();
      });
    }
  }

  // ⚠️ DEVRE DIŞI: Bu fonksiyon removeChannel çağırıyor ve bağlantıyı öldürüyordu
  // Artık hiçbir şey yapmıyor - sadece log atıyor
  private async recreateAllChannels(): Promise<void> {
    console.log('⚠️ [RealtimeManager] recreateAllChannels DEVRE DIŞI - bağlantı koruması aktif');
    // Eski kanalları temizleme ve yeniden oluşturma devre dışı
    // Bağlantı kendi kendine toparlanacak
  }

  // Ana subscription metodu
  subscribe(
    table: string, 
    userId: string, 
    filter?: string,
    callback?: (payload: any) => void
  ): RealtimeChannel | null {
    const client = getSupabaseClient();
    const channelKey = this.getChannelKey(table, filter);
    const subscriberKey = `${userId}-${Date.now()}`;

    // User başına kanal limiti kontrolü
    if (!this.canUserSubscribe(userId)) {
      console.warn(`🚫 User ${userId.slice(-8)} channel limit exceeded`);
      this.stats.rejectedConnections++;
      return null;
    }

    // Mevcut kanalı kontrol et
    let channelInfo = this.channels.get(channelKey);
    
    if (channelInfo) {
      // Mevcut kanala subscriber ekle
      channelInfo.subscribers.add(subscriberKey);
      channelInfo.lastActivity = Date.now();
      this.addUserChannel(userId, channelKey);
      console.log(`♻️ Reusing channel ${channelKey} for user ${userId.slice(-8)}`);
      return channelInfo.channel;
    }

    // Yeni kanal oluştur
    console.log(`🆕 Creating new channel ${channelKey} for user ${userId.slice(-8)}`);
    
    const channel = client.channel(channelKey);
    
    // Postgres changes subscription
    if (callback) {
      const changeConfig: any = {
        event: '*',
        schema: 'public',
        table: table
      };
      
      if (filter) {
        changeConfig.filter = filter;
      }
      
      channel.on('postgres_changes', changeConfig, callback);
    }

    // Subscribe ve error handling
    // ⚠️ HATA DURUMUNDA KANAL'I KAPATMIYORUZ - sadece log atıyoruz
    // Cleanup bağlantıyı öldürüyordu!
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Channel ${channelKey} subscribed successfully`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`❌ Channel ${channelKey} error:`, err);
        // ❌ DEVRE DIŞI: this.forceCleanupChannel(channelKey);
        console.log(`⚠️ [RealtimeManager] Kanal hatası, cleanup ATLANYOR (bağlantı koruması)`);
      } else if (status === 'TIMED_OUT') {
        console.warn(`⏰ Channel ${channelKey} timed out`);
        // ❌ DEVRE DIŞI: this.forceCleanupChannel(channelKey);
        console.log(`⚠️ [RealtimeManager] Timeout, cleanup ATLANYOR (bağlantı koruması)`);
      }
    });

    // Channel info kaydet
    channelInfo = {
      channel,
      subscribers: new Set([subscriberKey]),
      lastActivity: Date.now(),
      table,
      filter,
      callback
    };
    
    this.channels.set(channelKey, channelInfo);
    this.addUserChannel(userId, channelKey);
    this.stats.totalChannels++;

    return channel;
  }

  // ⚠️ DEVRE DIŞI: Subscription'ı kapat - bu bağlantıyı öldürüyordu
  unsubscribe(channelKey: string, userId: string): void {
    console.log(`⚠️ [RealtimeManager] unsubscribe DEVRE DIŞI: ${channelKey} (bağlantı koruması)`);
    // ❌ DEVRE DIŞI - Kanal kapatma bağlantıyı öldürüyordu
    // const channelInfo = this.channels.get(channelKey);
    // if (!channelInfo) return;
    // ...
    // this.cleanupChannel(channelKey);
  }

  // ⚠️ DEVRE DIŞI: User'ın tüm subscription'larını kapat - bu bağlantıyı öldürüyordu
  unsubscribeAll(userId: string): void {
    console.log(`⚠️ [RealtimeManager] unsubscribeAll DEVRE DIŞI: ${userId?.slice(-8)} (bağlantı koruması)`);
    // ❌ DEVRE DIŞI - Tüm kanalları kapatma bağlantıyı öldürüyordu
  }

  // ⚠️ DEVRE DIŞI: Otomatik temizlik bağlantıyı öldürüyordu
  private startCleanupTimer(): void {
    // ❌ DEVRE DIŞI - Bu kanalları otomatik kapatıyordu ve bağlantı kopuyordu
    // this.cleanupInterval = setInterval(() => {
    //   this.cleanupInactiveChannels();
    // }, 30 * 1000);
    console.log("[RealtimeManager] ⚠️ Auto-cleanup DEVRE DIŞI - bağlantı koruması aktif");
  }

  private cleanupInactiveChannels(): void {
    // ❌ DEVRE DIŞI - Bu fonksiyon bağlantıyı öldürüyordu
    console.log("[RealtimeManager] ⚠️ cleanupInactiveChannels DEVRE DIŞI");
    // const now = Date.now();
    // const inactiveThreshold = 5 * 60 * 1000; // 5 dakika
    // for (const [channelKey, channelInfo] of this.channels) {
    //   if (now - channelInfo.lastActivity > inactiveThreshold) {
    //     console.log(`🗑️ Cleaning up inactive channel: ${channelKey}`);
    //     this.cleanupChannel(channelKey);
    //   }
    // }
  }

  private cleanupChannel(channelKey: string): void {
    const channelInfo = this.channels.get(channelKey);
    if (!channelInfo) return;

    try {
      getSupabaseClient().removeChannel(channelInfo.channel);
      this.channels.delete(channelKey);
      this.stats.cleanedUpChannels++;
      console.log(`✅ Channel ${channelKey} cleaned up`);
    } catch (error) {
      console.error(`❌ Error cleaning up channel ${channelKey}:`, error);
    }

    // User mapping'lerden de kaldır
    for (const [userId, channelKeys] of this.userChannels) {
      if (channelKeys.has(channelKey)) {
        channelKeys.delete(channelKey);
        if (channelKeys.size === 0) {
          this.userChannels.delete(userId);
        }
      }
    }
  }

  private forceCleanupChannel(channelKey: string): void {
    console.log(`💥 Force cleanup for channel: ${channelKey}`);
    this.cleanupChannel(channelKey);
  }

  private canUserSubscribe(userId: string): boolean {
    const userChannels = this.userChannels.get(userId);
    return !userChannels || userChannels.size < this.maxChannelsPerUser;
  }

  private addUserChannel(userId: string, channelKey: string): void {
    if (!this.userChannels.has(userId)) {
      this.userChannels.set(userId, new Set());
    }
    this.userChannels.get(userId)!.add(channelKey);
  }

  private removeUserChannel(userId: string, channelKey: string): void {
    const userChannels = this.userChannels.get(userId);
    if (userChannels) {
      userChannels.delete(channelKey);
      if (userChannels.size === 0) {
        this.userChannels.delete(userId);
      }
    }
  }

  private getChannelKey(table: string, filter?: string): string {
    return filter ? `${table}-${filter}` : table;
  }

  // Debugging ve monitoring
  getStats() {
    return {
      ...this.stats,
      activeChannels: this.channels.size,
      totalUsers: this.userChannels.size,
      channelsPerUser: Array.from(this.userChannels.values()).map(s => s.size)
    };
  }

  // ⚠️ DEVRE DIŞI: Manual cleanup bağlantıyı öldürüyordu
  forceCleanupAll(): void {
    console.log('⚠️ [RealtimeManager] forceCleanupAll DEVRE DIŞI - bağlantı koruması aktif');
    // ❌ DEVRE DIŞI - Bu tüm kanalları kapatıyordu
    // for (const [channelKey] of this.channels) {
    //   this.cleanupChannel(channelKey);
    // }
    // this.userChannels.clear();
    // this.channels.clear();
  }

  // ⚠️ DEVRE DIŞI: Component unmount'da çağrılıyordu ve bağlantıyı öldürüyordu
  destroy(): void {
    console.log('⚠️ [RealtimeManager] destroy DEVRE DIŞI - bağlantı koruması aktif');
    // if (this.cleanupInterval) {
    //   clearInterval(this.cleanupInterval);
    //   this.cleanupInterval = null;
    // }
    // this.forceCleanupAll();
  }
}

// Singleton instance
export const realtimeManager = new RealtimeManager();

// React hook'u
export const useOptimizedSubscription = (
  table: string,
  userId: string,
  filter?: string,
  callback?: (payload: any) => void
) => {
  const channelKey = `${table}${filter ? `-${filter}` : ''}`;
  
  React.useEffect(() => {
    if (!userId || !callback) return;
    
    const channel = realtimeManager.subscribe(table, userId, filter, callback);
    
    // ⚠️ CLEANUP'I DEVRE DIŞI BIRAKIYORUZ - bağlantı koruması
    return () => {
      // ❌ DEVRE DIŞI: Bu satır kanalları kapatıyordu
      // if (channel) {
      //   realtimeManager.unsubscribe(channelKey, userId);
      // }
      console.log(`[useOptimizedSubscription] 🛡️ Cleanup atlandı: ${channelKey} (bağlantı koruması)`);
    };
  }, [table, userId, filter, channelKey]);
  
  // ⚠️ DEVRE DIŞI: Bu satır TÜM kanalları kapatıyordu
  // React.useEffect(() => {
  //   return () => {
  //     realtimeManager.unsubscribeAll(userId);
  //   };
  // }, [userId]);
};

// Performance monitoring hook
export const useRealtimeStats = () => {
  const [stats, setStats] = React.useState(realtimeManager.getStats());
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setStats(realtimeManager.getStats());
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  return stats;
};

declare global {
  interface Window {
    realtimeManager: RealtimeManager;
  }
}

// Debug için global'e ekle
if (typeof window !== 'undefined') {
  window.realtimeManager = realtimeManager;
}
