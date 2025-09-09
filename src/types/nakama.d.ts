declare module '@heroiclabs/nakama-js' {
  export interface Session {
    user_id: string;
    username?: string;
    token?: string;
  }

  export interface Socket {
    connect(): Promise<void>;
    disconnect(): void;
    send(message: any): void;
    onmatchmakingmatched?: (matched: any) => void;
    onmatchmakermatched?: (matched: any) => void; // alias used in app
    onmatchmakerticket?: (ticket: any) => void;
  }

  export interface Client {
    authenticateDevice(deviceId: string): Promise<Session>;
    createSocket(): Socket;
  }

  export class Client {
    constructor(serverKey?: string, host?: string, port?: string, useSSL?: boolean);
    authenticateDevice(deviceId: string): Promise<Session>;
    createSocket(): Socket;
  }
}
