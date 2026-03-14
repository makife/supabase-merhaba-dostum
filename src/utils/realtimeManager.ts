import React from 'react';
import { getSupabaseClient } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * 🏗️ Production-Grade Realtime Channel Manager
 * 
 * 1000+ eşzamanlı kullanıcı için tasarlandı.
 * 
 * Özellikler:
 * - Benzersiz kanal isimleri (çakışma yok)
 * - Otomatik stale channel temizleme
 * - Hard limit enforcement (Supabase bağlantı limiti)
 * - Presence kanalları dahil tüm kanallar merkezi yönetim
 * - Lifecycle logging (debug/production)
 * - Graceful degradation
 */

interface ChannelEntry {
  channel: RealtimeChannel;
  key: string;           // Unique channel key
  owner: string;         // userId
  roomId?: string;       // Associated room (for room-scoped cleanup)
  table?: string;        // For postgres_changes
  filter?: string;
  type: 'postgres' | 'presence' | 'broadcast' | 'custom';
  createdAt: number;
  lastActivity: number;
  status: 'creating' | 'subscribed' | 'error' | 'closed';
}

interface ManagerStats {
  totalCreated: number;
  totalCleaned: number;
  totalRejected: number;
  totalErrors: number;
}

// Supabase free tier: ~100 concurrent channels per connection
// We stay well under to leave room for other subscriptions
const MAX_CHANNELS_PER_USER = 12;
const MAX_TOTAL_CHANNELS = 50; // Per client instance
const STALE_CHANNEL_MS = 5 * 60 * 1000; // 5 min inactive → stale
const CLEANUP_INTERVAL_MS = 30 * 1000; // Check every 30s

class RealtimeManager {
  private channels = new Map<string, ChannelEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private stats: ManagerStats = {
    totalCreated: 0,
    totalCleaned: 0,
    totalRejected: 0,
    totalErrors: 0,
  };

  constructor() {
    this.startAutoCleanup();
    this.listenForReconnect();
  }

  // ─── PUBLIC API ───────────────────────────────────

