import { Client, Session, Socket } from '@heroiclabs/nakama-js';

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
      
     const config = {
  serverKey: 'defaultkey',
  host: 'nakama.kelimeci.com.tr',
  port: '443',
  useSSL: true
};

this.client = new Client(
  'defaultkey',
  'nakama.kelimeci.com.tr',
  '443',
  true  // SSL
);

// WebSocket için de HTTP kullan
(this.client as any).ssl = false;
(this.client as any).useSSL = false;
      
      this.isInitialized = true;
      console.log("✅ Nakama client initialized with config:", {
        host: config.host,
        port: config.port,
        useSSL: config.useSSL
      });
    } catch (error) {
      console.error("❌ Failed to initialize Nakama client:", error);
      throw error;
    }
  }

  async authenticate(userId: string): Promise<Session> {
    try {
      await this.initializeClient();
      console.log("🔐 Nakama authentication starting for:", userId);
      
      if (!this.client) {
        throw new Error("Client not initialized");
      }
      
      this.session = await this.client.authenticateDevice(userId);
      console.log("✅ Nakama authentication successful");
      return this.session;
    } catch (error) {
      console.error("❌ Nakama authentication failed:", error);
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
      
      this.socket = (this.client as any).createSocket(true);
      await this.socket.connect(this.session);
      console.log("✅ Nakama WebSocket connected via WSS");
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