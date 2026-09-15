import { Client, Session, Socket } from '@heroiclabs/nakama-js';
import { supabase } from '@/integrations/supabase/client';

interface MatchTicket {
  ticket: string;
}

interface MatchData {
  matchId: string;
  token: string;
  players: any[];
}

class NakamaService {
  private client: Client | null = null;
  private session: Session | null = null;
  private socket: Socket | null = null;
  private isInitialized: boolean = false;
  private useSSL: boolean = false;
  // Keep last joined match info to avoid re-joining issues across pages
  private lastMatchId: string | null = null;
  private lastJoinToken: string | null = null;
  constructor() {
    console.log("🚀 Nakama Service created, will initialize on first use");
  }

private async initializeClient(): Promise<void> {
  if (this.isInitialized && this.client) {
    return;
  }

  try {
    console.log("🔧 Initializing Nakama client...");
    
    const { data: configData, error: configError } = await supabase.functions.invoke('nakama-config');
    
    if (configError || !configData?.config) {
      console.error("❌ Failed to fetch Nakama config:", configError);
      throw new Error("Could not fetch Nakama configuration");
    }

    const config = configData.config;
    
    console.log("📡 Nakama config received:", {
      host: config.host,
      port: config.port,
      useSSL: config.useSSL
    });

    // useSSL config'den gelir
    this.client = new Client(
      config.serverKey,     // 1. serverKey
      config.host,          // 2. host (protokol YOK)
      config.port,          // 3. port
      config.useSSL         // 4. useSSL - WSS için config'e göre
    );

    this.useSSL = !!config.useSSL;

    console.log("✅ Nakama client initialized with SSL");
    this.isInitialized = true;
  } catch (error) {
    console.error("❌ Failed to initialize Nakama client:", error);
    throw error;
  }
}

  async authenticate(userId: string): Promise<Session> {
    try {
      await this.initializeClient();
      console.log("🔐 Nakama auth via Edge Function for:", userId);
      
      if (!this.client) {
        throw new Error("Client not initialized");
      }

      const { data, error } = await (supabase.functions as any).invoke('nakama-auth', {
        body: { deviceId: userId }
      });

      if (error) {
        console.error("❌ Edge function error:", error);
        throw error;
      }
      if (!data?.token) {
        throw new Error("Nakama auth failed: no token received");
      }

      const minimalSession: any = {
        token: data.token,
        refresh_token: data.refresh_token,
        created: true,
        created_at: Math.floor(Date.now() / 1000),
        expires_at: (() => {
          try {
            const parts = String(data.token).split('.');
            const payload = JSON.parse(atob(parts[1] || ''));
            return payload?.exp ?? Math.floor(Date.now() / 1000) + 3600;
          } catch {
            return Math.floor(Date.now() / 1000) + 3600;
          }
        })(),
        isexpired: function () { return Math.floor(Date.now() / 1000) >= this.expires_at; },
        canrefresh: function () { return !!this.refresh_token; },
        user_id: data.user_id ?? userId,
        username: data.username ?? '',
        vars: data.vars ?? {}
      };

      this.session = minimalSession as Session;
      console.log("✅ Nakama authentication via Edge successful");
      return this.session;
    } catch (error) {
      console.error("❌ Nakama authentication failed (edge):", error);
      throw error;
    }
  }

async createSocket(): Promise<Socket> {
  try {
    console.log("🔌 Creating Nakama WebSocket...");
    
    // Eğer zaten bağlantı varsa, önce kapat
    if (this.socket) {
      console.log("⚠️ Mevcut socket bulundu, kapatılıyor...");
      try {
        this.socket.disconnect();
      } catch (e) {
        console.warn("Old socket disconnect error:", e);
      }
      this.socket = null;
    }
    
    if (!this.session) {
      throw new Error("Must authenticate before creating socket");
    }
    
    if (!this.client) {
      throw new Error("Client not initialized");
    }
    
    // SSL tercihini açıkça ilet
    this.socket = this.client.createSocket(this.useSSL, false);
    
    console.log("🔗 Connecting to Nakama WebSocket...");
    await this.socket.connect(this.session);
    
    console.log("✅ Nakama WebSocket connected");
    return this.socket;
  } catch (error) {
    console.error("❌ Nakama WebSocket creation failed:", error);
    throw error;
  }
}

  async findMatch(gameType: 'timed' | 'score'): Promise<{ ticket: string }> {
    try {
      console.log("🎯 Starting Nakama matchmaking for:", gameType);
      
      if (!this.socket) {
        throw new Error("Socket not connected");
      }

      // Nakama matchmaking - DOĞRU PARAMETRELER
      // min=2, max=2: Tam 2 oyuncu eşleşmesi gerekiyor
      // query ile game_type filtresi ekliyoruz, aynı tipteki oyuncuları eşleştir
      const ticket = await this.socket.addMatchmaker(
        `+properties.game_type:${gameType}`,  // query - sadece aynı game_type'dakilerle eşleş
        2,    // minCount - minimum 2 oyuncu
        2,    // maxCount - maksimum 2 oyuncu
        {
          "game_type": gameType,  // Aynı oyun tipinde olanları eşleştir
        }
      );
      
      console.log("✅ Nakama matchmaking ticket created:", ticket.ticket);
      return { ticket: ticket.ticket };
    } catch (error) {
      console.error("❌ Nakama matchmaking failed:", error);
      throw error;
    }
  }