  /**
   * Postgres changes subscription oluştur/yeniden kullan.
   * Aynı table+filter+userId için mevcut kanal varsa onu döndürür.
   */
  subscribe(
    table: string,
    userId: string,
    filter?: string,
    callback?: (payload: any) => void,
    roomId?: string
  ): RealtimeChannel | null {
    const reuseKey = this.buildReuseKey('postgres', table, filter);

    // Mevcut aktif kanalı kontrol et
    const existing = this.findReusable(reuseKey, userId);
    if (existing) {
      existing.lastActivity = Date.now();
      this.log('♻️', `Reusing channel: ${reuseKey}`, userId);
      return existing.channel;
    }

    // Limit kontrolü
    if (!this.ensureCapacity(userId)) {
      this.stats.totalRejected++;
      this.log('🚫', `Capacity exceeded, force-cleaning oldest`, userId);
      this.evictOldest(userId, 3);
    }

    // Benzersiz kanal adı (Supabase internal collision önleme)
    const uniqueName = `${reuseKey}-${this.uid()}`;
    const client = getSupabaseClient();
    const channel = client.channel(uniqueName);

    if (callback) {
      const changeConfig: any = {
        event: '*',
        schema: 'public',
        table,
      };
      if (filter) changeConfig.filter = filter;
      channel.on('postgres_changes', changeConfig, callback);
    }

    const entry: ChannelEntry = {
      channel,
      key: reuseKey,
      owner: userId,
      roomId: roomId || this.extractRoomId(filter),
      table,
      filter,
      type: 'postgres',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      status: 'creating',
    };

    const entryId = uniqueName;
    this.channels.set(entryId, entry);
    this.stats.totalCreated++;

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        entry.status = 'subscribed';
        this.log('✅', `Subscribed: ${reuseKey}`, userId);
      } else if (status === 'CHANNEL_ERROR') {
        entry.status = 'error';
        this.stats.totalErrors++;
        this.log('❌', `Error: ${reuseKey}`, userId, err);
        // Error olan kanalı kaldır, yenisi oluşturulsun
        this.destroyEntry(entryId);
      } else if (status === 'TIMED_OUT') {
        entry.status = 'error';
        this.log('⏰', `Timeout: ${reuseKey}`, userId);
        this.destroyEntry(entryId);
      }
    });

    this.log('🆕', `Created: ${reuseKey} (total: ${this.channels.size})`, userId);
    return channel;
  }

  /**
   * Presence kanalı oluştur. Her oda için benzersiz.
   */
  createPresenceChannel(
    roomId: string,
    userId: string,
    presenceKey: string
  ): RealtimeChannel | null {
    const reuseKey = this.buildReuseKey('presence', roomId);

    // Mevcut presence kanalı varsa yeniden kullan
    const existing = this.findReusable(reuseKey, userId);
    if (existing) {
      existing.lastActivity = Date.now();
      this.log('♻️', `Reusing presence: ${reuseKey}`, userId);
      return existing.channel;
    }

    if (!this.ensureCapacity(userId)) {
      this.evictOldest(userId, 2);
    }

    const uniqueName = `presence-${roomId}-${this.uid()}`;
    const client = getSupabaseClient();
    const channel = client.channel(uniqueName, {
      config: { presence: { key: presenceKey } },
    });

    const entry: ChannelEntry = {
      channel,
      key: reuseKey,
      owner: userId,
      roomId,
      type: 'presence',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      status: 'creating',
    };

    this.channels.set(uniqueName, entry);
    this.stats.totalCreated++;

    this.log('🆕', `Presence created: ${roomId.slice(-8)}`, userId);
    return channel;
  }

  /**
   * Belirli bir room'a ait TÜM kanalları temizle.
   * Oda değiştiğinde / rematch'te / oyun bittiğinde çağrılır.
   */
  cleanupRoom(roomId: string, userId?: string): number {
    if (!roomId) return 0;

    const toRemove: string[] = [];

    for (const [id, entry] of this.channels) {
      // Room ID eşleşmesi (doğrudan veya filter içinde)
      const matchesRoom = entry.roomId === roomId || entry.filter?.includes(roomId);
      const matchesUser = !userId || entry.owner === userId;

      if (matchesRoom && matchesUser) {
        toRemove.push(id);
      }
    }

    if (toRemove.length === 0) return 0;

    this.log('🧹', `Room cleanup: ${roomId.slice(-8)} → ${toRemove.length} channels`, userId);

    for (const id of toRemove) {
      this.destroyEntry(id);
    }

    return toRemove.length;
  }

  /**
   * Belirli bir kullanıcının TÜM kanallarını temizle.
   * Logout / tam sayfa değişimi için.
   */
  cleanupUser(userId: string): number {
    if (!userId) return 0;

    const toRemove: string[] = [];
    for (const [id, entry] of this.channels) {
      if (entry.owner === userId) toRemove.push(id);
    }

    for (const id of toRemove) {
      this.destroyEntry(id);
    }

    this.log('🧹', `User cleanup: ${toRemove.length} channels`, userId);
    return toRemove.length;
  }

  /**
   * Tek bir kanalı kaldır (channel referansı ile).
   */
  removeByChannel(channel: RealtimeChannel): void {
    for (const [id, entry] of this.channels) {
      if (entry.channel === channel) {
        this.destroyEntry(id);
        return;
      }
    }
    // Manager'da değilse direkt Supabase'den kaldır
    try {
      getSupabaseClient().removeChannel(channel);
    } catch (e) { /* ignore */ }
  }

  /**
   * TÜM kanalları temizle. Logout / app destroy için.
   */
  forceCleanupAll(): void {
    const count = this.channels.size;
    if (count === 0) return;

    this.log('💥', `Force cleanup ALL: ${count} channels`);

    for (const [id] of this.channels) {
      this.destroyEntry(id);
    }

    this.channels.clear();
  }

  /**
   * Debug stats
   */
  getStats() {
    const byUser = new Map<string, number>();
    const byType = new Map<string, number>();
    const byStatus = new Map<string, number>();

    for (const entry of this.channels.values()) {
      byUser.set(entry.owner, (byUser.get(entry.owner) || 0) + 1);
      byType.set(entry.type, (byType.get(entry.type) || 0) + 1);
      byStatus.set(entry.status, (byStatus.get(entry.status) || 0) + 1);
    }

    return {
      ...this.stats,
      activeChannels: this.channels.size,
      byUser: Object.fromEntries(byUser),
      byType: Object.fromEntries(byType),
      byStatus: Object.fromEntries(byStatus),
    };
  }

  destroy(): void {
    this.forceCleanupAll();
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // ─── INTERNAL ─────────────────────────────────────

  private destroyEntry(entryId: string): void {
    const entry = this.channels.get(entryId);
    if (!entry) return;

    try {
      // Presence kanallarını untrack et
      if (entry.type === 'presence') {
        try { entry.channel.untrack(); } catch { /* ignore */ }
      }
      getSupabaseClient().removeChannel(entry.channel);
    } catch (e) {
      // Hata olsa bile map'ten kaldır
      this.log('⚠️', `Destroy error (non-fatal): ${entry.key}`, entry.owner);
    }

    this.channels.delete(entryId);
    entry.status = 'closed';
    this.stats.totalCleaned++;
  }

  private findReusable(reuseKey: string, userId: string): ChannelEntry | null {
    for (const entry of this.channels.values()) {
      if (
        entry.key === reuseKey &&
        entry.owner === userId &&
        entry.status !== 'error' &&
        entry.status !== 'closed'
      ) {
        return entry;
      }
    }
    return null;
  }

  private ensureCapacity(userId: string): boolean {
    // User limit
    let userCount = 0;
    for (const entry of this.channels.values()) {
      if (entry.owner === userId) userCount++;
    }
    if (userCount >= MAX_CHANNELS_PER_USER) return false;

    // Total limit
    if (this.channels.size >= MAX_TOTAL_CHANNELS) {
      this.evictStale();
      return this.channels.size < MAX_TOTAL_CHANNELS;
    }

    return true;
  }

  /** En eski N kanalı zorla kaldır */
  private evictOldest(userId: string, count: number): void {
    const userEntries: Array<{ id: string; lastActivity: number }> = [];

    for (const [id, entry] of this.channels) {
      if (entry.owner === userId) {
        userEntries.push({ id, lastActivity: entry.lastActivity });
      }
    }

    userEntries.sort((a, b) => a.lastActivity - b.lastActivity);

    const toEvict = userEntries.slice(0, count);
    for (const { id } of toEvict) {
      this.log('🗑️', `Evicting oldest: ${id}`, userId);
      this.destroyEntry(id);
    }
  }

  /** Stale (5 dk inaktif) kanalları temizle */
  private evictStale(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, entry] of this.channels) {
      if (now - entry.lastActivity > STALE_CHANNEL_MS) {
        toRemove.push(id);
      }
    }

    if (toRemove.length > 0) {
      this.log('🧹', `Stale cleanup: ${toRemove.length} channels`);
      for (const id of toRemove) {
        this.destroyEntry(id);
      }
    }
  }

  private startAutoCleanup(): void {
    if (typeof window === 'undefined') return;

    this.cleanupTimer = setInterval(() => {
      this.evictStale();

      // Error durumundaki kanalları temizle
      for (const [id, entry] of this.channels) {
        if (entry.status === 'error' || entry.status === 'closed') {
          this.destroyEntry(id);
        }
      }
    }, CLEANUP_INTERVAL_MS);
  }

  private listenForReconnect(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('supabase-reconnected', () => {
      this.log('🔄', `Reconnect detected. Active: ${this.channels.size}`);
      // Mark all as stale so they get recreated on next subscribe call
      for (const entry of this.channels.values()) {
        entry.status = 'error';
      }
      // Clean error channels
      for (const [id, entry] of this.channels) {
        if (entry.status === 'error') {
          this.destroyEntry(id);
        }
      }
    });
  }

  private buildReuseKey(type: string, ...parts: (string | undefined)[]): string {
    return [type, ...parts.filter(Boolean)].join(':');
  }

  private extractRoomId(filter?: string): string | undefined {
    if (!filter) return undefined;
    // "room_id=eq.UUID" or "id=eq.UUID" patterns
    const match = filter.match(/(?:room_id|id)=eq\.([a-f0-9-]+)/i);
    return match?.[1];
  }

  private uid(): string {
    return Math.random().toString(36).slice(2, 8);
  }

  private log(icon: string, msg: string, userId?: string, extra?: any): void {
    const userTag = userId ? ` [${userId.slice(-6)}]` : '';
    const prefix = `${icon} [RM]${userTag}`;
    if (extra) {
      console.log(prefix, msg, extra);
    } else {
      console.log(prefix, msg);
    }
  }
}

