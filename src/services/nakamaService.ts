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
  private sessions: Map<string, Session> = new Map();
  private sockets: Map<string, Socket> = new Map();
  private isInitialized: boolean = false;
  private useSSL: boolean = false;
  private lastMatchIds: Map<string, string> = new Map();
  private lastJoinTokens: Map<string, string> = new Map();

  constructor() {
    console.log("NakamaService created, will initialize on first use");
  }

  private async initializeClient(): Promise<void> {
    if (this.isInitialized && this.client) {
      return;
    }

    try {
      console.log("Initializing Nakama client...");
      
      const { data: configData, error: configError } = await supabase.functions.invoke('nakama-config');
      
      if (configError || !configData?.config) {
        console.error("Failed to fetch Nakama config:", configError);
        throw new Error("Could not fetch Nakama configuration");
      }

      const config = configData.config;
      
      console.log("Nakama config received:", {
        host: config.host,
        port: config.port,
        useSSL: config.useSSL
      });

      this.client = new Client(
        config.serverKey,
        config.host,
        config.port,
        config.useSSL
      );

      this.useSSL = !!config.useSSL;

      console.log("Nakama client initialized");
      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize Nakama client:", error);
      throw error;
    }
  }

  async authenticate(userId: string): Promise<Session> {
    try {
      await this.initializeClient();
      console.log("Nakama auth via Edge Function for:", userId);
      
      if (!this.client) {
        throw new Error("Client not initialized");
      }

      const { data, error } = await (supabase.functions as any).invoke('nakama-auth', {
        body: { deviceId: userId }
      });

      if (error) {
        console.error("Edge function error:", error);
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

      this.sessions.set(userId, minimalSession as Session);
      console.log("Nakama authentication successful for:", userId);
      return minimalSession as Session;
    } catch (error) {
      console.error("Nakama authentication failed for:", userId, error);
      throw error;
    }
  }

  async createSocket(userId: string): Promise<Socket> {
    try {
      console.log("Creating Nakama WebSocket for user:", userId);
      
      const session = this.sessions.get(userId);
      if (!session) {
        throw new Error("Must authenticate before creating socket");
      }
      
      if (!this.client) {
        throw new Error("Client not initialized");
      }
      
      // Mevcut socket varsa kapat
      const existingSocket = this.sockets.get(userId);
      if (existingSocket) {
        console.log("Closing existing socket for:", userId);
        existingSocket.disconnect();
      }
      
      const socket = this.client.createSocket(this.useSSL, false);
      
      console.log("Connecting to Nakama WebSocket for:", userId);
      await socket.connect(session);
      
      this.sockets.set(userId, socket);
      console.log("Nakama WebSocket connected for:", userId);
      return socket;
    } catch (error) {
      console.error("Nakama WebSocket creation failed for:", userId, error);
      throw error;
    }
  }

  async findMatch(userId: string, gameType: 'timed' | 'score'): Promise<{ ticket: string }> {
    try {
      console.log("Starting Nakama matchmaking for:", userId, gameType);
      
      const socket = this.sockets.get(userId);
      if (!socket) {
        throw new Error("Socket not connected for user: " + userId);
      }

      const ticket = await socket.addMatchmaker("*", 2, 2, {
        "game_type": gameType,
        "region": "eu-west"
      });
      
      console.log("Nakama matchmaking ticket created:", ticket.ticket);
      return { ticket: ticket.ticket };
    } catch (error) {
      console.error("Nakama matchmaking failed:", error);
      throw error;
    }
  }

  async cancelMatchmaking(userId: string, ticket: string): Promise<void> {
    try {
      console.log("Cancelling Nakama matchmaking:", ticket);
      
      const socket = this.sockets.get(userId);
      if (!socket) {
        throw new Error("Socket not connected for user: " + userId);
      }

      await socket.removeMatchmaker(ticket);
      console.log("Nakama matchmaking cancelled");
    } catch (error) {
      console.error("Failed to cancel matchmaking:", error);
      throw error;
    }
  }

  disconnect(userId: string): void {
    console.log("Disconnecting Nakama socket for:", userId);
    const socket = this.sockets.get(userId);
    if (socket) {
      socket.disconnect();
      this.sockets.delete(userId);
    }
    this.sessions.delete(userId);
    this.lastMatchIds.delete(userId);
    this.lastJoinTokens.delete(userId);
    console.log("Nakama disconnected for:", userId);
  }

  async createPrivateRoom(userId: string, gameType: 'timed' | 'score'): Promise<string> {
    try {
      const socket = this.sockets.get(userId);
      if (!socket) {
        throw new Error("Socket not connected for user: " + userId);
      }

      const match = await socket.createMatch();
      const cleanMatchId = match.match_id.endsWith('.') ? match.match_id.slice(0, -1) : match.match_id;
      console.log("Private room created:", cleanMatchId);
      return cleanMatchId;
    } catch (error) {
      console.error("Failed to create private room:", error);
      throw error;
    }
  }

  async joinPrivateRoom(userId: string, roomCode: string): Promise<void> {
    try {
      const socket = this.sockets.get(userId);
      if (!socket) {
        throw new Error("Socket not connected for user: " + userId);
      }

      const cleanRoomCode = roomCode.endsWith('.') ? roomCode.slice(0, -1) : roomCode;
      await socket.joinMatch(cleanRoomCode);
      console.log("Joined private room:", cleanRoomCode);
    } catch (error) {
      console.error("Failed to join private room:", error);
      throw error;
    }
  }

  async createTournament(userId: string, name: string, maxPlayers: number = 8): Promise<string> {
    try {
      const socket = this.sockets.get(userId);
      if (!socket) {
        throw new Error("Socket not connected for user: " + userId);
      }

      const tournament = await socket.createTournament({
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
      
      console.log("Tournament created:", tournament.tournament_id);
      return tournament.tournament_id;
    } catch (error) {
      console.error("Failed to create tournament:", error);
      throw error;
    }
  }

  async joinTournament(userId: string, tournamentId: string): Promise<void> {
    try {
      const socket = this.sockets.get(userId);
      if (!socket) {
        throw new Error("Socket not connected for user: " + userId);
      }

      await socket.joinTournament(tournamentId);
      console.log("Joined tournament:", tournamentId);
    } catch (error) {
      console.error("Failed to join tournament:", error);
      throw error;
    }
  }

  async listTournaments(userId: string): Promise<any[]> {
    try {
      const socket = this.sockets.get(userId);
      if (!socket) {
        throw new Error("Socket not connected for user: " + userId);
      }

      const result = await socket.listTournaments({
        category_start: 1,
        category_end: 1,
        start_time: Math.floor(Date.now() / 1000),
        end_time: Math.floor(Date.now() / 1000) + 86400,
        limit: 100
      });
      
      console.log("Listed tournaments:", result.tournaments?.length || 0);
      return result.tournaments || [];
    } catch (error) {
      console.error("Failed to list tournaments:", error);
      return [];
    }
  }

  getSocket(userId: string): Socket | null {
    return this.sockets.get(userId) || null;
  }

  getSession(userId: string): Session | null {
    return this.sessions.get(userId) || null;
  }

  setLastMatch(userId: string, info: { id: string; token?: string | null }) {
    this.lastMatchIds.set(userId, info.id || '');
    this.lastJoinTokens.set(userId, info.token || '');
  }

  getLastMatchId(userId: string): string | null {
    return this.lastMatchIds.get(userId) || null;
  }

  getLastJoinToken(userId: string): string | null {
    return this.lastJoinTokens.get(userId) || null;
  }
}

export const nakamaService = new NakamaService();