// Nakama client - global window object olarak yükle
declare global {
  interface Window {
    NakamaJs: any;
  }
}

interface MatchTicket {
  ticket: string;
}

interface MatchmakingResult {
  ticket: string;
  match_id?: string;
  users?: any[];
}

class NakamaService {
  private client: any = null;
  private session: any = null;
  private socket: any = null;
  private isInitialized: boolean = false;

  constructor() {
    this.loadNakamaScript();
  }

  private async loadNakamaScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.NakamaJs) {
        this.initializeClient();
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@heroiclabs/nakama-js@3.8.0/dist/nakama-js.umd.js';
      script.onload = () => {
        // Global Nakama object'ini window'a ata
        window.NakamaJs = (window as any).nakamajs;
        this.initializeClient();
        resolve();
      };
      script.onerror = () => {
        reject(new Error('Failed to load Nakama script'));
      };
      document.head.appendChild(script);
    });
  }

  private initializeClient() {
    if (!window.NakamaJs) {
      console.error("❌ Nakama script not loaded");
      return;
    }

    try {
      this.client = new window.NakamaJs.Client(
        "kelimeci_default_key",
        "88.99.121.2", 
        "7349",
        false
      );
      this.isInitialized = true;
      console.log("✅ Nakama client initialized");
    } catch (error) {
      console.error("❌ Failed to initialize Nakama client:", error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.loadNakamaScript();
    }
  }

  // Authentication
  async authenticate(userId: string) {
    await this.ensureInitialized();
    
    if (!this.client) {
      throw new Error("Nakama client not initialized");
    }

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
    await this.ensureInitialized();
    
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
    await this.ensureInitialized();
    
    if (!this.session) {
      await this.authenticate(`user_${Date.now()}`);
    }

    try {
      const ticket = await this.client.addMatchmaker(
        this.session,
        "*",
        2, 2,
        { game_type: gameType }
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