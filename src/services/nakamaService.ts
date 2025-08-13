import { Client, Session, Socket } from '@heroiclabs/nakama-js';

interface MatchTicket {
  ticket: string;
}

class NakamaService {
  private client: Client;
  private session: Session | null = null;
  private socket: Socket | null = null;
  
  constructor() {
    // Mevcut ayarlarınızı kullanıyorum
    this.client = new Client("kelimeci_default_key", "kelimeci.com.tr", 7350, true); // SSL için true
    console.log("🚀 Nakama WebSocket Service initialized");
  }

  async authenticate(userId: string): Promise<Session> {
    try {
      console.log("🔐 Authenticating with Nakama WebSocket...");
      
      // Device authentication - REST API'yi de kullanabilir
      this.session = await this.client.authenticateDevice(userId, true);
      
      console.log("✅ Nakama authentication successful:", this.session.user_id);
      return this.session;
    } catch (error) {
      console.error("❌ Nakama authentication failed:", error);
      throw new Error(`Authentication failed: ${error}`);
    }
  }

  async createSocket(): Promise<Socket> {
    if (!this.session) {
      throw new Error("Must authenticate before creating socket");
    }

    try {
      console.log("🔌 Creating WebSocket connection...");
      
      // WebSocket bağlantısı oluştur
      this.socket = this.client.createSocket(true, false); // useSSL: true, verbose: false
      
      // Bağlantıyı aç
      await this.socket.connect(this.session);
      
      console.log("✅ WebSocket connected successfully");
      return this.socket;
    } catch (error) {
      console.error("❌ WebSocket connection failed:", error);
      throw new Error(`Socket connection failed: ${error}`);
    }
  }

  async findMatch(gameType: 'timed' | 'score'): Promise<{ ticket: string }> {
    if (!this.socket) {
      throw new Error("Socket connection required for matchmaking");
    }

    try {
      console.log("🎯 Starting matchmaking for:", gameType);
      
      // Matchmaking parametreleri
      const query = `+properties.game_type:${gameType}`;
      const minCount = 2; // Minimum 2 oyuncu
      const maxCount = 2; // Maximum 2 oyuncu
      const stringProperties = { game_type: gameType };
      const numericProperties = {};

      // Matchmaking ticket oluştur
      const matchmakerTicket = await this.socket.addMatchmaker(
        query,
        minCount,
        maxCount,
        stringProperties,
        numericProperties
      );

      console.log("🎫 Matchmaking ticket created:", matchmakerTicket.ticket);
      
      return { ticket: matchmakerTicket.ticket };
    } catch (error) {
      console.error("❌ Matchmaking failed:", error);
      throw new Error(`Matchmaking failed: ${error}`);
    }
  }

  async cancelMatchmaking(ticket: string): Promise<void> {
    if (!this.socket) {
      throw new Error("Socket connection required");
    }

    try {
      console.log("❌ Cancelling matchmaking ticket:", ticket);
      await this.socket.removeMatchmaker(ticket);
      console.log("✅ Matchmaking cancelled successfully");
    } catch (error) {
      console.error("❌ Cancel matchmaking failed:", error);
      throw new Error(`Cancel failed: ${error}`);
    }
  }

  // Socket bağlantısını temizle
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log("🔌 Socket disconnected");
    }
  }

  // Getter'lar
  getSocket(): Socket | null {
    return this.socket;
  }

  getSession(): Session | null {
    return this.session;
  }
}

// Singleton instance
export const nakamaService = new NakamaService();