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

      // SSL'i zorla - port string olarak kalmalı
      this.client = new Client(
        config.serverKey,
        config.host,
        config.port,
        true  // Her zaman SSL kullan
      );

      console.log("✅ Nakama client initialized");
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
    
    // Manuel WebSocket URL oluştur
    this.socket = this.client.createSocket(true, false);  // useSSL=true, verbose=false
    
    console.log("🔗 Connecting to Nakama WebSocket with SSL enforced...");
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
    console.log("✅ Nakama disconnected");
  }

  async createPrivateRoom(gameType: 'timed' | 'score'): Promise<string> {
    try {
      if (!this.socket) {
        throw new Error("Socket not connected");
      }

      const match = await this.socket.createMatch();
      const cleanMatchId = match.match_id.endsWith('.') ? match.match_id.slice(0, -1) : match.match_id;
      console.log("✅ Private room created:", cleanMatchId);
      return cleanMatchId;
    } catch (error) {
      console.error("❌ Failed to create private room:", error);
      throw error;
    }
  }

  async joinPrivateRoom(roomCode: string): Promise<void> {
    try {
      if (!this.socket) {
        throw new Error("Socket not connected");
      }

      const cleanRoomCode = roomCode.endsWith('.') ? roomCode.slice(0, -1) : roomCode;
      await this.socket.joinMatch(cleanRoomCode);
      console.log("✅ Joined private room:", cleanRoomCode);
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

  getSocket(): Socket | null {
    return this.socket;
  }

  getSession(): Session | null {
    return this.session;
  }
}

export const nakamaService = new NakamaService();