import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { RealtimeChannel } from '@supabase/supabase-js';

interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  lastConnectedAt: Date | null;
  reconnectAttempts: number;
  channelHealth: Map<string, 'healthy' | 'unhealthy' | 'reconnecting'>;
}

interface ConnectionContextType {
  state: ConnectionState;
  reconnect: () => Promise<boolean>;
  registerChannel: (name: string, channel: RealtimeChannel) => void;
  unregisterChannel: (name: string) => void;
  isHealthy: boolean;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

// Retry queue for failed operations
interface QueuedOperation {
  id: string;
  operation: () => Promise<any>;
  retries: number;
}

export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ConnectionState>({
    isConnected: true,
    isReconnecting: false,
    lastConnectedAt: new Date(),
    reconnectAttempts: 0,
    channelHealth: new Map(),
  });

  const isNative = Capacitor.isNativePlatform();
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const operationQueue = useRef<QueuedOperation[]>([]);
  const isProcessingQueue = useRef(false);
  const consecutiveFailures = useRef(0);

  // Health check - verify connection with a lightweight operation
  const performHealthCheck = useCallback(async (): Promise<boolean> => {
    try {
      // Use RPC call for accurate health check (server time is lightweight)
      const { error } = await supabase.rpc('get_server_time');
      
      if (error) {
        consecutiveFailures.current++;
        return false;
      }
      
      consecutiveFailures.current = 0;
      return true;
    } catch (e) {
      consecutiveFailures.current++;
      console.log('[Connection] Health check failed:', e);
      return false;
    }
  }, []);

  // Check all channel health
  const checkChannelHealth = useCallback(() => {
    const newHealth = new Map<string, 'healthy' | 'unhealthy' | 'reconnecting'>();
    
    for (const [name, channel] of channelsRef.current) {
      const channelState = channel.state;
      
      if (channelState === 'joined') {
        newHealth.set(name, 'healthy');
      } else if (channelState === 'joining') {
        newHealth.set(name, 'reconnecting');
      } else {
        newHealth.set(name, 'unhealthy');
      }
    }
    
    setState(prev => ({
      ...prev,
      channelHealth: newHealth,
    }));
    
    return newHealth;
  }, []);

  // Reconnect all unhealthy channels
  const reconnectUnhealthyChannels = useCallback(async () => {
    const health = checkChannelHealth();
    
    for (const [name, status] of health) {
      if (status === 'unhealthy') {
        const channel = channelsRef.current.get(name);
        if (channel) {
          console.log(`[Connection] Reconnecting channel: ${name}`);
          try {
            // Unsubscribe and resubscribe
            await supabase.removeChannel(channel);
            channelsRef.current.delete(name);
          } catch (e) {
            console.log(`[Connection] Failed to reconnect ${name}:`, e);
          }
        }
      }
    }
  }, [checkChannelHealth]);