// ─── Singleton ──────────────────────────────────────

export const realtimeManager = new RealtimeManager();

// ─── React Hooks ────────────────────────────────────

/**
 * Optimized postgres_changes subscription hook.
 * Unmount'ta kanalı temizler.
 */
export const useOptimizedSubscription = (
  table: string,
  userId: string,
  filter?: string,
  callback?: (payload: any) => void,
  roomId?: string
) => {
  const channelRef = React.useRef<RealtimeChannel | null>(null);

  React.useEffect(() => {
    if (!userId || !callback) return;

    const ch = realtimeManager.subscribe(table, userId, filter, callback, roomId);
    channelRef.current = ch;

    return () => {
      // Unmount'ta kanalı temizle
      if (channelRef.current) {
        realtimeManager.removeByChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, userId, filter, roomId]);
};

/** Performance monitoring hook */
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

// ─── Legacy compatibility ───────────────────────────

// cleanupChannelsForRoom → cleanupRoom alias
Object.defineProperty(realtimeManager, 'cleanupChannelsForRoom', {
  value: (roomId: string, userId: string) => realtimeManager.cleanupRoom(roomId, userId),
});

// ─── Global debug access ────────────────────────────

declare global {
  interface Window {
    realtimeManager: RealtimeManager;
  }
}

if (typeof window !== 'undefined') {
  window.realtimeManager = realtimeManager;
}
