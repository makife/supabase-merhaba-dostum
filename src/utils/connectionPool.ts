// Connection Pool Utility for Scaling
export class ConnectionManager {
  private connections = new Map<string, any>();
  private maxConnections = 100;
  private currentConnections = 0;

  async getConnection(userId: string, type: 'game' | 'chat' | 'tournament') {
    const key = `${userId}-${type}`;
    
    if (this.connections.has(key)) {
      return this.connections.get(key);
    }

    if (this.currentConnections >= this.maxConnections) {
      throw new Error('Max connections reached');
    }

    // Create new connection with automatic cleanup
    const connection = this.createConnection(key, type);
    this.connections.set(key, connection);
    this.currentConnections++;

    return connection;
  }

  private createConnection(key: string, type: string) {
    // Implementation will depend on connection type
    return {
      key,
      type,
      lastActive: Date.now(),
      cleanup: () => {
        this.connections.delete(key);
        this.currentConnections--;
      }
    };
  }

  // Auto cleanup inactive connections
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      const timeout = 5 * 60 * 1000; // 5 minutes

      for (const [key, conn] of this.connections) {
        if (now - conn.lastActive > timeout) {
          conn.cleanup();
        }
      }
    }, 60 * 1000); // Check every minute
  }
}

export const connectionManager = new ConnectionManager();