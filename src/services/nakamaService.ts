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

      const ticket = await this.socket.addMatchmaker("*", 2, 2, {
        "game_type": gameType,
        "region": "eu-west"
      });
      
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
      
      console.log("✅ Private match created:", cleanMatchId);
      
      // Host olarak match'e katıl
      console.log("👤 Joining as host...");
      await this.socket.joinMatch(cleanMatchId);
      console.log("✅ Joined as host");
      
      // Last match bilgisini kaydet
      this.setLastMatch({ id: cleanMatchId });
      
      return cleanMatchId;
    } catch (error) {
      console.error("❌ Failed to create private room:", error);
      throw error;
    }
  }

  async joinPrivateRoom(roomCode: string): Promise<string> {
    try {
      if (!this.socket) {
        throw new Error("Socket not connected");
      }

      const cleanRoomCode = roomCode.endsWith('.') ? roomCode.slice(0, -1) : roomCode;
      console.log("🚪 Joining private match:", cleanRoomCode);
      
      const joinResult = await this.socket.joinMatch(cleanRoomCode);
      const actualMatchId = joinResult.match_id || cleanRoomCode;
      
      console.log("✅ Joined private room:", actualMatchId);
      
      // Last match bilgisini kaydet
      this.setLastMatch({ id: actualMatchId });
      
      return actualMatchId;
    } catch (error) {
      console.error("❌ Failed to join private room:", error);
      throw error;
    }
  }

  async createTournament(name: string, maxPlayers: number = 8): Promise<string> {
    try {
      if (!this.socket) {
        throw new Error("Socket not connected");
      }

      const tournament = await this.socket.createTournament({
        title: name,
        description: "Kelime oyunu turnuvası",
        category: 1,
        sort_order: 0,
        size: maxPlayers,
        max_size: maxPlayers,
        max_num_score: 1,
        duration: 900,
        start_active: Date.now() + 60000,
        end_active: Date.now() + 900000
      });
      
      console.log("✅ Tournament created:", tournament.tournament_id);
      return tournament.tournament_id;
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

      await this.socket.joinTournament(tournamentId);
      console.log("✅ Joined tournament:", tournamentId);
    } catch (error) {
      console.error("❌ Failed to join tournament:", error);
      throw error;
    }
  }

  async listTournaments(): Promise<any[]> {
    try {
      if (!this.socket) {
        throw new Error("Socket not connected");
      }

      const result = await this.socket.listTournaments({
        category_start: 1,
        category_end: 1,
        start_time: Math.floor(Date.now() / 1000),
        end_time: Math.floor(Date.now() / 1000) + 86400, // Next 24 hours
        limit: 100
      });
      
      console.log("✅ Listed tournaments:", result.tournaments?.length || 0);
      return result.tournaments || [];
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