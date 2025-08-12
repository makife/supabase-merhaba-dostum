import { Client } from '@heroiclabs/nakama-js';

interface MatchTicket {
  ticket: string;
}

interface MatchmakingResult {
  ticket: string;
  match_id?: string;
  users?: any[];
}

class NakamaService {
  private client: Client;
  private session: any = null;
  private socket: any = null;

  constructor() {
    this.client = new Client(
      "kelimeci_default_key",  // Server key
      "88.99.121.2",           // Server IP 
      "7349",                  // HTTP port
      false                    // useSSL (false for development)
    );
  }

  // Authentication
  async authenticate(userId: string) {
    try {
      this.session = await this.client.authenticateDevice(userId, true);
      console.log("✅ Nakama authenticated:", this.session.user_id);
      return this.session;
    } catch (error) {
      console.error("❌ Nakama auth error:", error);
      throw error;
    }
  }

  // WebSocket connection
  async createSocket() {
    if (!this.session) {
      throw new Error("Authentication required first");
    }

    try {
      this.socket = this.client.createSocket(false, false);
      await this.socket.connect(this.session, false);
      console.log("🔌 Nakama WebSocket connected");
      return this.socket;
    } catch (error) {
      console.error("❌ Socket connection error:", error);
      throw error;
    }
  }

  // Matchmaking
  async findMatch(gameType: 'timed' | 'score' = 'timed'): Promise<MatchTicket> {
    if (!this.session) {
      await this.authenticate(`user_${Date.now()}`);
    }

    try {
      const ticket = await this.client.addMatchmaker(
        this.session,
        "*",                    // any skill level
        2, 2,                   // min/max players
        { game_type: gameType } // properties
      );
      
      console.log("🎯 Nakama matchmaking ticket:", ticket.ticket);
      return ticket;
    } catch (error) {
      console.error("❌ Nakama matchmaking error:", error);
      throw error;
    }
  }

  // Cancel matchmaking
  async cancelMatchmaking(ticket: string) {
    try {
      await this.client.removeMatchmaker(this.session, ticket);
      console.log("❌ Nakama matchmaking cancelled");
    } catch (error) {
      console.error("❌ Cancel matchmaking error:", error);
    }
  }

  // Get current session
  getSession() {
    return this.session;
  }

  // Get socket
  getSocket() {
    return this.socket;
  }
}

export const nakamaService = new NakamaService();
