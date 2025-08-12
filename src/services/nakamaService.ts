interface MatchTicket {
  ticket: string;
}

class NakamaService {
  private session: any = null;
  private baseUrl: string = 'http://88.99.121.2:7350';
  private serverKey: string = 'kelimeci_default_key';

  constructor() {
    console.log("🚀 Direct HTTP Nakama Service initialized");
  }

  // HTTP-only Authentication
  async authenticate(userId: string) {
    try {
      const response = await fetch(`${this.baseUrl}/v2/account/authenticate/device?create=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(this.serverKey + ':')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: userId
        }),
        // SSL certificate hatalarını ignore et
        mode: 'cors',
        credentials: 'omit'
    });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.session = await response.json();
      console.log("✅ HTTP Nakama authenticated:", this.session.user?.id);
      return this.session;
    } catch (error) {
      console.error("❌ HTTP Nakama auth error:", error);
      throw error;
    }
  }

  // HTTP-only Matchmaking
  async findMatch(gameType: 'timed' | 'score' = 'timed'): Promise<MatchTicket> {
    if (!this.session) {
      await this.authenticate(`user_${Date.now()}`);
    }

    try {
      const response = await fetch(`${this.baseUrl}/v2/matchmaker`, {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${this.session.token}`,
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({
           min_count: 2,
           max_count: 2,
           query: "*",
           string_properties: {
             game_type: gameType
           }
         }),
         mode: 'cors',
         credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("🎯 HTTP Nakama matchmaking ticket:", result.ticket);
      
      // Simulate match found after 8 seconds (since we can't use WebSocket)
      setTimeout(() => {
        console.log("🎉 HTTP Nakama - Simulated match found!");
        // Trigger success callback here if needed
      }, 8000);

      return { ticket: result.ticket };
    } catch (error) {
      console.error("❌ HTTP Nakama matchmaking error:", error);
      throw error;
    }
  }

  // HTTP-only Cancel
  async cancelMatchmaking(ticket: string) {
    try {
      const response = await fetch(`${this.baseUrl}/v2/matchmaker/${ticket}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.session.token}`
        }
      });

      if (!response.ok) {
        console.warn("Cancel matchmaking failed, but continuing...");
      }
      
      console.log("❌ HTTP Nakama matchmaking cancelled");
    } catch (error) {
      console.error("❌ Cancel matchmaking error:", error);
    }
  }

  // Mock WebSocket (since we can't load the script)
  async createSocket() {
    console.log("🔌 Mock WebSocket connection (HTTP-only mode)");
    return {
      onmatchmakermatched: null,
      connect: () => Promise.resolve(),
      close: () => {}
    };
  }

  getSession() {
    return this.session;
  }

  getSocket() {
    return null; // HTTP-only mode
  }
}

export const nakamaService = new NakamaService();