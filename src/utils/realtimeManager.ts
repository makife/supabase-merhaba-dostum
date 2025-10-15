import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface ChannelInfo {
  channel: RealtimeChannel;
  subscribers: Set<string>;
  lastActivity: number;
  table: string;
  filter?: string;
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
  }

  // Ana subscription metodu
  subscribe(
    table: string, 
    userId: string, 
    filter?: string,
    callback?: (payload: any) => void
  ): RealtimeChannel | null {
    
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
    
    const channel = supabase.channel(channelKey);
    
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
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Channel ${channelKey} subscribed successfully`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`❌ Channel ${channelKey} error:`, err);
        this.forceCleanupChannel(channelKey);
      } else if (status === 'TIMED_OUT') {
        console.warn(`⏰ Channel ${channelKey} timed out`);
        this.forceCleanupChannel(channelKey);
      }
    });

    // Channel info kaydet
    channelInfo = {
      channel,
      subscribers: new Set([subscriberKey]),
      lastActivity: Date.now(),
      table,
      filter
    };
    
    this.channels.set(channelKey, channelInfo);
    this.addUserChannel(userId, channelKey);
    this.stats.totalChannels++;

    return channel;
  }

  // Subscription'ı kapat
  unsubscribe(channelKey: string, userId: string): void {
    const channelInfo = this.channels.get(channelKey);
    if (!channelInfo) return;

    // Subscriber'ı kaldır
    const subscriberKeys = Array.from(channelInfo.subscribers);
    const userSubscribers = subscriberKeys.filter(key => key.startsWith(userId));
    
    userSubscribers.forEach(key => {
      channelInfo.subscribers.delete(key);
    });

    this.removeUserChannel(userId, channelKey);

    // Hiç subscriber kalmadıysa kanalı kapat
    if (channelInfo.subscribers.size === 0) {
      this.cleanupChannel(channelKey);
    }
  }

  // User'ın tüm subscription'larını kapat
  unsubscribeAll(userId: string): void {
    const userChannelKeys = this.userChannels.get(userId);
    if (!userChannelKeys) return;

    console.log(`🧹 Cleaning up all channels for user ${userId.slice(-8)}`);
    
    Array.from(userChannelKeys).forEach(channelKey => {
      this.unsubscribe(channelKey, userId);
    });
    
    this.userChannels.delete(userId);
  }

  // Otomatik temizlik
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveChannels();
    }, 30 * 1000); // 30 saniyede bir
  }

  private cleanupInactiveChannels(): void {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5 dakika
    
    for (const [channelKey, channelInfo] of this.channels) {
      if (now - channelInfo.lastActivity > inactiveThreshold) {
        console.log(`🗑️ Cleaning up inactive channel: ${channelKey}`);
        this.cleanupChannel(channelKey);
      }
    }
  }

  private cleanupChannel(channelKey: string): void {
    const channelInfo = this.channels.get(channelKey);
    if (!channelInfo) return;

    try {
      supabase.removeChannel(channelInfo.channel);
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

  // Manual cleanup
  forceCleanupAll(): void {
    console.log('🧹 Force cleaning up ALL channels...');
    
    for (const [channelKey] of this.channels) {
      this.cleanupChannel(channelKey);
    }
    
    this.userChannels.clear();
    this.channels.clear();
  }

  // Component unmount'da çağrılacak
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
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
    
    const channel = realtimeManager.subscribe(table, userId, filter, callback);
    
    return () => {
      if (channel) {
        realtimeManager.unsubscribe(channelKey, userId);
      }
    };
  }, [table, userId, filter, channelKey]);
  
  // Component unmount'da user'ın tüm subscription'larını temizle
  React.useEffect(() => {
    return () => {
      realtimeManager.unsubscribeAll(userId);
    };
  }, [userId]);
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