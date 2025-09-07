import { Client, Session, Socket } from '@heroiclabs/nakama-js';

interface MatchTicket {
  ticket: string;
}

class NakamaService {
  private client: Client;
  private session: Session | null = null;
  private socket: Socket | null = null;
  
  constructor() {
    // WebSocket bağlantı sorunlarını çözmek için geçici olarak devre dışı bırak
    // Gelecekte doğru endpoint ile aktif edilecek
    this.client = null as any;
    console.log("🚀 Nakama Client temporarily disabled to fix WebSocket errors");
  }

  async authenticate(userId: string): Promise<Session> {
    console.log("🔐 Nakama authentication temporarily disabled");
    // Mock session için geçici çözüm
    this.session = { user_id: userId } as Session;
    return this.session;
  }

  async createSocket(): Promise<Socket> {
    console.log("🔌 WebSocket creation temporarily disabled");
    // Mock socket için geçici çözüm
    this.socket = {} as Socket;
    return this.socket;
  }

  async findMatch(gameType: 'timed' | 'score'): Promise<{ ticket: string }> {
    console.log("🎯 Matchmaking temporarily disabled for:", gameType);
    // Mock ticket döndür
    return { ticket: `mock_ticket_${Date.now()}` };
  }

  async cancelMatchmaking(ticket: string): Promise<void> {
    console.log("❌ Matchmaking cancellation temporarily disabled for:", ticket);
  }

  // Socket bağlantısını temizle
  disconnect(): void {
    console.log("🔌 Socket disconnect temporarily disabled");
    this.socket = null;
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