  // Main reconnection logic
  const reconnect = useCallback(async (): Promise<boolean> => {
    if (state.isReconnecting) return false;
    
    setState(prev => ({ ...prev, isReconnecting: true }));
    
    console.log('[Connection] Starting reconnection...');
    
    try {
      // Step 1: Check basic connectivity
      const isHealthy = await performHealthCheck();
      
      if (!isHealthy) {
        // Try to refresh auth session
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          console.log('[Connection] Session refresh failed:', error.message);
        }
      }
      
      // Step 2: Reconnect unhealthy channels
      await reconnectUnhealthyChannels();
      
      // Step 3: Process queued operations
      await processQueue();
      
      const finalHealth = await performHealthCheck();
      
      setState(prev => ({
        ...prev,
        isConnected: finalHealth,
        isReconnecting: false,
        lastConnectedAt: finalHealth ? new Date() : prev.lastConnectedAt,
        reconnectAttempts: finalHealth ? 0 : prev.reconnectAttempts + 1,
      }));
      
      if (finalHealth) {
        console.log('[Connection] Reconnection successful');
      }
      
      return finalHealth;
    } catch (e) {
      console.log('[Connection] Reconnection error:', e);
      setState(prev => ({
        ...prev,
        isReconnecting: false,
        reconnectAttempts: prev.reconnectAttempts + 1,
      }));
      return false;
    }
  }, [state.isReconnecting, performHealthCheck, reconnectUnhealthyChannels]);

  // Process queued operations
  const processQueue = useCallback(async () => {
    if (isProcessingQueue.current || operationQueue.current.length === 0) return;
    
    isProcessingQueue.current = true;
    
    while (operationQueue.current.length > 0) {
      const op = operationQueue.current[0];
      
      try {
        await op.operation();
        operationQueue.current.shift(); // Remove successful operation
      } catch (e) {
        op.retries++;
        if (op.retries >= 3) {
          operationQueue.current.shift(); // Remove after max retries
        }
        break; // Stop processing on error
      }
    }
    
    isProcessingQueue.current = false;
  }, []);

  // Register a channel for health monitoring
  const registerChannel = useCallback((name: string, channel: RealtimeChannel) => {
    channelsRef.current.set(name, channel);
    setState(prev => {
      const newHealth = new Map(prev.channelHealth);
      newHealth.set(name, 'healthy');
      return { ...prev, channelHealth: newHealth };
    });
  }, []);

  // Unregister a channel
  const unregisterChannel = useCallback((name: string) => {
    channelsRef.current.delete(name);
    setState(prev => {
      const newHealth = new Map(prev.channelHealth);
      newHealth.delete(name);
      return { ...prev, channelHealth: newHealth };
    });
  }, []);

  // Heartbeat - check connection every 10 seconds
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    
    heartbeatRef.current = setInterval(async () => {
      const isHealthy = await performHealthCheck();
      
      // Check channel health too
      checkChannelHealth();
      
      if (!isHealthy && consecutiveFailures.current >= 2) {
        // Only reconnect after 2 consecutive failures
        console.log('[Connection] Multiple failures detected, reconnecting...');
        reconnect();
      }
      
      setState(prev => ({
        ...prev,
        isConnected: isHealthy || consecutiveFailures.current < 2,
      }));
    }, 10000); // 10 second heartbeat
  }, [performHealthCheck, checkChannelHealth, reconnect]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // Setup listeners
  useEffect(() => {
    // Initial health check
    performHealthCheck().then(isHealthy => {
      setState(prev => ({ ...prev, isConnected: isHealthy }));
    });
    
    // Start heartbeat
    startHeartbeat();
    
    // Network status listeners (web)
    const handleOnline = () => {
      console.log('[Connection] Network online');
      setTimeout(() => reconnect(), 1000);
    };
    
    const handleOffline = () => {
      console.log('[Connection] Network offline');
      setState(prev => ({ ...prev, isConnected: false }));
    };
    
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Connection] App visible');
        setTimeout(() => {
          performHealthCheck().then(isHealthy => {
            if (!isHealthy) reconnect();
          });
        }, 500);
      }
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    
    // Native app state listener
    let appStateListener: any = null;
    
    if (isNative) {
      const setupNativeListener = async () => {
        appStateListener = await App.addListener('appStateChange', async ({ isActive }) => {
          if (isActive) {
            console.log('[Connection] App became active');
            // Wait for OS to restore network
            setTimeout(async () => {
              const isHealthy = await performHealthCheck();
              if (!isHealthy) {
                await reconnect();
              }
              startHeartbeat();
            }, 1500);
          } else {
            console.log('[Connection] App went to background');
            stopHeartbeat();
          }
        });
      };
      
      setupNativeListener();
    }
    
    return () => {
      stopHeartbeat();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (appStateListener) {
        appStateListener.remove();
      }
    };
  }, [isNative, performHealthCheck, reconnect, startHeartbeat, stopHeartbeat]);

  const isHealthy = state.isConnected && !state.isReconnecting;

  return (
    <ConnectionContext.Provider value={{
      state,
      reconnect,
      registerChannel,
      unregisterChannel,
      isHealthy,
    }}>
      {children}
    </ConnectionContext.Provider>
  );
};

export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within ConnectionProvider');
  }
  return context;
};

// Helper hook for components that need connection status
export const useConnectionStatus = () => {
  const { state, isHealthy } = useConnection();
  return {
    isConnected: state.isConnected,
    isReconnecting: state.isReconnecting,
    isHealthy,
  };
};