  async cancelMatchmaking(ticket: string): Promise<void> {
    try {
      console.log("❌ Cancelling Nakama matchmaking:", ticket);
      
      if (!this.socket) {
        throw new Error("Socket not connected");
      }

      await this.socket.removeMatchmaker(ticket);
      console.log("✅ Nakama matchmaking cancelled");
    } catch (error) {
      console.error("❌ Failed to cancel matchmaking:", error);
      throw error;
    }
  }

  disconnect(): void {
    console.log("🔌 Disconnecting Nakama socket...");
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.session = null;
    this.lastMatchId = null;
    this.lastJoinToken = null;
    console.log("✅ Nakama disconnected");
  }

  async createPrivateRoom(gameType: 'timed' | 'score'): Promise<string> {
    try {
      if (!this.socket) {
        throw new Error("Socket not connected");
      }

      console.log("🏠 Creating private match...");
      const match = await this.socket.createMatch();
      const cleanMatchId = match.match_id.endsWith('.') ? match.match_id.slice(0, -1) : match.match_id;
      
      console.log("✅ Private match created (host auto-joined):", cleanMatchId);
      
      // createMatch çağrıldığında host otomatik olarak match'e katılır
      // Tekrar joinMatch çağırmaya gerek yok
      
      // Last match bilgisini kaydet
      this.setLastMatch({ id: cleanMatchId });
      
      return cleanMatchId;
    } catch (error) {
      console.error("❌ Failed to create private room:", error);
      throw error;
    }
  }

  async joinPrivateRoom(roomCode: string): Promise<string> {
    // Keep a reference accessible in catch for fallback logic
    let matchIdToJoin = roomCode.endsWith('.') ? roomCode.slice(0, -1) : roomCode;
    try {
      if (!this.socket) {
        throw new Error("Socket not connected");
      }

      // If a short 6-char code was provided, resolve it to the real match (game_rooms.id)
      const isShortCode = /^[A-Z0-9]{6}$/.test(matchIdToJoin);
      if (isShortCode) {
        const { data: roomByCode, error: lookupError } = await supabase
          .from('game_rooms')
          .select('id')
          .eq('room_code', matchIdToJoin)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lookupError) {
          console.warn('⚠️ Room code lookup failed, trying to join with code directly:', lookupError);
        }
        if (roomByCode?.id) {
          matchIdToJoin = roomByCode.id;
          console.log('🔑 Room code resolved to match id:', matchIdToJoin);
        }
      }

      console.log("🚪 Joining private match:", matchIdToJoin);
      const joinResult = await this.socket.joinMatch(matchIdToJoin);
      const actualMatchIdRaw = joinResult.match_id || matchIdToJoin;
      const actualMatchId = actualMatchIdRaw.endsWith('.') ? actualMatchIdRaw.slice(0, -1) : actualMatchIdRaw;

      console.log("✅ Joined private room:", actualMatchId);

      // Last match bilgisini kaydet
      this.setLastMatch({ id: actualMatchId });

      return actualMatchId;
    } catch (error: any) {
      // If invalid match id, try with trailing dot (some servers return IDs with a trailing '.')
      if (error?.message === 'Invalid match ID' || (typeof error?.message === 'string' && error.message.includes('Invalid match ID'))) {
        try {
          const fallbackId = matchIdToJoin.endsWith('.') ? matchIdToJoin : `${matchIdToJoin}.`;
          console.warn('⚠️ Invalid match id, retrying with trailing dot:', fallbackId);
          const joinResult2 = await this.socket!.joinMatch(fallbackId);
          const actualMatchIdRaw2 = joinResult2.match_id || fallbackId;
          const actualMatchId2 = actualMatchIdRaw2.endsWith('.') ? actualMatchIdRaw2.slice(0, -1) : actualMatchIdRaw2;
          console.log('✅ Joined private room on fallback:', actualMatchId2);
          this.setLastMatch({ id: actualMatchId2 });
          return actualMatchId2;
        } catch (e2) {
          console.error('❌ Fallback join failed:', e2);
        }
      }
      console.error("❌ Failed to join private room:", error);
      throw error;
    }
  }

  async createTournament(name: string, maxPlayers: number = 8): Promise<string> {
    try {
      if (!this.socket) {
        throw new Error("Socket not connected");
      }

      // Nakama'da tournament yerine özel bir match oluştur
      const match = await this.socket.createMatch();
      const tournamentId = match.match_id.endsWith('.') ? match.match_id.slice(0, -1) : match.match_id;
      
      console.log("✅ Tournament match created:", tournamentId);
      return tournamentId;
    } catch (error) {
      console.error("❌ Failed to create tournament:", error);
      throw error;
    }
  }

  async joinTournament(tournamentId: string): Promise<void> {
    try {
      if (!this.socket) {
        throw new Error("Socket not connected");
      }

      // Tournament match'e katıl
      await this.socket.joinMatch(tournamentId);
      console.log("✅ Joined tournament match:", tournamentId);
    } catch (error) {
      console.error("❌ Failed to join tournament:", error);
      throw error;
    }
  }

  async listTournaments(): Promise<any[]> {
    try {
      // Nakama'nın tournament API'si olmadığı için boş liste döndür
      console.log("⚠️ Nakama tournament API not available, returning empty list");
      return [];
    } catch (error) {
      console.error("❌ Failed to list tournaments:", error);
      return [];
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  getSession(): Session | null {
    return this.session;
  }

  // Track last match details
  setLastMatch(info: { id: string; token?: string | null }) {
    this.lastMatchId = info.id || null;
    this.lastJoinToken = info.token || null;
  }
  getLastMatchId(): string | null { return this.lastMatchId; }
  getLastJoinToken(): string | null { return this.lastJoinToken; }
}

export const nakamaService = new NakamaService();