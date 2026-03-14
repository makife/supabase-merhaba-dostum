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
  private maxChannelsPerUser = 15;
  private stats = {
    totalChannels: 0,
    cleanedUpChannels: 0,
    rejectedConnections: 0
  };

  constructor() {
    this.setupReconnectListener();
  }

  private setupReconnectListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('supabase-reconnected', () => {
        console.log('🔄 [RealtimeManager] Reconnect algılandı');
      });
    }
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

    if (!this.canUserSubscribe(userId)) {
      console.warn(`🚫 User ${userId.slice(-8)} channel limit exceeded (${this.maxChannelsPerUser})`);
      this.stats.rejectedConnections++;
      // 🆕 Limit aşıldıysa en eski kanalları temizle
      this.cleanupOldestChannelsForUser(userId, 3);
    }

    // Mevcut kanalı kontrol et
    let channelInfo = this.channels.get(channelKey);
    
    if (channelInfo) {
      channelInfo.subscribers.add(subscriberKey);
      channelInfo.lastActivity = Date.now();
      this.addUserChannel(userId, channelKey);
      console.log(`♻️ Reusing channel ${channelKey} for user ${userId.slice(-8)}`);
      return channelInfo.channel;
    }

    // Yeni kanal oluştur
    console.log(`🆕 Creating new channel ${channelKey} for user ${userId.slice(-8)}`);
    
    const channel = client.channel(channelKey);
    
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

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Channel ${channelKey} subscribed successfully`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`❌ Channel ${channelKey} error:`, err);
      } else if (status === 'TIMED_OUT') {
        console.warn(`⏰ Channel ${channelKey} timed out`);
      }
    });

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

  /**
   * 🆕 Belirli bir room ID'ye ait tüm kanalları temizle
   * Oda değiştiğinde (rematch, yeni oyun) eski kanalları kapatmak için kullanılır
   */
  cleanupChannelsForRoom(roomId: string, userId: string): void {
    if (!roomId) return;
    
    const keysToCleanup: string[] = [];
    
    for (const [channelKey, channelInfo] of this.channels) {
      // Filter'da bu room ID geçiyor mu?
      if (channelInfo.filter?.includes(roomId)) {
        keysToCleanup.push(channelKey);
      }
    }

    if (keysToCleanup.length === 0) return;

    console.log(`🧹 [RealtimeManager] Room ${roomId.slice(-8)} için ${keysToCleanup.length} kanal temizleniyor...`);
    
    for (const key of keysToCleanup) {
      this.forceCleanupChannel(key);
      this.removeUserChannel(userId, key);
    }
    
    console.log(`✅ [RealtimeManager] Room ${roomId.slice(-8)} kanalları temizlendi`);
  }

  /**
   * 🆕 Kullanıcının en eski kanallarını temizle (limit aşıldığında)
   */
  private cleanupOldestChannelsForUser(userId: string, count: number): void {
    const userChannelKeys = this.userChannels.get(userId);
    if (!userChannelKeys) return;

    // Kanalları son aktiviteye göre sırala
    const sortedChannels: Array<{ key: string; lastActivity: number }> = [];
    for (const key of userChannelKeys) {
      const info = this.channels.get(key);
      if (info) {
        sortedChannels.push({ key, lastActivity: info.lastActivity });
      }
    }

    sortedChannels.sort((a, b) => a.lastActivity - b.lastActivity);

    // En eski N kanalı temizle
    const toCleanup = sortedChannels.slice(0, count);
    for (const { key } of toCleanup) {
      console.log(`🗑️ [RealtimeManager] Eski kanal temizleniyor: ${key}`);
      this.forceCleanupChannel(key);
      this.removeUserChannel(userId, key);
    }
  }

  // Belirli bir kanalı temizle - AKTIF
  private forceCleanupChannel(channelKey: string): void {
    const channelInfo = this.channels.get(channelKey);
    if (!channelInfo) return;

    try {
      getSupabaseClient().removeChannel(channelInfo.channel);
      this.channels.delete(channelKey);
      this.stats.cleanedUpChannels++;
      console.log(`✅ Channel ${channelKey} cleaned up`);
    } catch (error) {
      console.error(`❌ Error cleaning up channel ${channelKey}:`, error);
      // Hata olsa bile map'ten kaldır
      this.channels.delete(channelKey);
    }
  }

  // Belirli bir kanalı key ile temizle (dışarıdan erişim için)
  removeChannel(channelKey: string, userId: string): void {
    this.forceCleanupChannel(channelKey);
    this.removeUserChannel(userId, channelKey);
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

  getStats() {
    return {
      ...this.stats,
      activeChannels: this.channels.size,
      totalUsers: this.userChannels.size,
      channelsPerUser: Array.from(this.userChannels.values()).map(s => s.size)
    };
  }

  // Tüm kanalları temizle (logout vb. için)
  forceCleanupAll(): void {
    console.log(`🧹 [RealtimeManager] Tüm kanallar temizleniyor (${this.channels.size} kanal)...`);
    for (const [channelKey] of this.channels) {
      this.forceCleanupChannel(channelKey);
    }
    this.userChannels.clear();
    this.channels.clear();
  }

  destroy(): void {
    this.forceCleanupAll();
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
    
    realtimeManager.subscribe(table, userId, filter, callback);
    
    return () => {
      console.log(`[useOptimizedSubscription] 🛡️ Cleanup atlandı: ${channelKey} (bağlantı koruması)`);
    };
  }, [table, userId, filter, channelKey]);
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

if (typeof window !== 'undefined') {
  window.realtimeManager = realtimeManager;
}
