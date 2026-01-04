import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel, REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";

interface ReconnectConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

const DEFAULT_CONFIG: Required<ReconnectConfig> = {
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 30000,
};

class SupabaseAutoReconnect {
  private channels: Map<string, {
    channel: RealtimeChannel;
    setupFn: () => RealtimeChannel;
    retryCount: number;
    reconnecting: boolean;
  }> = new Map();
  
  private config: Required<ReconnectConfig>;
  private isOnline: boolean = navigator.onLine;
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: ReconnectConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupNetworkListeners();
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('[AutoReconnect] Network came online, reconnecting all channels...');
      this.isOnline = true;
      this.reconnectAllChannels();
    });

    window.addEventListener('offline', () => {
      console.log('[AutoReconnect] Network went offline');
      this.isOnline = false;
    });

    // NOT: visibility change listener kaldırıldı - ConnectionContext yönetiyor
  }

  /**
   * Register a channel with auto-reconnect capability
   */
  registerChannel(
    channelName: string,
    setupFn: () => RealtimeChannel
  ): RealtimeChannel {
    // Clean up existing channel if any
    this.unregisterChannel(channelName);

    const channel = setupFn();
    
    this.channels.set(channelName, {
      channel,
      setupFn,
      retryCount: 0,
      reconnecting: false,
    });

    // Monitor channel state
    this.setupChannelMonitoring(channelName);
    
    // Start heartbeat for this channel
    this.startHeartbeat(channelName);

    return channel;
  }

  private setupChannelMonitoring(channelName: string) {
    const entry = this.channels.get(channelName);
    if (!entry) return;

    // Override the channel's error handling
    const originalSubscribe = entry.channel.subscribe.bind(entry.channel);
    
    entry.channel.subscribe = (callback?: (status: REALTIME_SUBSCRIBE_STATES, err?: Error) => void, timeout?: number) => {
      return originalSubscribe((status: REALTIME_SUBSCRIBE_STATES, err?: Error) => {
        console.log(`[AutoReconnect] Channel ${channelName} status: ${status}`);
        
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log(`[AutoReconnect] Channel ${channelName} error detected, attempting silent reconnect...`);
          this.silentReconnect(channelName);
        } else if (status === 'SUBSCRIBED') {
          // Reset retry count on successful subscription
          const currentEntry = this.channels.get(channelName);
          if (currentEntry) {
            currentEntry.retryCount = 0;
            currentEntry.reconnecting = false;
          }
        }
        
        callback?.(status, err);
      });
    };
  }

  // ⚠️ DEVRE DIŞI: silentReconnect - removeChannel çağırıyor ve bağlantıyı öldürüyordu
  private async silentReconnect(channelName: string) {
    console.log(`[AutoReconnect] ⚠️ silentReconnect DEVRE DIŞI: ${channelName} (bağlantı koruması)`);
    
    const entry = this.channels.get(channelName);
    if (!entry) return;
    
    // Sadece kanal state'ini kontrol et ve subscribe çağır (removeChannel YOK)
    if (entry.channel.state !== 'joined' && entry.channel.state !== 'joining') {
      try {
        entry.channel.subscribe();
        console.log(`[AutoReconnect] ✅ Kanal resubscribe denendi: ${channelName}`);
      } catch (e) {
        console.log(`[AutoReconnect] ⚠️ Resubscribe hatası: ${channelName}`, e);
      }
    }
  }

  private startHeartbeat(channelName: string) {
    // Clear existing heartbeat if any
    const existingInterval = this.heartbeatIntervals.get(channelName);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Check connection health every 30 seconds
    const interval = setInterval(() => {
      const entry = this.channels.get(channelName);
      if (!entry) {
        clearInterval(interval);
        this.heartbeatIntervals.delete(channelName);
        return;
      }

      // Check if channel is still healthy
      const state = entry.channel.state;
      if (state !== 'joined' && state !== 'joining' && !entry.reconnecting) {
        console.log(`[AutoReconnect] Heartbeat detected unhealthy channel ${channelName} (state: ${state})`);
        this.silentReconnect(channelName);
      }
    }, 30000);

    this.heartbeatIntervals.set(channelName, interval);
  }

  private async reconnectAllChannels() {
    const promises = Array.from(this.channels.keys()).map(channelName => 
      this.silentReconnect(channelName)
    );
    await Promise.all(promises);
  }

  private async checkAndReconnectAll() {
    for (const [channelName, entry] of this.channels) {
      const state = entry.channel.state;
      if (state !== 'joined' && state !== 'joining' && !entry.reconnecting) {
        this.silentReconnect(channelName);
      }
    }
  }

  // ⚠️ DEVRE DIŞI: unregisterChannel - removeChannel çağırıyor
  unregisterChannel(channelName: string) {
    console.log(`[AutoReconnect] ⚠️ unregisterChannel DEVRE DIŞI: ${channelName} (bağlantı koruması)`);
    // ❌ DEVRE DIŞI: removeChannel - bağlantıyı öldürüyordu
    // const entry = this.channels.get(channelName);
    // if (entry) {
    //   supabase.removeChannel(entry.channel);
    //   this.channels.delete(channelName);
    // }

    const interval = this.heartbeatIntervals.get(channelName);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(channelName);
    }
  }

  /**
   * Get current channel by name
   */
  getChannel(channelName: string): RealtimeChannel | null {
    return this.channels.get(channelName)?.channel || null;
  }

  /**
   * Cleanup all channels
   */
  destroy() {
    for (const channelName of this.channels.keys()) {
      this.unregisterChannel(channelName);
    }
  }
}

// Singleton instance
export const autoReconnect = new SupabaseAutoReconnect();

// Hook for React components
export const useAutoReconnectChannel = (
  channelName: string,
  setupFn: () => RealtimeChannel,
  deps: any[] = []
) => {
  const channelRef = { current: null as RealtimeChannel | null };

  // This should be used inside useEffect in the component
  const register = () => {
    channelRef.current = autoReconnect.registerChannel(channelName, setupFn);
    return () => {
      autoReconnect.unregisterChannel(channelName);
    };
  };

  return { register, getChannel: () => channelRef.current };
};
